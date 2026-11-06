// Admin-only: cancels the external Mercado Pago recurrence of an own PREMIUM/PRO subscription
// of a store that is already linked as MARCA secondary with a valid inherited MARCA fallback.
// Does NOT touch invoices, payments, the paid period or the local subscription status.
// Never logs or returns tokens or raw gateway payloads.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims } = await userClient.auth.getClaims(auth.slice(7));
  const uid = claims?.claims?.sub;
  if (!uid) return json({ error: "unauthorized" }, 401);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const storeId = String(body?.store_id ?? "");
  const subscriptionId = String(body?.subscription_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !/^[0-9a-f-]{36}$/i.test(subscriptionId)) return json({ error: "invalid_input" }, 400);

  // Preconditions (server-side): secondary link + inherited MARCA fallback.
  const { data: link } = await admin.from("brand_account_owned_stores")
    .select("brand_account_id, store_role").eq("store_profile_id", storeId).maybeSingle();
  if (!link || link.store_role !== "secondary") return json({ stopped: true, reason: "not_secondary" }, 409);
  const { data: inherited } = await admin.rpc("get_brand_inherited_plan", { p_store_id: storeId });
  if (inherited !== "marca") return json({ stopped: true, reason: "no_marca_fallback" }, 409);

  const { data: sub } = await admin.from("master_subscriptions")
    .select("id, user_id, plan_id, status, gateway, gateway_subscription_id, current_period_end")
    .eq("id", subscriptionId).maybeSingle();
  if (!sub || sub.user_id !== storeId) return json({ stopped: true, reason: "subscription_mismatch" }, 409);
  if (sub.gateway !== "mercadopago" || !sub.gateway_subscription_id) return json({ stopped: true, reason: "no_external_recurrence" }, 409);

  const { data: gw } = await admin.from("master_payment_gateways")
    .select("mercadopago_access_token").eq("gateway_name", "mercadopago").eq("is_active", true).eq("is_default", true).maybeSingle();
  const token = gw?.mercadopago_access_token?.trim();
  if (!token) return json({ stopped: true, reason: "gateway_not_configured" }, 409);

  const pid = encodeURIComponent(sub.gateway_subscription_id);
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const g = await fetch(`https://api.mercadopago.com/preapproval/${pid}`, { headers: h, signal: AbortSignal.timeout(15000) });
  const gJ: any = await g.json().catch(() => ({}));
  if (!g.ok) return json({ stopped: true, reason: "provider_lookup_failed", http: g.status }, 502);
  const before = { status: gJ?.status ?? null, next_payment_date: gJ?.next_payment_date ?? null };

  let after = before;
  if (gJ?.status !== "cancelled") {
    const r = await fetch(`https://api.mercadopago.com/preapproval/${pid}`, {
      method: "PUT", headers: h, body: JSON.stringify({ status: "cancelled" }), signal: AbortSignal.timeout(15000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, reason: "provider_cancel_failed", http: r.status, before }, 502);
    after = { status: j?.status ?? null, next_payment_date: j?.next_payment_date ?? null };
  }

  await admin.from("master_subscription_logs").insert({
    subscription_id: sub.id, user_id: storeId, event_type: "external_recurrence_cancelled_marca_secondary",
    event_description: "Recorrência externa encerrada após vínculo MARCA; período já pago preservado até o fim.",
    metadata: { brand_account_id: link.brand_account_id, provider_status_before: before.status, provider_status_after: after.status, paid_until: sub.current_period_end, actor: uid },
  });

  return json({ ok: true, before, after, paid_until: sub.current_period_end, local_status: sub.status });
});
