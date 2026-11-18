import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

// Regularization of the caller's own delinquent subscription. The browser never sends plan, cycle or amount:
// the server ledger decides them, the provider is called with a stable idempotency key, and entitlement changes
// only through apply_master_subscription_webhook (the same reconciliation used by the signed webhook).
const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("status"), regularizationId: z.string().uuid() }).strict(),
]);
const Identifier = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/));
const CreatedSchema = z.object({
  id: Identifier,
  status: z.enum(["pending", "in_process", "authorized", "approved", "rejected", "cancelled"]),
  status_detail: z.string().max(200).nullish(),
  transaction_amount: z.number().positive().finite(),
  currency_id: z.literal("BRL"),
  external_reference: z.string().max(200).nullish(),
  point_of_interaction: z.object({ transaction_data: z.object({ qr_code: z.string().max(4000).nullish(), qr_code_base64: z.string().max(200000).nullish() }).nullish() }).nullish(),
});
const PaymentSchema = z.object({
  id: Identifier,
  status: z.enum(["approved", "pending", "in_process", "authorized", "rejected", "cancelled", "refunded", "charged_back"]),
  status_detail: z.string().max(200).nullish(),
  transaction_amount: z.number().positive().finite(),
  currency_id: z.literal("BRL"),
  date_approved: z.string().datetime({ offset: true }).nullish(),
  external_reference: z.string().max(200).nullish(),
  payment_method_id: z.string().max(100).optional(),
});
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const pixView = (r: any) => ({
  qrCode: r?.pix_qr_code ?? null,
  qrCodeBase64: r?.pix_qr_code_base64 ?? null,
  expiresAt: r?.pix_expires_at ?? null,
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Serviço indisponível" }, 503);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
  const auth = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: claimsError } = await auth.auth.getClaims(authHeader.slice(7));
  const userId = claims?.claims?.sub as string | undefined;
  if (claimsError || !userId) return json({ error: "Não autorizado" }, 401);
  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Requisição inválida" }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Requisição inválida" }, 400);
  const db = createClient(url, service);

  const gatewayToken = async (): Promise<string | null> => {
    const { data } = await db.from("master_payment_gateways").select("mercadopago_access_token")
      .eq("gateway_name", "mercadopago").eq("is_active", true).eq("is_default", true).maybeSingle();
    return (data as any)?.mercadopago_access_token || null;
  };

  // Provider GET -> the shared idempotent reconciliation (or time-based expiry for a still-open expired PIX).
  const reconcile = async (row: { id: string; gateway_payment_id: string; pix_expires_at: string }, token: string) => {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(row.gateway_payment_id)}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { await response.text(); throw new Error("provider_lookup_failed"); }
    const payment = PaymentSchema.parse(await response.json());
    if (payment.id !== row.gateway_payment_id) throw new Error("provider_resource_mismatch");
    if (payment.status === "approved" && !payment.date_approved) throw new Error("provider_approval_date_missing");
    if (["pending", "in_process", "authorized"].includes(payment.status)) {
      if (new Date(row.pix_expires_at).getTime() < Date.now() - 5 * 60 * 1000 && payment.status !== "authorized") {
        const { error } = await db.rpc("expire_subscription_regularization", { p_regularization_id: row.id, p_gateway_status: payment.status });
        if (error) throw new Error("expire_failed");
      }
      return;
    }
    const eventKey = `payment:${payment.id}:regularization-poll:${payment.status}`;
    const { data: claim, error: claimError } = await db.rpc("claim_master_subscription_webhook", {
      p_event_key: eventKey, p_resource_id: payment.id, p_topic: "payment",
    });
    if (claimError || !claim) throw new Error("claim_failed");
    if (!claim.claimed) return; // already applied by the webhook or another poll
    const resource = { ...payment, preapproval_id: null, next_payment_date: null, hard_decline: false,
      user_message: "O pagamento não foi aprovado." };
    const { error: applyError } = await db.rpc("apply_master_subscription_webhook", {
      p_event_key: eventKey, p_claim_token: claim.token, p_kind: "payment", p_resource: resource,
    });
    if (applyError) {
      await db.rpc("release_master_subscription_webhook", { p_event_key: eventKey, p_claim_token: claim.token });
      throw new Error("reconciliation_failed");
    }
  };

  const readState = async (regularizationId: string) => {
    const { data: row } = await db.from("master_subscription_regularizations")
      .select("id,subscription_id,status,plan_id,billing_cycle,amount,gateway_payment_id,payment_id,pix_expires_at")
      .eq("id", regularizationId).eq("user_id", userId).maybeSingle();
    if (!row) return null;
    let pix = null;
    if ((row as any).status === "pending" && (row as any).payment_id) {
      const { data: p } = await db.from("master_subscription_payments").select("pix_qr_code,pix_qr_code_base64,pix_expires_at,status")
        .eq("id", (row as any).payment_id).maybeSingle();
      if (p && ["pending", "in_process", "processing"].includes((p as any).status)) pix = pixView(p);
    }
    const { data: sub } = await db.from("master_subscriptions").select("status,plan_id").eq("id", (row as any).subscription_id).maybeSingle();
    // Success only when the server applied the confirmed payment to the same subscription.
    const regularized = (row as any).status === "paid" && (sub as any)?.status === "active" && (sub as any)?.plan_id === (row as any).plan_id;
    return { row: row as any, pix, state: regularized ? "paid" : (row as any).status === "paid" ? "pending" : (row as any).status };
  };

  try {
    const token = await gatewayToken();
    if (!token) return json({ error: "Pagamento indisponível no momento. Tente novamente mais tarde." }, 503);

    if (parsed.data.action === "status") {
      let current = await readState(parsed.data.regularizationId);
      if (!current) return json({ error: "Cobrança não encontrada" }, 404);
      if (current.row.status === "pending" && current.row.gateway_payment_id) {
        try { await reconcile(current.row, token); } catch { /* keep the last confirmed server state */ }
        current = await readState(parsed.data.regularizationId);
        if (!current) return json({ error: "Cobrança não encontrada" }, 404);
      }
      return json({ state: current.state, regularizationId: current.row.id, pix: current.pix });
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: begin, error: beginError } = await db.rpc("begin_subscription_regularization", { p_user_id: userId });
      if (beginError || !begin) return json({ error: "Não foi possível iniciar a regularização. Tente novamente." }, 500);
      if (begin.status === "not_eligible") return json({ state: "not_eligible" }, 409);
      if (begin.status === "busy") return json({ state: "busy" }, 202);
      if (begin.status === "open") {
        return json({ state: "pending", regularizationId: begin.regularization_id, pix: pixView(begin) });
      }
      if (begin.status === "reconcile") {
        const { data: row } = await db.from("master_subscription_regularizations").select("id,gateway_payment_id,pix_expires_at")
          .eq("id", begin.regularization_id).eq("user_id", userId).maybeSingle();
        if (!row) return json({ error: "Não foi possível iniciar a regularização. Tente novamente." }, 500);
        try { await reconcile(row as any, token); } catch { return json({ state: "busy" }, 202); }
        const current = await readState(begin.regularization_id);
        if (current && (current.state === "pending" || current.state === "paid")) {
          return json({ state: current.state, regularizationId: begin.regularization_id, pix: current.pix });
        }
        continue; // closed charge (expired/cancelled/failed): a new one may be created once
      }
      if (begin.status !== "charge") return json({ error: "Não foi possível iniciar a regularização. Tente novamente." }, 500);

      const { data: profile } = await db.from("profiles").select("email,full_name,store_name,cpf_cnpj").eq("id", userId).maybeSingle();
      const name = String((profile as any)?.full_name || (profile as any)?.store_name || "Cliente ShopDrive").trim();
      const document = String((profile as any)?.cpf_cnpj || "").replace(/\D/g, "");
      const payload = {
        transaction_amount: Number(begin.amount),
        description: `Regularização ${begin.plan_name} ${begin.billing_cycle === "annual" ? "Anual" : "Mensal"} - ShopDrive`,
        payment_method_id: "pix",
        payer: {
          email: (profile as any)?.email || claims?.claims?.email,
          first_name: name.split(" ")[0],
          last_name: name.split(" ").slice(1).join(" ") || name.split(" ")[0],
          identification: { type: document.length === 14 ? "CNPJ" : "CPF", number: document || "00000000000" },
        },
        date_of_expiration: new Date(begin.pix_expires_at).toISOString(),
        external_reference: begin.invoice_reference,
        notification_url: `${url}/functions/v1/master-subscription-webhook`,
      };
      let created: z.infer<typeof CreatedSchema>;
      try {
        const response = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": begin.idempotency_key },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) { await response.text(); throw new Error("provider_create_failed"); }
        created = CreatedSchema.parse(await response.json());
        if (Math.round(created.transaction_amount * 100) !== Math.round(Number(begin.amount) * 100) || created.external_reference !== begin.invoice_reference) {
          throw new Error("provider_charge_mismatch");
        }
      } catch {
        // Same invoice and idempotency key are reused on the next attempt; nothing is confirmed here.
        await db.rpc("release_subscription_regularization_charge", { p_regularization_id: begin.regularization_id });
        return json({ error: "Não foi possível gerar o PIX agora. Tente novamente em instantes." }, 502);
      }
      const { data: recorded, error: recordError } = await db.rpc("record_subscription_regularization_charge", {
        p_regularization_id: begin.regularization_id,
        p_resource: {
          id: created.id, status: created.status, status_detail: created.status_detail ?? null,
          transaction_amount: created.transaction_amount, currency_id: created.currency_id, external_reference: created.external_reference,
          pix_qr_code: created.point_of_interaction?.transaction_data?.qr_code ?? null,
          pix_qr_code_base64: created.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
        },
      });
      if (recordError || !recorded) return json({ error: "Não foi possível gerar o PIX agora. Tente novamente em instantes." }, 502);
      if (!["pending", "in_process"].includes(created.status)) {
        try { await reconcile({ id: begin.regularization_id, gateway_payment_id: created.id, pix_expires_at: begin.pix_expires_at }, token); } catch { /* polled later */ }
        const current = await readState(begin.regularization_id);
        return json({ state: current?.state ?? "pending", regularizationId: begin.regularization_id, pix: current?.pix ?? null });
      }
      return json({ state: "pending", regularizationId: begin.regularization_id, pix: pixView(recorded) });
    }
    return json({ state: "busy" }, 202);
  } catch {
    // No provider body, secrets, tokens or caught errors reach logs or responses.
    return json({ error: "Não foi possível concluir agora. Tente novamente." }, 500);
  }
});
