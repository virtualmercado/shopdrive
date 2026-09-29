// Prompt 11.2 — isolated Mercado Pago TEST harness. Admin-only, never used by the frontend.
// Uses ONLY MP_TEST_* secrets; never falls back to production; never returns token values.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TAG = "SHOPDRIVE_MP_TEST_";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
  const phase = String(body?.phase ?? "");

  // ---------- Phase 0: secret guards (no MP call) ----------
  const token = Deno.env.get("MP_TEST_ACCESS_TOKEN")?.trim() ?? "";
  const pub = Deno.env.get("MP_TEST_PUBLIC_KEY")?.trim() ?? "";
  const buyer = Deno.env.get("MP_TEST_BUYER_EMAIL")?.trim() ?? "";
  const { data: prod } = await admin.from("master_payment_gateways")
    .select("mercadopago_access_token, mercadopago_public_key").eq("gateway_name", "mercadopago");
  const prodTok = new Set<string>(), prodPub = new Set<string>();
  for (const r of prod ?? []) {
    if (r.mercadopago_access_token) prodTok.add(await sha(r.mercadopago_access_token.trim()));
    if (r.mercadopago_public_key) prodPub.add(await sha(r.mercadopago_public_key.trim()));
  }
  const phase0 = {
    MP_TEST_ACCESS_TOKEN_configured: token.length > 0,
    MP_TEST_PUBLIC_KEY_configured: pub.length > 0,
    MP_TEST_BUYER_EMAIL_configured: /^[^@\s]+@[^@\s]+$/.test(buyer),
    test_token_differs_from_production: token.length > 0 && !prodTok.has(await sha(token)),
    test_public_key_differs_from_production: pub.length > 0 && !prodPub.has(await sha(pub)),
    token_prefix_kind: token.startsWith("TEST-") ? "TEST-" : token.startsWith("APP_USR-") ? "APP_USR-" : "other",
    production_fallback: false,
    resource_guard_tag: TAG,
  };
  const phase0ok = phase0.MP_TEST_ACCESS_TOKEN_configured && phase0.MP_TEST_PUBLIC_KEY_configured &&
    phase0.MP_TEST_BUYER_EMAIL_configured && phase0.test_token_differs_from_production &&
    phase0.test_public_key_differs_from_production;
  if (phase === "phase0" || !phase0ok) return json({ phase0, phase0ok, stopped: !phase0ok });

  // ---------- Phase 1: non-destructive API checks ----------
  if (phase === "phase1") {
    const h = { Authorization: `Bearer ${token}` };
    const me = await fetch("https://api.mercadopago.com/users/me", { headers: h });
    const meJ: any = await me.json().catch(() => ({}));
    const nick = String(meJ?.nickname ?? "");
    const email = String(meJ?.email ?? "");
    const tags: string[] = Array.isArray(meJ?.tags) ? meJ.tags : [];
    const isTestUser = tags.includes("test_user") || /^TEST(USER|_USER)/i.test(nick) || /@testuser\.com$/i.test(email);
    let preapproval: any = { skipped: true };
    if (me.ok && isTestUser) {
      const s = await fetch("https://api.mercadopago.com/preapproval/search?limit=1", { headers: h });
      const sJ: any = await s.json().catch(() => ({}));
      preapproval = { http_status: s.status, accessible: s.ok, total: sJ?.paging?.total ?? null, error: s.ok ? null : (sJ?.message ?? null) };
    }
    return json({
      phase0, phase0ok,
      phase1: {
        credential_accepted: me.ok, users_me_status: me.status,
        environment_confirmed_test: isTestUser, account_tags: tags.filter((t) => /test/i.test(t)),
        site_id: meJ?.site_id ?? null,
        subscriptions_api: preapproval,
        error: me.ok ? null : (meJ?.message ?? null),
      },
    });
  }
  return json({ error: "unknown_phase" }, 400);
});
