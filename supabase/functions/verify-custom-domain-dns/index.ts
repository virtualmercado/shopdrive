import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import {
  createDohResolver,
  normalizeCustomDomain,
  nextV2State,
  verifyDomain,
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

    const { data: cfg, error: cfgError } = await admin.from("custom_domain_platform_config").select("*").eq("id", true).maybeSingle();
    const { data: access, error: accessError } = await admin.from("custom_domain_v2_access").select("*").eq("store_id", storeId).maybeSingle();
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

    const state = d.flow_version === 2 ? nextV2State({ current: (d.v2_state ?? "pending_ownership") as V2State,
      result, routingStatus: d.routing_status, sslStatus: d.ssl_status ?? "pending" }) : null;
    // One transaction locks/rechecks authorization and the domain snapshot, then saves logs+state.
    const { data: saved, error: saveError } = await admin.rpc("apply_custom_domain_verification", {
      p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
      p_expected_access: access, p_expected_config: cfg, p_result: result, p_state: state, p_pilot_hostname: pilotHostname,
    });
    if (saveError || !saved) return json({ error: "verification_not_saved" }, saveError?.code === "40001" ? 409 : 500);
    return json(saved);
  } catch (e) {
    console.error("verify-custom-domain-dns: verification failed");
    return json({ error: "internal_error" }, 500);
  }
});
