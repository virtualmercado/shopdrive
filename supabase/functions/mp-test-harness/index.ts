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
  // ---------- Phase 2: create ONE test preapproval + read it back ----------
  if (phase === "phase2_create" || phase === "phase2_read") {
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const me: any = await (await fetch("https://api.mercadopago.com/users/me", { headers: h })).json().catch(() => ({}));
    if (!(Array.isArray(me?.tags) && me.tags.includes("test_user"))) return json({ stopped: true, reason: "not_test_user" });
    // Buyer account guards (server-side only, values never returned)
    const sellerEmail = typeof me?.email === "string" ? me.email.toLowerCase() : "";
    const buyerEmail = buyer.toLowerCase();
    const buyerLooksTestAccount = /@testuser\.com$/.test(buyerEmail);
    const buyerDistinctFromSeller = buyerEmail.length > 0 && buyerEmail !== sellerEmail;
    if (!buyerDistinctFromSeller) return json({ stopped: true, reason: "buyer_email_same_as_seller" });
    const buyerGuards = {
      distinct_from_seller: buyerDistinctFromSeller,
      mp_managed_test_domain: buyerLooksTestAccount,
      buyer_email_domain: buyerEmail.split("@")[1] ?? null,
    };
    const sanitize = (p: any) => ({
      id: p?.id, status: p?.status, reason: p?.reason, external_reference: p?.external_reference,
      payer_id_present: !!p?.payer_id, date_created: p?.date_created, last_modified: p?.last_modified,
      next_payment_date: p?.next_payment_date, payment_method_id: p?.payment_method_id,
      card_id_present: !!p?.card_id, first_invoice_offset: p?.first_invoice_offset ?? null,
      auto_recurring: p?.auto_recurring, summarized: p?.summarized, application_id_present: !!p?.application_id,
      init_point_present: !!p?.init_point,
    });
    if (phase === "phase2_read") {
      const id = String(body?.id ?? "");
      const r = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, { headers: h });
      const j: any = await r.json().catch(() => ({}));
      if (!String(j?.external_reference ?? "").startsWith(TAG)) return json({ stopped: true, reason: "not_harness_resource", http: r.status });
      return json({ http: r.status, preapproval: sanitize(j) });
    }
    // card token with official MP test card (APRO)
    const ct = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(pub)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_number: "5031433215406351", security_code: "123", expiration_month: 11, expiration_year: 2030,
        cardholder: { name: "APRO", identification: { type: "CPF", number: "12345678909" } } }),
    });
    const ctJ: any = await ct.json().catch(() => ({}));
    if (!ct.ok || !ctJ?.id) return json({ step: "card_token", http: ct.status, ok: false, error: ctJ?.message ?? null, cause: ctJ?.cause ?? null });
    const ref = `${TAG}${crypto.randomUUID()}`;
    const payload = {
      reason: `${TAG}Assinatura PRO ficticia`, external_reference: ref, payer_email: buyer, card_token_id: ctJ.id,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 5.0, currency_id: "BRL" },
      back_url: "https://shopdrive.com.br/dashboard/financeiro", status: "authorized",
    };
    const c = await fetch("https://api.mercadopago.com/preapproval", { method: "POST", headers: { ...h, "X-Idempotency-Key": ref }, body: JSON.stringify(payload) });
    const cJ: any = await c.json().catch(() => ({}));
    if (!c.ok || !cJ?.id) return json({ step: "create", http: c.status, ok: false, external_reference: ref, error: cJ?.message ?? null, cause: cJ?.cause ?? null, status: cJ?.status ?? null });
    const r = await fetch(`https://api.mercadopago.com/preapproval/${cJ.id}`, { headers: h });
    const rJ: any = await r.json().catch(() => ({}));
    return json({ step: "create+read", buyer_guards: buyerGuards, create_http: c.status, created: sanitize(cJ), read_http: r.status, read: sanitize(rJ) });
  }
  // ---------- Read-only: resolve buyer test user identity ----------
  if (phase === "buyer_lookup") {
    const id = String(body?.user_id ?? "");
    if (!/^\d{5,15}$/.test(id)) return json({ error: "invalid_user_id" }, 400);
    const h = { Authorization: `Bearer ${token}` };
    const me: any = await (await fetch("https://api.mercadopago.com/users/me", { headers: h })).json().catch(() => ({}));
    const r = await fetch(`https://api.mercadopago.com/users/${id}`, { headers: h });
    const u: any = await r.json().catch(() => ({}));
    const tags: string[] = Array.isArray(u?.tags) ? u.tags : [];
    const email = typeof u?.email === "string" ? u.email : null;
    return json({
      http: r.status,
      seller_id: me?.id ?? null, seller_is_test_user: Array.isArray(me?.tags) && me.tags.includes("test_user"),
      buyer_id: u?.id ?? null, distinct_accounts: !!u?.id && String(u.id) !== String(me?.id),
      buyer_is_test_user: tags.includes("test_user"), buyer_site_id: u?.site_id ?? null,
      buyer_country_id: u?.country_id ?? null, buyer_nickname: u?.nickname ?? null,
      email_returned: !!email, email_domain: email ? email.split("@")[1] : null,
      fields_returned: Object.keys(u ?? {}),
      error: r.ok ? null : (u?.message ?? null),
    });
  }
  return json({ error: "unknown_phase" }, 400);
});
