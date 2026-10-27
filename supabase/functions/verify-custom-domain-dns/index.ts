import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import {
  createDohResolver,
  normalizeCustomDomain,
  nextV2State,
  verifyDomain,
  areDnsRecordsVerified,
  getPilotVerificationHostname,
  type V2State,
} from "../_shared/customDomainCore.ts";

const Body = z.object({ store_id: z.string().uuid().optional() }).strict();
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "internal_error" }, 500);
    const admin = createClient(url, key);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "not_authenticated" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u.user) return json({ error: "not_authenticated" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "invalid_body" }, 400);

    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (roleError) return json({ error: "authorization_unavailable" }, 503);
    const storeId = parsed.data.store_id ?? u.user.id;
    if (storeId !== u.user.id && !isAdmin) return json({ error: "forbidden" }, 403);
    const source = isAdmin ? `admin:${u.user.id}` : "merchant";

    const { data: cfg, error: cfgError } = await admin.from("custom_domain_platform_config").select("*").eq("id", true).maybeSingle();
    const { data: access, error: accessError } = await admin.from("custom_domain_v2_access").select("store_id,enabled,pilot_hostname,updated_at").eq("store_id", storeId).maybeSingle();
    if (cfgError || accessError || !cfg) return json({ error: "authorization_unavailable" }, 503);
    if (!isAdmin) {
      if (!cfg?.feature_enabled || !access?.enabled) return json({ error: "feature_unavailable" }, 403);
    }

    const { data: d, error: domainError } = await admin.from("merchant_domains").select("*").eq("merchant_id", storeId)
      .is("released_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (domainError) return json({ error: "domain_unavailable" }, 503);
    if (!d) return json({ error: "domain_not_found" }, 404);

    const norm = normalizeCustomDomain(d.normalized_domain ?? d.domain);
    if (!norm.ok) return json({ error: "invalid_domain" }, 400);

    const pilotHostname = d.flow_version === 2 ? getPilotVerificationHostname({ isAdmin: isAdmin === true,
      storeId, domainMerchantId: d.merchant_id, canonicalDomain: norm.domain, access }) : null;
    const ingressReady = !!cfg.ingress_ready && !!cfg.infrastructure_provider &&
      (d.flow_version !== 2 || (!!cfg.feature_enabled && !!access?.enabled));
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
      pilotHostname,
    });

    const logBase = { domain_id: d.id, source };
    const logs = [
      { ...logBase, verification_type: "ns", status: result.nameservers.length ? "found" : "not_found",
        found_value: result.nameservers.join(", ").slice(0, 500) || null, details: { provider: result.provider } },
      { ...logBase, verification_type: "ownership_txt", status: result.ownership,
        expected_value: `${cfg?.txt_host_prefix ?? "_shopdrive-verification"}.${norm.domain}`, details: { txt_records: result.observed.txt } },
      { ...logBase, verification_type: "dns_target", status: `root:${result.root} www:${result.www}`,
        found_value: [...result.observed.root, ...result.observed.www].join(", ").slice(0, 500) || null,
        details: { notes: result.notes, pilot_hostname: result.pilotHostname ?? null } },
    ];

    // DNS awaits must not continue a reclaimed/disconnected or newly revoked snapshot.
    const { data: freshAccess, error: freshAccessError } = await admin.from("custom_domain_v2_access").select("store_id,enabled,pilot_hostname,updated_at").eq("store_id", storeId).maybeSingle();
    const { data: freshCfg, error: freshCfgError } = await admin.from("custom_domain_platform_config").select("*").eq("id", true).maybeSingle();
    if (freshAccessError || freshCfgError || JSON.stringify(freshAccess) !== JSON.stringify(access) || JSON.stringify(freshCfg) !== JSON.stringify(cfg)) {
      return json({ error: "verification_context_changed" }, 409);
    }
    const { error: logError } = await admin.from("domain_verification_logs").insert(logs);
    if (logError) return json({ error: "verification_not_saved" }, 500);

    // Legacy V1 rows: diagnostic only, never promoted.
    if (d.flow_version !== 2) {
      const { data: saved, error } = await admin.from("merchant_domains").update({ last_dns_check: result.checkedAt, last_verification_result: result, needs_reverification: true })
        .eq("id", d.id).eq("updated_at", d.updated_at).is("released_at", null).select("id").maybeSingle();
      if (error || !saved) return json({ error: "verification_not_saved" }, 409);
      return json({ legacy: true, result });
    }

    const state = nextV2State({ current: (d.v2_state ?? "pending_ownership") as V2State, result, routingStatus: d.routing_status, sslStatus: d.ssl_status ?? "pending" });
    const patch: Record<string, unknown> = {
      last_dns_check: result.checkedAt, last_verification_result: result, v2_state: state,
      detected_nameservers: result.nameservers, dns_provider: result.provider?.slug ?? null, updated_at: new Date().toISOString(),
    };
    if (result.ownership === "verified") patch.ownership_verified_at = result.checkedAt;
    if (areDnsRecordsVerified(result)) {
      patch.dns_verified_at = result.checkedAt;
      patch.dns_a_verified = result.root === "ok";
      patch.dns_cname_verified = true;
    }
    // Activation is only possible when real infrastructure has reported routing + SSL active.
    if (state === "active" && !d.activated_at) { patch.activated_at = result.checkedAt; patch.is_active = true; }
    const { data: saved, error: saveError } = await admin.from("merchant_domains").update(patch)
      .eq("id", d.id).eq("updated_at", d.updated_at).is("released_at", null).select("id").maybeSingle();
    if (saveError || !saved) return json({ error: "verification_not_saved" }, 409);

    return json({ state, result });
  } catch (e) {
    console.error("verify-custom-domain-dns: verification failed");
    return json({ error: "internal_error" }, 500);
  }
});
