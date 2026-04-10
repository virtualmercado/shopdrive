import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRACE_PERIOD_DAYS_MONTHLY = 7;
const GRACE_PERIOD_DAYS_ANNUAL = 14;

/**
 * Deactivate excess active products for a user, keeping only the oldest N.
 * Returns the number of products deactivated.
 */
async function deactivateExcessProducts(supabase: any, userId: string, maxActive: number): Promise<number> {
  // Get all active product IDs ordered by creation date
  const { data: activeProducts, error } = await supabase
    .from("products")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error || !activeProducts) {
    console.error("Error fetching active products for user", userId, error);
    return 0;
  }

  if (activeProducts.length <= maxActive) return 0;

  const idsToDeactivate = activeProducts.slice(maxActive).map((p: any) => p.id);

  const { error: updateError } = await supabase
    .from("products")
    .update({ is_active: false })
    .in("id", idsToDeactivate);

  if (updateError) {
    console.error("Error deactivating excess products:", updateError);
    return 0;
  }

  console.log(`Deactivated ${idsToDeactivate.length} excess products for user ${userId}`);
  return idsToDeactivate.length;
}

/**
 * Reactivate all products for a user after plan upgrade.
 */
async function reactivateAllProducts(supabase: any, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: true })
    .eq("user_id", userId)
    .eq("is_active", false)
    .select("id");

  if (error) {
    console.error("Error reactivating products:", error);
    return 0;
  }

  const count = data?.length || 0;
  if (count > 0) {
    console.log(`Reactivated ${count} products for user ${userId}`);
  }
  return count;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results: any[] = [];

    console.log("=== check-billing-status started ===", now.toISOString());

    // ─────────────────────────────────────────────────────
    // PHASE 1: Detect active subscriptions past current_period_end
    // These need to transition to past_due with a grace period
    // ─────────────────────────────────────────────────────
    const { data: overdueActive, error: err1 } = await supabase
      .from("master_subscriptions")
      .select("id, user_id, plan_id, billing_cycle, current_period_end, no_charge, grace_period_ends_at")
      .eq("status", "active")
      .neq("no_charge", true)
      .not("plan_id", "in", '("gratis","free")')
      .lt("current_period_end", now.toISOString());

    if (err1) {
      console.error("Error fetching overdue active subs:", err1);
    }

    for (const sub of overdueActive || []) {
      // Skip if already has grace period set (already handled)
      if (sub.grace_period_ends_at) continue;

      const isMonthly = sub.billing_cycle === "monthly";
      const graceDays = isMonthly ? GRACE_PERIOD_DAYS_MONTHLY : GRACE_PERIOD_DAYS_ANNUAL;
      const gracePeriodEnd = new Date(
        new Date(sub.current_period_end).getTime() + graceDays * 24 * 60 * 60 * 1000
      );

      console.log(`Sub ${sub.id}: active but past period end, transitioning to past_due. Grace until ${gracePeriodEnd.toISOString()}`);

      await supabase
        .from("master_subscriptions")
        .update({
          status: "past_due",
          grace_period_ends_at: gracePeriodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);

      await supabase.from("master_subscription_logs").insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        event_type: "subscription_past_due",
        event_description: `Assinatura vencida em ${sub.current_period_end}. Período de tolerância até ${gracePeriodEnd.toISOString()}.`,
        metadata: {
          currentPeriodEnd: sub.current_period_end,
          gracePeriodEnd: gracePeriodEnd.toISOString(),
          graceDays,
        },
      });

      results.push({
        subscriptionId: sub.id,
        userId: sub.user_id,
        action: "marked_past_due",
        gracePeriodEnd: gracePeriodEnd.toISOString(),
      });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 2: Check past_due subscriptions whose grace period has expired
    // These need to be downgraded to FREE
    // ─────────────────────────────────────────────────────
    const { data: expiredGrace, error: err2 } = await supabase
      .from("master_subscriptions")
      .select("id, user_id, plan_id, billing_cycle, grace_period_ends_at")
      .eq("status", "past_due")
      .neq("no_charge", true)
      .not("plan_id", "in", '("gratis","free")')
      .lt("grace_period_ends_at", now.toISOString());

    if (err2) {
      console.error("Error fetching expired grace subs:", err2);
    }

    for (const sub of expiredGrace || []) {
      console.log(`Sub ${sub.id}: grace period expired, downgrading to FREE from ${sub.plan_id}`);

      const previousPlanId = sub.plan_id;

      await supabase
        .from("master_subscriptions")
        .update({
          status: "active",
          plan_id: "gratis",
          previous_plan_id: previousPlanId,
          downgraded_at: now.toISOString(),
          downgrade_reason: "nonpayment",
          monthly_price: 0,
          total_amount: 0,
          updated_at: now.toISOString(),
          retry_count: 0,
          next_retry_at: null,
          grace_period_ends_at: null,
          last_decline_code: null,
          last_decline_message: null,
          decline_type: null,
          requires_card_update: false,
        })
        .eq("id", sub.id);

      await supabase.from("master_subscription_logs").insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        event_type: "subscription_downgraded",
        event_description: `Downgrade automático para plano Grátis por inadimplência. Plano anterior: ${previousPlanId}`,
        metadata: {
          previousPlanId,
          reason: "nonpayment",
          gracePeriodEnd: sub.grace_period_ends_at,
        },
      });

      // Deactivate excess products (keep only first 20 by created_at ASC)
      const deactivatedCount = await deactivateExcessProducts(supabase, sub.user_id, 20);

      results.push({
        subscriptionId: sub.id,
        userId: sub.user_id,
        action: "downgraded_to_free",
        previousPlan: previousPlanId,
        productsDeactivated: deactivatedCount,
      });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 3: Also detect active subs that already have grace_period_ends_at
    // set (from webhook) but are still marked active with paid plan
    // and grace period has expired
    // ─────────────────────────────────────────────────────
    const { data: activeWithExpiredGrace, error: err3 } = await supabase
      .from("master_subscriptions")
      .select("id, user_id, plan_id, grace_period_ends_at")
      .eq("status", "active")
      .neq("no_charge", true)
      .not("plan_id", "in", '("gratis","free")')
      .not("grace_period_ends_at", "is", null)
      .lt("grace_period_ends_at", now.toISOString());

    if (err3) {
      console.error("Error fetching active with expired grace:", err3);
    }

    for (const sub of activeWithExpiredGrace || []) {
      console.log(`Sub ${sub.id}: active with expired grace, downgrading`);

      const previousPlanId = sub.plan_id;

      await supabase
        .from("master_subscriptions")
        .update({
          status: "active",
          plan_id: "gratis",
          previous_plan_id: previousPlanId,
          downgraded_at: now.toISOString(),
          downgrade_reason: "nonpayment",
          monthly_price: 0,
          total_amount: 0,
          updated_at: now.toISOString(),
          retry_count: 0,
          next_retry_at: null,
          grace_period_ends_at: null,
        })
        .eq("id", sub.id);

      await supabase.from("master_subscription_logs").insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        event_type: "subscription_downgraded",
        event_description: `Downgrade automático (cleanup). Plano anterior: ${previousPlanId}`,
        metadata: { previousPlanId, reason: "nonpayment_cleanup" },
      });

      // Deactivate excess products
      const deactivatedCount = await deactivateExcessProducts(supabase, sub.user_id, 20);

      results.push({
        subscriptionId: sub.id,
        userId: sub.user_id,
        action: "downgraded_cleanup",
        previousPlan: previousPlanId,
        productsDeactivated: deactivatedCount,
      });
    }

    console.log("=== check-billing-status completed ===", JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("check-billing-status error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Billing check failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
