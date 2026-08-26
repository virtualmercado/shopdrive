// Reconciliação segura de pagamentos de assinatura master (Mercado Pago).
// Modos:
//   report    -> SOMENTE LEITURA. Consulta o estado atual de cada pagamento no MP.
//   reconcile -> Idempotente. Reflete no banco o estado real do gateway.
//   cancel    -> Cancela no MP apenas os payment ids explicitamente informados (requer confirm:true).
// Nunca faz reembolso automático. Nunca apaga invoices. Sempre escopado por user_id.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-reconcile-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Mode = "report" | "reconcile" | "cancel";

interface Body {
  userId: string;
  mode?: Mode;
  paymentIds?: string[]; // gateway payment ids (para cancel)
  confirm?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalToken = Deno.env.get("RECONCILE_ADMIN_TOKEN") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Autorização: token interno OU JWT de admin ---
    let authorized = false;
    const providedToken = req.headers.get("x-reconcile-token");
    if (internalToken && providedToken && providedToken === internalToken) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: claimsData } = await supabaseAuth.auth.getClaims(token);
        const claims: any = claimsData?.claims;
        if (claims?.role === "service_role") {
          authorized = true;
        } else if (claims?.sub) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: claims.sub,
            _role: "admin",
          });
          authorized = Boolean(isAdmin);
        }
      }
    }
    if (!authorized) return json({ error: "Não autorizado" }, 401);

    const body: Body = await req.json();
    const mode: Mode = body.mode || "report";
    const userId = body.userId;
    if (!userId) return json({ error: "userId é obrigatório" }, 400);

    const { data: gateway } = await supabase
      .from("master_payment_gateways")
      .select("mercadopago_access_token")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (!gateway?.mercadopago_access_token) {
      return json({ error: "Gateway Mercado Pago não configurado" }, 500);
    }
    const mpToken = gateway.mercadopago_access_token as string;

    // Pagamentos internos APENAS deste usuário (isolamento multitenant)
    const { data: payments, error: payErr } = await supabase
      .from("master_subscription_payments")
      .select(
        "id, subscription_id, user_id, amount, status, gateway_status, gateway_payment_id, payment_method, paid_at, created_at, idempotency_key"
      )
      .eq("user_id", userId)
      .not("gateway_payment_id", "is", null)
      .order("created_at", { ascending: true });

    if (payErr) return json({ error: "Erro ao ler pagamentos" }, 500);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_id, status, amount, mp_payment_id, subscription_id, paid_at, notes")
      .eq("subscriber_id", userId);

    const mpGet = async (id: string) => {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, httpStatus: r.status, data: j };
    };

    // --- MODO CANCEL (explícito, escopado, exige confirm) ---
    if (mode === "cancel") {
      if (!body.confirm) return json({ error: "confirm:true é obrigatório para cancelar" }, 400);
      const ids = (body.paymentIds || []).map(String);
      if (ids.length === 0) return json({ error: "paymentIds é obrigatório" }, 400);
      const owned = new Set((payments || []).map((p) => String(p.gateway_payment_id)));
      const results: any[] = [];
      for (const id of ids) {
        if (!owned.has(id)) {
          results.push({ paymentId: id, skipped: "não pertence a este usuário" });
          continue;
        }
        const current = await mpGet(id);
        if (!["pending", "in_process", "in_mediation", "authorized"].includes(current.data?.status)) {
          results.push({
            paymentId: id,
            skipped: `status ${current.data?.status} não é cancelável`,
            status: current.data?.status,
          });
          continue;
        }
        const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${mpToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `cancel-${id}`,
          },
          body: JSON.stringify({ status: "cancelled" }),
        });
        const j = await r.json().catch(() => ({}));
        results.push({
          paymentId: id,
          ok: r.ok,
          httpStatus: r.status,
          newStatus: j?.status ?? null,
          error: r.ok ? null : j?.message || j?.error || "erro no cancelamento",
        });
        console.log("cancel_attempt", { paymentId: id, ok: r.ok, newStatus: j?.status });
      }
      return json({ mode, userId, results });
    }

    // --- REPORT / RECONCILE ---
    const report: any[] = [];
    let approvedCount = 0;
    let pendingCount = 0;
    let terminalCount = 0;

    const enriched: any[] = [];
    for (const p of payments || []) {
      const mp = await mpGet(String(p.gateway_payment_id));
      const s = mp.data?.status ?? null;
      const invoice = (invoices || []).find(
        (i) => String(i.mp_payment_id) === String(p.gateway_payment_id)
      );
      if (s === "approved") approvedCount++;
      else if (["pending", "in_process", "in_mediation", "authorized"].includes(s)) pendingCount++;
      else terminalCount++;

      const row = {
        internalPaymentId: p.id,
        subscriptionId: p.subscription_id,
        invoice: invoice?.invoice_id ?? null,
        invoiceUuid: invoice?.id ?? null,
        invoiceStatus: invoice?.status ?? null,
        gatewayPaymentId: String(p.gateway_payment_id),
        internalStatus: p.status,
        storedGatewayStatus: p.gateway_status,
        mpStatus: s,
        mpStatusDetail: mp.data?.status_detail ?? null,
        amount: mp.data?.transaction_amount ?? p.amount,
        externalReference: mp.data?.external_reference ?? null,
        mpLastUpdated: mp.data?.date_last_updated ?? null,
        mpHttp: mp.httpStatus,
        idempotencyKeyPattern: p.idempotency_key
          ? p.idempotency_key.replace(/-\d{10,}$/, "-<timestamp>")
          : null,
      };
      enriched.push({ row, payment: p, invoice, mp: mp.data });
      report.push(row);
      console.log("reconcile_read", {
        gatewayPaymentId: row.gatewayPaymentId,
        mpStatus: row.mpStatus,
        mpStatusDetail: row.mpStatusDetail,
      });
    }

    const summary = {
      total: report.length,
      approved: approvedCount,
      pendingOrInReview: pendingCount,
      terminalWithoutCharge: terminalCount,
      duplicateChargeRisk: approvedCount > 1 ? "CRÍTICO" : pendingCount > 1 ? "ALTO" : "BAIXO",
    };

    if (mode === "report") {
      return json({ mode, userId, summary, payments: report });
    }

    // --- RECONCILE idempotente ---
    // Pagamento legítimo = primeiro approved (mais antigo). Demais approved => duplicidade (sem reembolso automático).
    const approvedRows = enriched.filter((e) => e.mp.status === "approved");
    const legit = approvedRows[0] ?? null;
    const actions: any[] = [];

    for (const e of enriched) {
      const { payment, invoice, mp } = e;
      const s = mp.status as string;
      const isLegit = legit && legit.payment.id === payment.id;

      let newPaymentStatus: string | null = null;
      let newInvoiceStatus: string | null = null;

      if (s === "approved") {
        newPaymentStatus = "paid";
        newInvoiceStatus = "paid";
      } else if (s === "rejected") {
        newPaymentStatus = "failed";
        newInvoiceStatus = "rejected";
      } else if (s === "cancelled") {
        newPaymentStatus = "cancelled";
        newInvoiceStatus = "cancelled";
      } else if (s === "refunded" || s === "charged_back") {
        newPaymentStatus = "refunded";
        newInvoiceStatus = "refunded";
      } else {
        // pending / in_process / in_mediation / authorized => permanece sob reconciliação
        actions.push({ gatewayPaymentId: String(payment.gateway_payment_id), action: "kept_pending", mpStatus: s });
        continue;
      }

      // Idempotência: só grava quando há mudança real
      if (payment.status !== newPaymentStatus || payment.gateway_status !== s) {
        const upd: any = {
          status: newPaymentStatus,
          gateway_status: s,
          updated_at: new Date().toISOString(),
        };
        if (newPaymentStatus === "paid" && !payment.paid_at) {
          upd.paid_at = mp.date_approved || new Date().toISOString();
        }
        await supabase.from("master_subscription_payments").update(upd).eq("id", payment.id);
      }

      if (invoice && invoice.status !== newInvoiceStatus) {
        const iupd: any = { status: newInvoiceStatus };
        if (newInvoiceStatus === "paid" && !invoice.paid_at) {
          iupd.paid_at = mp.date_approved || new Date().toISOString();
        }
        iupd.notes = [
          invoice.notes,
          `reconciliado em ${new Date().toISOString()} (MP: ${s}${mp.status_detail ? "/" + mp.status_detail : ""})`,
        ]
          .filter(Boolean)
          .join(" | ");
        await supabase.from("invoices").update(iupd).eq("id", invoice.id);
      }

      // Ativação de plano: SOMENTE para o pagamento legítimo aprovado
      if (s === "approved" && isLegit) {
        const { data: sub } = await supabase
          .from("master_subscriptions")
          .select("id, status, plan_id, started_at, pending_plan_id")
          .eq("id", payment.subscription_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (sub && sub.status !== "active") {
          const planId = sub.pending_plan_id || sub.plan_id;
          await supabase
            .from("master_subscriptions")
            .update({
              status: "active",
              plan_id: planId,
              pending_plan_id: null,
              started_at: sub.started_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id)
            .eq("user_id", userId);

          await supabase.from("master_subscription_logs").insert({
            subscription_id: sub.id,
            user_id: userId,
            payment_id: payment.id,
            event_type: "payment_approved",
            event_description: "Reconciliação: pagamento aprovado no gateway, plano ativado",
            metadata: { gatewayPaymentId: String(payment.gateway_payment_id) },
          });
          actions.push({ gatewayPaymentId: String(payment.gateway_payment_id), action: "activated_plan", planId });
        } else {
          actions.push({ gatewayPaymentId: String(payment.gateway_payment_id), action: "already_active" });
        }
      } else if (s === "approved" && !isLegit) {
        await supabase.from("master_subscription_logs").insert({
          subscription_id: payment.subscription_id,
          user_id: userId,
          payment_id: payment.id,
          event_type: "duplicate_charge_detected",
          event_description:
            "Reconciliação: pagamento aprovado duplicado. Requer autorização humana para estorno.",
          metadata: { gatewayPaymentId: String(payment.gateway_payment_id) },
        });
        actions.push({
          gatewayPaymentId: String(payment.gateway_payment_id),
          action: "duplicate_flagged_no_refund",
        });
      } else {
        actions.push({ gatewayPaymentId: String(payment.gateway_payment_id), action: `synced_${newPaymentStatus}` });
      }
    }

    return json({ mode, userId, summary, payments: report, actions });
  } catch (error: any) {
    console.error("reconcile error:", error?.message);
    return json({ error: error?.message || "Erro interno" }, 500);
  }
});
