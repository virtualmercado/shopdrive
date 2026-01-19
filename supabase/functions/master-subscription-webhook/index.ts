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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook data
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

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

    if (topic !== "payment" && topic !== "merchant_order") {
      console.log("Ignoring non-payment webhook:", topic);
      return new Response(
        JSON.stringify({ received: true, message: `Topic ${topic} ignored` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find payment in our database
    const { data: payment, error: paymentError } = await supabase
      .from("master_subscription_payments")
      .select("*, master_subscriptions(*)")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();

    if (paymentError) {
      console.error("Error fetching payment:", paymentError);
    }

    if (!payment) {
      console.log("Payment not found in database:", paymentId);
      return new Response(
        JSON.stringify({ received: true, message: "Payment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found payment:", payment.id, "subscription:", payment.subscription_id);

    // Get gateway credentials to fetch payment details from MP
    const { data: gateway } = await supabase
      .from("master_payment_gateways")
      .select("mercadopago_access_token")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (!gateway?.mercadopago_access_token) {
      console.error("No gateway credentials found");
      return new Response(
        JSON.stringify({ error: "Gateway credentials not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
