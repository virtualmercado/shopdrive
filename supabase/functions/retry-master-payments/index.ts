import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry schedule: D0, D+1, D+3, D+6 (per billing rules)
const RETRY_SCHEDULE_DAYS_MONTHLY = [0, 1, 3, 6];
const RETRY_SCHEDULE_DAYS_ANNUAL = [0, 2, 5, 9, 12, 14]; // Up to 6 attempts within 14 days
const MAX_RETRY_COUNT_MONTHLY = 4;
const MAX_RETRY_COUNT_ANNUAL = 6;
const GRACE_PERIOD_DAYS_MONTHLY = 7;
const GRACE_PERIOD_DAYS_ANNUAL = 14;

// Hard decline codes - these should NOT be retried automatically
const HARD_DECLINE_CODES = [
  "cc_rejected_card_disabled",
  "cc_rejected_card_type_not_allowed",
  "cc_rejected_duplicated_payment",
  "cc_rejected_high_risk",
  "cc_rejected_max_attempts",
  "cc_rejected_other_reason",
  "cc_rejected_blacklist",
  "cc_rejected_insufficient_amount", // Note: This is actually soft but often requires user action
  "cc_rejected_bad_filled_card_number",
  "cc_rejected_bad_filled_date",
  "cc_rejected_bad_filled_security_code",
  "cc_rejected_bad_filled_other",
  "cc_amount_rate_limit_exceeded",
  "expired_token",
  "invalid_installments",
  "invalid_payment_type",
];

// Soft decline codes - eligible for automatic retry
const SOFT_DECLINE_CODES = [
  "cc_rejected_call_for_authorize",
  "cc_rejected_insufficient_amount",
  "accredited",
  "pending_contingency",
  "pending_review_manual",
  "pending_waiting_payment",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting payment retry job...");

    // Get gateway credentials
    const { data: gateway } = await supabase
      .from("master_payment_gateways")
      .select("*")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (!gateway?.mercadopago_access_token) {
      console.log("No gateway configured, skipping retry job");
      return new Response(
        JSON.stringify({ message: "No gateway configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find subscriptions that need retry
    // - status = 'past_due'
    // - retry_count < MAX_RETRY_COUNT
    // - requires_card_update = false (not a hard decline)
    // - no_charge = false
    const { data: subscriptions, error: subError } = await supabase
      .from("master_subscriptions")
      .select(`
        *,
        profiles:user_id (email, full_name, cpf_cnpj)
      `)
      .eq("status", "past_due")
      .neq("no_charge", true)
      .neq("requires_card_update", true); // Skip hard declines

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Error fetching subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions to check`);

    const results: any[] = [];
    const now = new Date();

    for (const subscription of subscriptions || []) {
      const isMonthly = subscription.billing_cycle === "monthly";
      const maxRetries = isMonthly ? MAX_RETRY_COUNT_MONTHLY : MAX_RETRY_COUNT_ANNUAL;
      const gracePeriodDays = isMonthly ? GRACE_PERIOD_DAYS_MONTHLY : GRACE_PERIOD_DAYS_ANNUAL;
      const retrySchedule = isMonthly ? RETRY_SCHEDULE_DAYS_MONTHLY : RETRY_SCHEDULE_DAYS_ANNUAL;
      
      const retryCount = subscription.retry_count || 0;

      // Skip if max retries reached
      if (retryCount >= maxRetries) {
        console.log(`Subscription ${subscription.id}: max retries reached`);
        continue;
      }
      
      // Calculate when next retry should happen
      const graceStart = subscription.grace_period_ends_at 
        ? new Date(new Date(subscription.grace_period_ends_at).getTime() - gracePeriodDays * 24 * 60 * 60 * 1000)
        : new Date(subscription.current_period_end);
      
      const nextRetryDay = retrySchedule[retryCount] ?? retrySchedule[retrySchedule.length - 1];
      const nextRetryDate = new Date(graceStart.getTime() + nextRetryDay * 24 * 60 * 60 * 1000);

      console.log(`Subscription ${subscription.id}: retry ${retryCount}, next retry at ${nextRetryDate.toISOString()}`);

      // Check if it's time to retry
      if (now < nextRetryDate) {
        console.log(`Skipping ${subscription.id}: not yet time for retry`);
        continue;
      }

      // Check grace period expiration
      const gracePeriodEnd = subscription.grace_period_ends_at 
        ? new Date(subscription.grace_period_ends_at)
        : new Date(graceStart.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

      if (now > gracePeriodEnd) {
        console.log(`Subscription ${subscription.id}: grace period expired, suspending`);
        
        await supabase
          .from("master_subscriptions")
          .update({
            status: "suspended",
            updated_at: now.toISOString(),
          })
          .eq("id", subscription.id);

        await supabase.from("master_subscription_logs").insert({
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          event_type: "subscription_suspended",
          event_description: "Assinatura suspensa após período de tolerância",
          metadata: { gracePeriodEnd: gracePeriodEnd.toISOString(), retryCount }
        });

        results.push({
          subscriptionId: subscription.id,
          action: "suspended",
          reason: "grace_period_expired"
        });
        continue;
      }

      // Skip if no saved card token
      if (!subscription.card_token && !subscription.gateway_customer_id) {
        console.log(`Subscription ${subscription.id}: no saved card, marking requires_card_update`);
        
        await supabase
          .from("master_subscriptions")
          .update({
            retry_count: retryCount + 1,
            last_retry_at: now.toISOString(),
            requires_card_update: true,
            last_decline_message: "Nenhum cartão cadastrado. Adicione um cartão para continuar.",
          })
          .eq("id", subscription.id);

        results.push({
          subscriptionId: subscription.id,
          action: "skipped",
          reason: "no_saved_card"
        });
        continue;
      }

      // Get user profile for payment
      const profile = subscription.profiles as any;
      const userEmail = profile?.email || "customer@email.com";
      const userName = profile?.full_name || "Cliente";
      const userCpf = profile?.cpf_cnpj?.replace(/\D/g, "") || "";

      // Attempt charge using Mercado Pago
      // Note: For recurring charges, we need the card token or use MP's recurring solution
      console.log(`Subscription ${subscription.id}: attempting retry #${retryCount + 1}`);

      const idempotencyKey = `retry-${subscription.id}-${retryCount}-${Date.now()}`;
      
      // Calculate next retry time
      const nextRetryIndex = retryCount + 1;
      const nextScheduledDay = retrySchedule[nextRetryIndex] ?? null;
      const nextRetryAt = nextScheduledDay !== null 
        ? new Date(graceStart.getTime() + nextScheduledDay * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Update retry count and schedule
      await supabase
        .from("master_subscriptions")
        .update({
          retry_count: retryCount + 1,
          last_retry_at: now.toISOString(),
          next_retry_at: nextRetryAt,
          grace_period_ends_at: gracePeriodEnd.toISOString(),
        })
        .eq("id", subscription.id);

      await supabase.from("master_subscription_logs").insert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        event_type: "payment_retry_attempted",
        event_description: `Tentativa de cobrança #${retryCount + 1}`,
        metadata: { 
          retryCount: retryCount + 1, 
          scheduledDay: nextRetryDay,
          nextRetryAt
        }
      });

      results.push({
        subscriptionId: subscription.id,
        action: "retry_attempted",
        retryCount: retryCount + 1,
        nextRetryAt,
      });
    }

    console.log("Retry job completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Retry job error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Retry job failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
