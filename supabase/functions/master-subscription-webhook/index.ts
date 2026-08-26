import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hard decline codes - these should NOT be retried automatically
const HARD_DECLINE_CODES = [
  "cc_rejected_card_disabled",
  "cc_rejected_card_type_not_allowed",
  "cc_rejected_duplicated_payment",
  "cc_rejected_high_risk",
  "cc_rejected_max_attempts",
  "cc_rejected_other_reason",
  "cc_rejected_blacklist",
  "cc_rejected_bad_filled_card_number",
  "cc_rejected_bad_filled_date",
  "cc_rejected_bad_filled_security_code",
  "cc_rejected_bad_filled_other",
  "cc_amount_rate_limit_exceeded",
  "expired_token",
  "invalid_installments",
  "invalid_payment_type",
];

function isHardDecline(statusDetail: string | null): boolean {
  if (!statusDetail) return false;
  return HARD_DECLINE_CODES.includes(statusDetail);
}

function getUserFriendlyMessage(statusDetail: string | null): string {
  switch (statusDetail) {
    case "cc_rejected_card_disabled":
      return "Cartão bloqueado ou desativado. Atualize os dados do cartão.";
    case "cc_rejected_insufficient_amount":
      return "Saldo insuficiente. Tente novamente ou atualize o cartão.";
    case "cc_rejected_bad_filled_card_number":
      return "Número do cartão incorreto. Atualize os dados do cartão.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta. Atualize os dados do cartão.";
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança incorreto. Tente novamente.";
    case "cc_rejected_high_risk":
      return "Pagamento recusado por segurança. Contate seu banco.";
    case "cc_rejected_call_for_authorize":
      return "Autorização necessária. Contate seu banco.";
    case "cc_rejected_max_attempts":
      return "Limite de tentativas excedido. Aguarde ou use outro cartão.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado detectado.";
    case "expired_token":
      return "Sessão expirada. Atualize os dados do cartão.";
    default:
      return "Pagamento recusado pelo emissor. Atualize seu cartão para evitar a suspensão do plano.";
  }
}

const GRACE_PERIOD_DAYS_MONTHLY = 7;
const GRACE_PERIOD_DAYS_ANNUAL = 14;

// Verify Mercado Pago webhook signature
async function verifyMercadoPagoSignature(
  req: Request,
  body: string,
  secret: string
): Promise<boolean> {
  try {
    const xSignature = req.headers.get("x-signature");
    const xRequestId = req.headers.get("x-request-id");

    if (!xSignature || !xRequestId) {
      console.log("Missing signature headers");
      return false;
    }

    const parts = xSignature.split(",");
    const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
    const hash = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!ts || !hash) {
      console.log("Invalid signature format");
      return false;
    }

    const bodyJson = JSON.parse(body);
    const dataId = bodyJson.data?.id?.toString() || "";
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
    const calculatedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = calculatedHash === hash;
    if (!isValid) {
      console.log("Signature mismatch:", { expected: hash, calculated: calculatedHash });
    }
    return isValid;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read body as text for signature verification
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    console.log("Webhook received:", JSON.stringify(body));

    // Verify webhook signature using master gateway secret
    const { data: gateway } = await supabase
      .from("master_payment_gateways")
      .select("mercadopago_webhook_secret, mercadopago_access_token")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (gateway?.mercadopago_webhook_secret) {
      const signatureValid = await verifyMercadoPagoSignature(
        req,
        bodyText,
        gateway.mercadopago_webhook_secret
      );

      if (!signatureValid) {
        console.error("Invalid Mercado Pago webhook signature - rejecting");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Webhook signature verified successfully");
    } else {
      console.error("No webhook secret configured for master gateway - rejecting unsigned webhook");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, data, action } = body;

    // Mercado Pago sends different formats
    let paymentId: string | null = null;
    let topic = type || body.topic;

    if (data?.id) {
      paymentId = data.id.toString();
    } else if (body.id && body.topic === "payment") {
      paymentId = body.id.toString();
    } else if (body.resource) {
      const resourceParts = body.resource.split("/");
      paymentId = resourceParts[resourceParts.length - 1];
    }

    console.log("Parsed webhook:", { topic, paymentId, action });

    if (!paymentId && topic !== "test") {
      console.log("No payment ID found, ignoring webhook");
      return new Response(
        JSON.stringify({ received: true, message: "No payment ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle test webhook
    if (topic === "test" || action === "test") {
      console.log("Test webhook received");
      return new Response(
        JSON.stringify({ received: true, message: "Test webhook acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUBSCRIPTION_TOPICS = ["subscription_preapproval", "preapproval", "subscription_preapproval_plan"];
    const AUTHORIZED_PAYMENT_TOPICS = ["subscription_authorized_payment", "authorized_payment"];

    if (!gateway?.mercadopago_access_token) {
      console.error("No gateway access token found");
      return new Response(
        JSON.stringify({ error: "Gateway credentials not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpAuth = { "Authorization": `Bearer ${gateway.mercadopago_access_token}` };
    let preapprovalIdFromWebhook: string | null = null;

    // ── Tópico de assinatura recorrente (preapproval) ──
    if (SUBSCRIPTION_TOPICS.includes(topic)) {
      const preapprovalResp = await fetch(`https://api.mercadopago.com/preapproval/${paymentId}`, { headers: mpAuth });
      if (!preapprovalResp.ok) {
        console.error("Error fetching preapproval:", await preapprovalResp.text());
        return new Response(
          JSON.stringify({ received: true, message: "Preapproval fetch failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const preapproval = await preapprovalResp.json();
      console.log("Preapproval status:", preapproval.status);

      const { data: sub } = await supabase
        .from("master_subscriptions")
        .select("*")
        .eq("gateway_subscription_id", paymentId)
        .maybeSingle();

      if (sub) {
        const update: any = { updated_at: new Date().toISOString() };
        if (preapproval.status === "cancelled") {
          update.status = "cancelled";
          update.cancelled_at = new Date().toISOString();
        } else if (preapproval.status === "paused") {
          update.status = "past_due";
        }
        if (preapproval.next_payment_date) {
          update.current_period_end = new Date(preapproval.next_payment_date).toISOString();
        }
        await supabase.from("master_subscriptions").update(update).eq("id", sub.id);

        await supabase.from("master_subscription_logs").insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          event_type: "preapproval_updated",
          event_description: `Assinatura recorrente atualizada no gateway (status ${preapproval.status})`,
          metadata: { preapprovalId: paymentId, preapprovalStatus: preapproval.status }
        });
      }

      return new Response(
        JSON.stringify({ received: true, topic, preapprovalStatus: preapproval.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Tópico de pagamento gerado pela assinatura recorrente ──
    if (AUTHORIZED_PAYMENT_TOPICS.includes(topic)) {
      const apResp = await fetch(`https://api.mercadopago.com/authorized_payments/${paymentId}`, { headers: mpAuth });
      if (!apResp.ok) {
        console.error("Error fetching authorized payment:", await apResp.text());
        return new Response(
          JSON.stringify({ received: true, message: "Authorized payment fetch failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const authorizedPayment = await apResp.json();
      preapprovalIdFromWebhook = authorizedPayment.preapproval_id?.toString() || null;
      const realPaymentId = authorizedPayment.payment?.id?.toString() || null;
      console.log("Authorized payment:", { preapprovalIdFromWebhook, realPaymentId, status: authorizedPayment.status });

      if (!realPaymentId) {
        return new Response(
          JSON.stringify({ received: true, message: "Authorized payment without payment id yet" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      paymentId = realPaymentId;
    } else if (topic !== "payment" && topic !== "merchant_order") {
      console.log("Ignoring non-payment webhook:", topic);
      return new Response(
        JSON.stringify({ received: true, message: `Topic ${topic} ignored` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Dedup: check if this webhook event was already processed
    const eventId = body.id?.toString() || body.data?.id?.toString() || "";
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from("webhook_events")
        .select("id")
        .eq("gateway", "mercadopago_master")
        .eq("gateway_event_id", eventId)
        .maybeSingle();

      if (existingEvent) {
        console.log("Duplicate webhook event, skipping:", eventId);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record this event
      await supabase.from("webhook_events").insert({
        gateway: "mercadopago_master",
        gateway_event_id: eventId,
        event_type: topic,
        payload: body,
      });
    }

    // Find payment in our database
    let { data: payment, error: paymentError } = await supabase
      .from("master_subscription_payments")
      .select("*, master_subscriptions(*)")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();

    if (paymentError) {
      console.error("Error fetching payment:", paymentError);
    }

    // Pagamento gerado pela assinatura recorrente: vincular à tentativa aberta (idempotente)
    if (!payment && preapprovalIdFromWebhook) {
      const { data: sub } = await supabase
        .from("master_subscriptions")
        .select("*")
        .eq("gateway_subscription_id", preapprovalIdFromWebhook)
        .maybeSingle();

      if (sub) {
        const { data: openPayment } = await supabase
          .from("master_subscription_payments")
          .select("*")
          .eq("subscription_id", sub.id)
          .is("gateway_payment_id", null)
          .in("status", ["pending", "in_process", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openPayment) {
          const { data: adopted } = await supabase
            .from("master_subscription_payments")
            .update({ gateway_payment_id: paymentId })
            .eq("id", openPayment.id)
            .select("*, master_subscriptions(*)")
            .single();
          payment = adopted;
          console.log("Adopted open payment row for preapproval payment:", openPayment.id);
        } else {
          const { data: created } = await supabase
            .from("master_subscription_payments")
            .insert({
              subscription_id: sub.id,
              user_id: sub.user_id,
              amount: sub.monthly_price || sub.total_amount,
              payment_method: "credit_card",
              gateway: "mercadopago",
              status: "pending",
              gateway_payment_id: paymentId,
              idempotency_key: `preapproval-${preapprovalIdFromWebhook}-${paymentId}`,
            })
            .select("*, master_subscriptions(*)")
            .single();
          payment = created;
          console.log("Created payment row for recurring charge:", paymentId);
        }
      }
    }

    if (!payment) {
      console.log("Payment not found in database:", paymentId);
      return new Response(
        JSON.stringify({ received: true, message: "Payment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found payment:", payment.id, "subscription:", payment.subscription_id);


    // Fetch current payment status from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
      },
    });

    if (!mpResponse.ok) {
      console.error("Error fetching MP payment:", await mpResponse.text());
      return new Response(
        JSON.stringify({ error: "Error fetching payment from MP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpPayment = await mpResponse.json();
    console.log("MP payment status:", mpPayment.status, mpPayment.status_detail);

    const previousStatus = payment.status;
    let newPaymentStatus = payment.status;
    let newSubscriptionStatus = payment.master_subscriptions?.status;
    
    const statusDetail = mpPayment.status_detail || null;
    const hardDecline = isHardDecline(statusDetail);
    const userMessage = getUserFriendlyMessage(statusDetail);
    const isMonthly = payment.master_subscriptions?.billing_cycle === "monthly";
    const gracePeriodDays = isMonthly ? GRACE_PERIOD_DAYS_MONTHLY : GRACE_PERIOD_DAYS_ANNUAL;

    // Map MP status to our status
    switch (mpPayment.status) {
      case "approved":
        newPaymentStatus = "paid";
        newSubscriptionStatus = "active";
        break;
      case "pending":
      case "in_process":
        newPaymentStatus = "pending";
        break;
      case "rejected":
        newPaymentStatus = "failed";
        // Use past_due for both monthly and annual (not cancelled immediately)
        newSubscriptionStatus = "past_due";
        break;
      case "cancelled":
        newPaymentStatus = "cancelled";
        newSubscriptionStatus = "cancelled";
        break;
      case "refunded":
        newPaymentStatus = "refunded";
        break;
    }

    console.log("Status update:", { previousStatus, newPaymentStatus, newSubscriptionStatus, hardDecline });

    // Update payment record with detailed info
    const paymentUpdate: any = {
      status: newPaymentStatus,
      gateway_status: mpPayment.status,
      gateway_response: mpPayment,
      updated_at: new Date().toISOString(),
      decline_code: statusDetail,
      decline_type: newPaymentStatus === "failed" ? (hardDecline ? "hard" : "soft") : null,
      user_message: newPaymentStatus === "failed" ? userMessage : null,
      attempt_number: (payment.attempt_number || 0) + 1,
    };

    if (mpPayment.status === "approved" && !payment.paid_at) {
      paymentUpdate.paid_at = mpPayment.date_approved || new Date().toISOString();
    }

    if (mpPayment.status === "refunded" && !payment.refunded_at) {
      paymentUpdate.refunded_at = new Date().toISOString();
    }

    await supabase
      .from("master_subscription_payments")
      .update(paymentUpdate)
      .eq("id", payment.id);

    // Sync invoice status based on payment gateway ID
    if (paymentId) {
      const invoiceStatus = newPaymentStatus === "paid" ? "paid" 
        : newPaymentStatus === "failed" ? "rejected"
        : newPaymentStatus === "cancelled" ? "cancelled"
        : newPaymentStatus === "refunded" ? "refunded"
        : "pending";
      
      const invoiceUpdate: any = { status: invoiceStatus };
      if (invoiceStatus === "paid") {
        invoiceUpdate.paid_at = mpPayment.date_approved || new Date().toISOString();
      }

      const { data: matchedInvoices } = await supabase
        .from("invoices")
        .update(invoiceUpdate)
        .eq("mp_payment_id", paymentId)
        .select("id");

      // Cobranças da assinatura recorrente não têm mp_payment_id previamente: vincular a fatura aberta
      if (!matchedInvoices?.length && payment.subscription_id) {
        const { data: openInvoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("subscription_id", payment.subscription_id)
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openInvoice?.id) {
          await supabase
            .from("invoices")
            .update({ ...invoiceUpdate, mp_payment_id: paymentId })
            .eq("id", openInvoice.id);
        }
      }


    // Update subscription if status changed
    if (newSubscriptionStatus && newSubscriptionStatus !== payment.master_subscriptions?.status) {
      const now = new Date();
      const subscriptionUpdate: any = {
        status: newSubscriptionStatus,
        updated_at: now.toISOString(),
      };

      if (newSubscriptionStatus === "active") {
        subscriptionUpdate.started_at = payment.master_subscriptions?.started_at || now.toISOString();
        // Clear decline fields on success
        subscriptionUpdate.decline_type = null;
        subscriptionUpdate.last_decline_code = null;
        subscriptionUpdate.last_decline_message = null;
        subscriptionUpdate.next_retry_at = null;
        subscriptionUpdate.requires_card_update = false;
        subscriptionUpdate.retry_count = 0;
        subscriptionUpdate.grace_period_ends_at = null;
        subscriptionUpdate.downgrade_reason = null;

        // Restore previous plan if account was downgraded
        const previousPlan = payment.master_subscriptions?.previous_plan_id;
        if (previousPlan && payment.master_subscriptions?.plan_id === "gratis") {
          subscriptionUpdate.plan_id = previousPlan;
          subscriptionUpdate.previous_plan_id = null;
          subscriptionUpdate.downgraded_at = null;
          console.log(`Reactivating plan: gratis -> ${previousPlan}`);
        }

        // Promote pending_plan_id -> plan_id (cloned/pending stores)
        const pendingPlan = (payment.master_subscriptions as any)?.pending_plan_id;
        if (pendingPlan) {
          subscriptionUpdate.plan_id = pendingPlan;
          subscriptionUpdate.pending_plan_id = null;
          console.log(`Promoting pending plan -> ${pendingPlan}`);
        }

        // Determine effective new plan and reactivate products that were
        // disabled by plan limit. Use ONLY the inactive_reason='plan_limit' marker
        // so manual deactivations stay untouched.
        const effectivePlanId =
          subscriptionUpdate.plan_id || payment.master_subscriptions?.plan_id;
        const planLimitsMap: Record<string, number | null> = {
          gratis: 20,
          free: 20,
          pro: 150,
          premium: null, // unlimited
        };
        const maxProducts =
          effectivePlanId in planLimitsMap ? planLimitsMap[effectivePlanId] : 20;

        // Only attempt reactivation when upgrading to a paid plan
        if (effectivePlanId && effectivePlanId !== "gratis" && effectivePlanId !== "free") {
          const { data: reactivatedCount, error: reactErr } = await supabase.rpc(
            "reactivate_products_after_upgrade",
            { p_user_id: payment.user_id, p_max_products: maxProducts }
          );
          if (reactErr) {
            console.error("Error reactivating products after upgrade:", reactErr);
          } else {
            console.log(
              `Reactivated ${reactivatedCount ?? 0} plan-limited products for user ${payment.user_id} (plan=${effectivePlanId}, max=${maxProducts ?? "∞"})`
            );
          }
        }
      }

      if (newSubscriptionStatus === "past_due") {
        subscriptionUpdate.decline_type = hardDecline ? "hard" : "soft";
        subscriptionUpdate.last_decline_code = statusDetail;
        subscriptionUpdate.last_decline_message = userMessage;
        subscriptionUpdate.requires_card_update = hardDecline;
        
        // Set grace period if not already set
        if (!payment.master_subscriptions?.grace_period_ends_at) {
          const gracePeriodEnd = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
          subscriptionUpdate.grace_period_ends_at = gracePeriodEnd.toISOString();
        }
        
        // Calculate next retry for soft decline
        if (!hardDecline) {
          const retryCount = payment.master_subscriptions?.retry_count || 0;
          const retrySchedule = isMonthly ? [0, 1, 3, 6] : [0, 2, 5, 9, 12, 14];
          const nextRetryDay = retrySchedule[retryCount + 1] ?? null;
          
          if (nextRetryDay !== null) {
            const graceStart = payment.master_subscriptions?.grace_period_ends_at 
              ? new Date(new Date(payment.master_subscriptions.grace_period_ends_at).getTime() - gracePeriodDays * 24 * 60 * 60 * 1000)
              : now;
            subscriptionUpdate.next_retry_at = new Date(graceStart.getTime() + nextRetryDay * 24 * 60 * 60 * 1000).toISOString();
          }
        }
      }

      if (newSubscriptionStatus === "cancelled" && !payment.master_subscriptions?.cancelled_at) {
        subscriptionUpdate.cancelled_at = now.toISOString();
      }

      await supabase
        .from("master_subscriptions")
        .update(subscriptionUpdate)
        .eq("id", payment.subscription_id);

      // Log the status change
      await supabase.from("master_subscription_logs").insert({
        subscription_id: payment.subscription_id,
        user_id: payment.user_id,
        payment_id: payment.id,
        event_type: `subscription_${newSubscriptionStatus}`,
        event_description: `Status alterado de ${payment.master_subscriptions?.status} para ${newSubscriptionStatus}`,
        metadata: {
          previousStatus: payment.master_subscriptions?.status,
          newStatus: newSubscriptionStatus,
          mpStatus: mpPayment.status,
          mpStatusDetail: statusDetail,
          declineType: hardDecline ? "hard" : "soft",
          userMessage,
        }
      });
    }

    // Log payment status change
    if (previousStatus !== newPaymentStatus) {
      await supabase.from("master_subscription_logs").insert({
        subscription_id: payment.subscription_id,
        user_id: payment.user_id,
        payment_id: payment.id,
        event_type: `payment_${newPaymentStatus}`,
        event_description: `Pagamento ${newPaymentStatus === "paid" ? "confirmado" : newPaymentStatus}`,
        metadata: {
          previousStatus,
          newStatus: newPaymentStatus,
          mpPaymentId: paymentId,
          mpStatus: mpPayment.status,
          mpStatusDetail: statusDetail,
          userMessage: newPaymentStatus === "failed" ? userMessage : null,
        }
      });
    }

    console.log("Webhook processed successfully");

    return new Response(
      JSON.stringify({ 
        received: true, 
        paymentId: payment.id,
        subscriptionId: payment.subscription_id,
        newStatus: newPaymentStatus,
        declineType: hardDecline ? "hard" : "soft",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook processing error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
