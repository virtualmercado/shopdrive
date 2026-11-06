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
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "configuration_unavailable" }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(auth.slice(7));
  const uid = claims?.claims?.sub;
  if (claimsError || !uid) return json({ error: "unauthorized" }, 401);
  const admin = createClient(url, serviceKey);
  const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (roleError || isAdmin !== true) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const storeId = String(body?.store_id ?? "");
  const subscriptionId = String(body?.subscription_id ?? "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(storeId) || !uuid.test(subscriptionId)) return json({ error: "invalid_input" }, 400);
  let claimToken: string | null = null;
  try {
    const { data: operation, error: claimError } = await admin.rpc("claim_marca_recurrence_cancellation", { p_actor: uid, p_store_id: storeId, p_subscription_id: subscriptionId });
    if (claimError || !operation) return json({ stopped: true, reason: "cancellation_not_authorized" }, 409);
    if (operation.completed) return json({ ...operation.result, idempotent: true });
    if (!operation.claimed) return json({ processing: true }, 202);
    if (typeof operation.token !== "string" || typeof operation.provider_reference !== "string") throw new Error("invalid_claim");
    claimToken = operation.token;
    const { data: gw, error: gatewayError } = await admin.from("master_payment_gateways")
      .select("mercadopago_access_token").eq("gateway_name", "mercadopago").eq("is_active", true).eq("is_default", true).maybeSingle();
    const token = gw?.mercadopago_access_token?.trim();
    if (gatewayError || !token) throw new Error("gateway_unavailable");
    const endpoint = `https://api.mercadopago.com/preapproval/${encodeURIComponent(operation.provider_reference)}`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const lookup = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
    const before = await lookup.json();
    if (!lookup.ok || typeof before?.status !== "string") throw new Error("provider_lookup_failed");
    if (before.status !== "cancelled") {
      // Unknown outcomes are read-only reconcilable and never eligible for a second PUT.
      if (operation.reconcile_only) throw new Error("reconciliation_required");
      const marked = await admin.rpc("mark_marca_recurrence_cancellation_sent", { p_subscription_id: subscriptionId, p_token: claimToken });
      if (marked.error) throw new Error("claim_changed");
      const cancelled = await fetch(endpoint, { method: "PUT", headers, body: JSON.stringify({ status: "cancelled" }), signal: AbortSignal.timeout(15000) });
      const after = await cancelled.json();
      if (!cancelled.ok || after?.status !== "cancelled") throw new Error("cancellation_unconfirmed");
    }
    const completed = await admin.rpc("complete_marca_recurrence_cancellation", { p_subscription_id: subscriptionId, p_token: claimToken, p_before: before.status, p_after: "cancelled" });
    if (completed.error || !completed.data) throw new Error("completion_unavailable");
    return json(completed.data);
  } catch {
    if (claimToken) {
      await admin.rpc("fail_marca_recurrence_cancellation", { p_subscription_id: subscriptionId, p_token: claimToken }).catch(() => null);
    }
    return json({ ok: false, reason: "cancellation_requires_reconciliation" }, 503);
  }
});
