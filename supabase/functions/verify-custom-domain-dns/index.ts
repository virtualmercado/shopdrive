import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import {
  createDohResolver,
  normalizeCustomDomain,
  nextV2State,
  verifyDomain,
  type V2State,
} from "../_shared/customDomainCore.ts";

const Body = z.object({ store_id: z.string().uuid().optional() });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "not_authenticated" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u.user) return json({ error: "not_authenticated" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid_body" }, 400);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    const storeId = parsed.data.store_id ?? u.user.id;
    if (storeId !== u.user.id && !isAdmin) return json({ error: "forbidden" }, 403);
    const source = isAdmin && storeId !== u.user.id ? `admin:${u.user.id}` : "merchant";

    const { data: cfg } = await admin.from("custom_domain_platform_config").select("*").eq("id", true).maybeSingle();
    if (!isAdmin) {
      const { data: access } = await admin.from("custom_domain_v2_access").select("enabled").eq("store_id", storeId).maybeSingle();
      if (!cfg?.feature_enabled || !access?.enabled) return json({ error: "feature_unavailable" }, 403);
    }

    const { data: d } = await admin.from("merchant_domains").select("*").eq("merchant_id", storeId)
      .is("released_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!d) return json({ error: "domain_not_found" }, 404);

    const norm = normalizeCustomDomain(d.normalized_domain ?? d.domain);
    if (!norm.ok) return json({ error: "invalid_domain" }, 400);

    const ingressReady = !!cfg?.ingress_ready && !!cfg?.infrastructure_provider;
    const result = await verifyDomain({
      domain: norm.domain,
      token: d.flow_version === 2 ? d.verification_token : null,
      expiresAt: d.verification_expires_at,
      ownershipVerifiedAt: d.ownership_verified_at,
      config: {
        ingressReady,
        rootType: cfg?.root_record_type ?? "A", rootValue: cfg?.root_record_value ?? null,
        wwwType: cfg?.www_record_type ?? "CNAME", wwwValue: cfg?.www_record_value ?? null,
        txtHostPrefix: cfg?.txt_host_prefix ?? "_shopdrive-verification",
        txtValuePrefix: cfg?.txt_value_prefix ?? "shopdrive=",
      },
      resolve: createDohResolver(fetch),
    });

    const logBase = { domain_id: d.id, source };
    const logs = [
      { ...logBase, verification_type: "ns", status: result.nameservers.length ? "found" : "not_found",
        found_value: result.nameservers.join(", ").slice(0, 500) || null, details: { provider: result.provider } },
      { ...logBase, verification_type: "ownership_txt", status: result.ownership,
        expected_value: `${cfg?.txt_host_prefix ?? "_shopdrive-verification"}.${norm.domain}`, details: { txt_records: result.observed.txt } },
      { ...logBase, verification_type: "dns_target", status: `root:${result.root} www:${result.www}`,
        found_value: [...result.observed.root, ...result.observed.www].join(", ").slice(0, 500) || null, details: { notes: result.notes } },
    ];
    await admin.from("domain_verification_logs").insert(logs);

    // Legacy V1 rows: diagnostic only, never promoted.
    if (d.flow_version !== 2) {
      await admin.from("merchant_domains").update({ last_dns_check: result.checkedAt, last_verification_result: result, needs_reverification: true }).eq("id", d.id);
      return json({ legacy: true, result });
    }

    const state = nextV2State({ current: (d.v2_state ?? "pending_ownership") as V2State, result, routingStatus: d.routing_status, sslStatus: d.ssl_status ?? "pending" });
    const patch: Record<string, unknown> = {
      last_dns_check: result.checkedAt, last_verification_result: result, v2_state: state,
      detected_nameservers: result.nameservers, dns_provider: result.provider?.slug ?? null, updated_at: new Date().toISOString(),
    };
    if (result.ownership === "verified") patch.ownership_verified_at = result.checkedAt;
    if (result.root === "ok" && result.www === "ok") { patch.dns_verified_at = result.checkedAt; patch.dns_a_verified = true; patch.dns_cname_verified = true; }
    // Activation is only possible when real infrastructure has reported routing + SSL active.
    if (state === "active" && !d.activated_at) { patch.activated_at = result.checkedAt; patch.is_active = true; }
    await admin.from("merchant_domains").update(patch).eq("id", d.id);

    return json({ state, result });
  } catch (e) {
    console.error("verify-custom-domain-dns", e);
    return json({ error: "internal_error" }, 500);
  }
});
