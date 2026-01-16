import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry schedule: day 0, +2, +5, +7
const RETRY_SCHEDULE_DAYS = [0, 2, 5, 7];
const MAX_RETRY_COUNT = 4;
const GRACE_PERIOD_DAYS = 7;

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
    // - status = 'inadimplent'
    // - billing_cycle = 'monthly'
    // - retry_count < MAX_RETRY_COUNT
    // - last_retry_at is null OR enough time has passed based on retry schedule
    const { data: subscriptions, error: subError } = await supabase
      .from("master_subscriptions")
      .select(`
        *,
        profiles:user_id (email, full_name, cpf_cnpj)
      `)
      .eq("status", "inadimplent")
      .eq("billing_cycle", "monthly")
      .lt("retry_count", MAX_RETRY_COUNT);

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
      const retryCount = subscription.retry_count || 0;
      const lastRetryAt = subscription.last_retry_at ? new Date(subscription.last_retry_at) : null;
      
      // Calculate when next retry should happen
      const graceStart = subscription.grace_period_ends_at 
        ? new Date(new Date(subscription.grace_period_ends_at).getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
        : new Date(subscription.current_period_end);
      
      const nextRetryDay = RETRY_SCHEDULE_DAYS[retryCount] || RETRY_SCHEDULE_DAYS[RETRY_SCHEDULE_DAYS.length - 1];
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
        : new Date(graceStart.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

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

      // Attempt to charge the card (if we have a saved card token)
      if (!subscription.card_token && !subscription.gateway_customer_id) {
        console.log(`Subscription ${subscription.id}: no saved card, cannot retry`);
        
        // Update retry count
        await supabase
          .from("master_subscriptions")
          .update({
            retry_count: retryCount + 1,
            last_retry_at: now.toISOString(),
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

      // Create payment
      const idempotencyKey = `retry-${subscription.id}-${retryCount}-${Date.now()}`;
      
      // Note: In a real implementation, you would use a saved card token
      // For now, we'll log the attempt and update retry count
      console.log(`Subscription ${subscription.id}: attempting retry #${retryCount + 1}`);

      // For monthly recurring with saved card, we would call MP here
      // This is a placeholder for the actual card charge logic
      // In production, you'd use the gateway_customer_id to create a new payment

      // Update retry count
      await supabase
        .from("master_subscriptions")
        .update({
          retry_count: retryCount + 1,
          last_retry_at: now.toISOString(),
          grace_period_ends_at: gracePeriodEnd.toISOString(),
        })
        .eq("id", subscription.id);

      await supabase.from("master_subscription_logs").insert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        event_type: "payment_retry_attempted",
        event_description: `Tentativa de cobrança #${retryCount + 1}`,
        metadata: { retryCount: retryCount + 1, scheduledDay: nextRetryDay }
      });

      results.push({
        subscriptionId: subscription.id,
        action: "retry_attempted",
        retryCount: retryCount + 1,
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
