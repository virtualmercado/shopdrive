import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBearerToken, isValidJobTokenFormat } from "../_shared/authorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRACE_PERIOD_DAYS_MONTHLY = 7;
const GRACE_PERIOD_DAYS_ANNUAL = 14;

// Atomic, re-checked downgrade + active-product limit for one subscription (server role only).
async function applyNonpaymentDowngrade(supabase: any, subscriptionId: string): Promise<any> {
  const { data, error } = await supabase.rpc("apply_nonpayment_downgrade", { p_subscription_id: subscriptionId });
  if (error) {
    console.error("Error applying nonpayment downgrade:", { subscriptionId, code: error.code, message: error.message });
    return null;
  }
  return data;
}

async function isEffectiveSubscription(supabase: any, userId: string, subscriptionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_effective_store_plan", { p_store_id: userId });
  if (error) {
    console.error("Error resolving effective subscription", { userId, subscriptionId, error });
    return false;
  }

  return data?.subscriptionId === subscriptionId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization: this function mutates subscriptions platform-wide and must
    // never be callable anonymously. Only the internal scheduler token or a
    // Master/admin JWT are accepted. Fail closed.
    const jobToken = req.headers.get("x-internal-job-token") ?? "";
    let authorized = false;
    if (isValidJobTokenFormat(jobToken)) {
      const { data: ok, error: jobErr } = await supabase.rpc("verify_internal_job_token", {
        p_job: "check-billing-status",
        p_token: jobToken,
      });
      authorized = !jobErr && ok === true;
    }
    if (!authorized) {
      const bearer = extractBearerToken(req);
      if (bearer) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: claimsData } = await authClient.auth.getClaims(bearer);
        const callerId = claimsData?.claims?.sub as string | undefined;
        if (callerId) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: callerId,
            _role: "admin",
          });
          authorized = isAdmin === true;
        }
      }
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      if (!(await isEffectiveSubscription(supabase, sub.user_id, sub.id))) {
        console.log("Skipping stale overdue subscription", { subscriptionId: sub.id, userId: sub.user_id, planId: sub.plan_id });
        continue;
      }

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

    // PHASE 1b: past_due sem tolerância (ex.: pausada no gateway) — nunca plano pago para sempre.
    // Usa o fim do período pago já gravado; sem data confiável, só alerta (não inventa data).
    const { data: pastDueNoGrace } = await supabase
      .from("master_subscriptions")
      .select("id, user_id, billing_cycle, current_period_end")
      .eq("status", "past_due")
      .is("grace_period_ends_at", null)
      .neq("no_charge", true);
    for (const sub of pastDueNoGrace || []) {
      if (!sub.current_period_end) {
        // Sem data confiável: não inventa vencimento; o resolver já não concede plano pago. Revisão manual (1 alerta por assinatura).
        console.error("PAUSED_WITHOUT_RELIABLE_PERIOD_END", { subscriptionId: sub.id });
        const { count } = await supabase.from("master_subscription_logs").select("id", { count: "exact", head: true })
          .eq("subscription_id", sub.id).eq("event_type", "PAUSED_WITHOUT_RELIABLE_PERIOD_END");
        if (!count) {
          await supabase.from("master_subscription_logs").insert({
            subscription_id: sub.id, user_id: sub.user_id, event_type: "PAUSED_WITHOUT_RELIABLE_PERIOD_END",
            event_description: "Revisão manual: assinatura pausada/inadimplente sem data financeira confiável; sem direito a plano pago.",
            metadata: { manual_review: true, store_id: sub.user_id, subscription_id: sub.id, reason: "PAUSED_WITHOUT_RELIABLE_PERIOD_END" },
          });
        }
        results.push({ subscriptionId: sub.id, action: "manual_review", reason: "PAUSED_WITHOUT_RELIABLE_PERIOD_END" });
        continue;
      }
      const graceDays = sub.billing_cycle === "annual" ? GRACE_PERIOD_DAYS_ANNUAL : GRACE_PERIOD_DAYS_MONTHLY;
      const graceEnd = new Date(new Date(sub.current_period_end).getTime() + graceDays * 86400000).toISOString();
      await supabase.from("master_subscriptions").update({ grace_period_ends_at: graceEnd, updated_at: now.toISOString() }).eq("id", sub.id);
      results.push({ subscriptionId: sub.id, action: "grace_set_for_past_due", gracePeriodEnd: graceEnd });
    }

    // Transições MARCA agendadas (PIX/anual): vencimento e expiração.
    const { data: marcaProc } = await supabase.rpc("process_marca_scheduled_upgrades" as any);
    if (marcaProc) results.push({ action: "marca_scheduled_upgrades", ...marcaProc });



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

    // The resolver no longer returns expired-grace subscriptions, so no isEffectiveSubscription guard here:
    // apply_nonpayment_downgrade locks and re-checks (latest subscription, payment, linked store) itself.
    for (const sub of expiredGrace || []) {
      const r = await applyNonpaymentDowngrade(supabase, sub.id);
      if (!r?.applied) {
        if (r?.reason !== "superseded") console.log("Nonpayment downgrade skipped", { subscriptionId: sub.id, reason: r?.reason ?? "error" });
        continue;
      }
      results.push({
        subscriptionId: sub.id,
        userId: sub.user_id,
        action: "downgraded_to_free",
        previousPlan: r.previousPlan,
        productsDeactivated: r.productsDeactivated,
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
      const r = await applyNonpaymentDowngrade(supabase, sub.id);
      if (!r?.applied) {
        if (r?.reason !== "superseded") console.log("Nonpayment cleanup skipped", { subscriptionId: sub.id, reason: r?.reason ?? "error" });
        continue;
      }
      results.push({
        subscriptionId: sub.id,
        userId: sub.user_id,
        action: "downgraded_cleanup",
        previousPlan: r.previousPlan,
        productsDeactivated: r.productsDeactivated,
      });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 4: Linked MARCA secondary stores have no subscription of their own to downgrade.
    // When one resolves to a limited plan (own paid period over and primary MARCA lapsed),
    // apply the same active-product limit. One store per call (one store lock per transaction).
    // ─────────────────────────────────────────────────────
    const { data: secondaries, error: err4 } = await supabase
      .from("brand_account_owned_stores")
      .select("store_profile_id")
      .eq("store_role", "secondary");
    if (err4) console.error("Error fetching linked secondary stores:", { code: err4.code, message: err4.message });

    for (const row of secondaries || []) {
      const { data: r, error } = await supabase.rpc("apply_lapsed_secondary_plan_limit", { p_store_id: row.store_profile_id });
      if (error) {
        console.error("Error applying secondary plan limit:", { storeId: row.store_profile_id, code: error.code, message: error.message });
        continue;
      }
      if (r?.applied) {
        results.push({ userId: row.store_profile_id, action: "secondary_plan_limit", plan: r.plan, productsDeactivated: r.productsDeactivated });
      }
    }

    // No continuous product-limit enforcement beyond the branches above. Product deactivation is only
    // allowed inside the confirmed downgrade/secondary-limit branches or by explicit manual/admin actions.

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
