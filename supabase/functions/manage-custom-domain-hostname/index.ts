import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import {
  createDohResolver,
  normalizeCustomDomain,
  nextV2State,
  verifyDomain,
  type V2State,
  type VerificationResult,
} from "../_shared/customDomainCore.ts";
import {
  CLOUDFLARE_API_BASE,
  CUSTOM_HOSTNAME_TARGET,
  buildCustomHostnameCreatePayload,
  classifyDeleteStatus,
  classifyHostnameConflict,
  computeBackoffMinutes,
  decideCreateAction,
  externalHostnameForDomain,
  mapCloudflareStatuses,
  sanitizeCloudflareError,
} from "../_shared/customDomainProvisioning.ts";

const Body = z.object({
  action: z.enum(["create", "status", "retry", "delete"]),
  store_id: z.string().uuid().optional(),
}).strict();

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface CfEnv { zoneId: string; token: string }

function cfEnv(): CfEnv | null {
  const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");
  const token = Deno.env.get("CLOUDFLARE_CUSTOM_HOSTNAMES_TOKEN");
  return zoneId && token ? { zoneId, token } : null;
}

async function cfRequest(env: CfEnv, method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally {
    clearTimeout(timer);
  }
}

function cfResult(body: unknown): { id?: string; hostname?: string; status?: string; ssl?: { status?: string } } | null {
  const r = (body as { result?: unknown } | null)?.result;
  return r && typeof r === "object" ? (r as { id?: string; hostname?: string; status?: string; ssl?: { status?: string } }) : null;
}

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
    const action = parsed.data.action;

    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (roleError) return json({ error: "authorization_unavailable" }, 503);
    // Store is always resolved server-side from auth.uid(); store_id is an admin-only override.
    const storeId = parsed.data.store_id ?? u.user.id;
    if (storeId !== u.user.id && !isAdmin) return json({ error: "forbidden" }, 403);

    const { data: cfg, error: cfgError } = await admin.from("custom_domain_platform_config").select("*").eq("id", true).maybeSingle();
    const { data: access, error: accessError } = await admin.from("custom_domain_v2_access").select("*").eq("store_id", storeId).maybeSingle();
    if (cfgError || accessError || !cfg) return json({ error: "authorization_unavailable" }, 503);

    const { data: d, error: domainError } = await admin.from("merchant_domains").select("*").eq("merchant_id", storeId)
      .is("released_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (domainError) return json({ error: "domain_unavailable" }, 503);
    if (!d || d.flow_version !== 2) return json({ error: "domain_not_found" }, 404);

    const norm = normalizeCustomDomain(d.normalized_domain ?? d.domain);
    if (!norm.ok) return json({ error: "invalid_domain" }, 400);
    const externalHostname = externalHostnameForDomain(norm.domain);
    if (!externalHostname) return json({ error: "invalid_domain" }, 400);

    // Access gate: global rollout OR the exact pilot hostname authorized for this store.
    const pilotNorm = access?.enabled && access.pilot_hostname ? normalizeCustomDomain(access.pilot_hostname) : null;
    const pilotAuthorized = !!(pilotNorm && pilotNorm.ok && pilotNorm.domain === norm.domain);
    if (!isAdmin && !(access?.enabled && (cfg.feature_enabled || pilotAuthorized))) {
      return json({ error: "feature_unavailable" }, 403);
    }

    const env = cfEnv();

    // ---- DELETE: block the internal resolver first (fail-closed), then remove the external object.
    if (action === "delete") {
      const { data: revoked, error: revokeError } = await admin.rpc("revoke_custom_domain_internal", {
        p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
      });
      if (revokeError || !revoked) return json({ error: "revoke_failed" }, revokeError?.code === "40001" ? 409 : 500);
      if (!d.external_hostname_id) {
        const { data: fin, error: finError } = await admin.rpc("finalize_custom_domain_revoke", {
          p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: revoked.updated_at,
        });
        if (finError || !fin) return json({ error: "finalize_failed" }, 500);
        return json(fin);
      }
      if (!env) return json({ error: "credential_not_configured", state: "revoking" }, 503);
      let del: { status: number; body: unknown };
      try {
        del = await cfRequest(env, "DELETE", `/zones/${env.zoneId}/custom_hostnames/${d.external_hostname_id}`);
      } catch {
        return json({ error: "cloudflare_unavailable", state: "revoking" }, 502);
      }
      const outcome = classifyDeleteStatus(del.status);
      if (outcome === "removed") {
        const { data: fin, error: finError } = await admin.rpc("finalize_custom_domain_revoke", {
          p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: revoked.updated_at,
        });
        if (finError || !fin) return json({ error: "finalize_failed" }, 500);
        return json(fin);
      }
      const sanitized = sanitizeCloudflareError(del.status, del.body);
      await admin.rpc("fail_custom_domain_provisioning", {
        p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: revoked.updated_at,
        p_error: sanitized, p_next_retry_at: new Date(Date.now() + computeBackoffMinutes(1) * 60_000).toISOString(),
      });
      return json({ error: "delete_failed", state: "revoking" }, 502);
    }

    // ---- CREATE / STATUS / RETRY require ownership + CNAME verified first (steps B and C).
    if (!d.ownership_verified_at) return json({ error: "ownership_not_verified" }, 409);

    const verification = await verifyDomain({
      domain: norm.domain,
      token: null,
      expiresAt: null,
      ownershipVerifiedAt: d.ownership_verified_at,
      config: {
        ingressReady: true,
        rootType: "A", rootValue: null,
        wwwType: "CNAME", wwwValue: CUSTOM_HOSTNAME_TARGET,
        txtHostPrefix: cfg?.txt_host_prefix ?? "_shopdrive-verification",
        txtValuePrefix: cfg?.txt_value_prefix ?? "shopdrive=",
      },
      resolve: createDohResolver(fetch),
      pilotHostname: pilotAuthorized ? access.pilot_hostname : `www.${norm.domain}`,
    });
    if (verification.www === "resolver_unavailable") return json({ error: "resolver_unavailable" }, 502);
    if (verification.www !== "ok") {
      return json({ error: "cname_not_verified", expected_cname: CUSTOM_HOSTNAME_TARGET, verification }, 409);
    }

    if (action === "create" && decideCreateAction(d.external_hostname_id) === "create") {
      if (!env) return json({ error: "credential_not_configured" }, 503);
      let created: { status: number; body: unknown };
      try {
        created = await cfRequest(env, "POST", `/zones/${env.zoneId}/custom_hostnames`, buildCustomHostnameCreatePayload(externalHostname));
      } catch {
        return json({ error: "cloudflare_unavailable" }, 502);
      }
      let externalId = cfResult(created.body)?.id ?? null;
      if (!externalId) {
        // Hostname may already exist externally: reconcile only a known binding, otherwise stop.
        const list = await cfRequest(env, "GET", `/zones/${env.zoneId}/custom_hostnames?hostname=${encodeURIComponent(externalHostname)}`).catch(() => null);
        const existing = ((list?.body as { result?: Array<{ id: string; hostname: string }> } | null)?.result ?? []) as Array<{ id: string; hostname: string }>;
        const conflict = classifyHostnameConflict(existing, externalHostname, d.external_hostname_id);
        if (conflict.kind === "conflict_unknown") {
          await admin.rpc("fail_custom_domain_provisioning", {
            p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
            p_error: sanitizeCloudflareError(created.status, created.body), p_next_retry_at: null,
          });
          return json({ error: "external_hostname_conflict" }, 409);
        }
        if (conflict.kind === "reconcile") externalId = conflict.id;
        if (!externalId) {
          await admin.rpc("fail_custom_domain_provisioning", {
            p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
            p_error: sanitizeCloudflareError(created.status, created.body),
            p_next_retry_at: new Date(Date.now() + computeBackoffMinutes((d.provision_attempts ?? 0) + 1) * 60_000).toISOString(),
          });
          return json({ error: "provision_failed" }, 502);
        }
      }
      const r = cfResult(created.body);
      const mapped = mapCloudflareStatuses(r?.status ?? "pending", r?.ssl?.status ?? "pending");
      const state = nextV2State({ current: (d.v2_state ?? "dns_verified") as V2State, result: verification as VerificationResult,
        routingStatus: mapped.routingStatus, sslStatus: mapped.sslStatus });
      const { data: saved, error: saveError } = await admin.rpc("complete_custom_domain_provisioning", {
        p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
        p_external_hostname_id: externalId, p_routing_status: mapped.routingStatus, p_ssl_status: mapped.sslStatus,
        p_state: state, p_error: null,
      });
      if (saveError || !saved) return json({ error: "provision_not_saved" }, saveError?.code === "40001" ? 409 : 500);
      return json(saved);
    }

    // ---- STATUS / RETRY / CREATE-with-existing-id: reconcile the external object.
    if (!d.external_hostname_id) return json({ error: "not_provisioned" }, 409);
    if (!env) return json({ error: "credential_not_configured" }, 503);
    let got: { status: number; body: unknown };
    try {
      got = await cfRequest(env, "GET", `/zones/${env.zoneId}/custom_hostnames/${d.external_hostname_id}`);
    } catch {
      // Transient outage: preserve internal state, schedule retry, never deactivate.
      await admin.rpc("fail_custom_domain_provisioning", {
        p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
        p_error: "cf_timeout:status_check",
        p_next_retry_at: new Date(Date.now() + computeBackoffMinutes((d.provision_attempts ?? 0) + 1) * 60_000).toISOString(),
      });
      return json({ error: "cloudflare_unavailable" }, 502);
    }
    if (got.status === 404) {
      await admin.rpc("fail_custom_domain_provisioning", {
        p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
        p_error: "cf_404:external_hostname_missing", p_next_retry_at: null,
      });
      return json({ error: "external_hostname_missing" }, 409);
    }
    const r = cfResult(got.body);
    if (!r) {
      await admin.rpc("fail_custom_domain_provisioning", {
        p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
        p_error: sanitizeCloudflareError(got.status, got.body),
        p_next_retry_at: new Date(Date.now() + computeBackoffMinutes((d.provision_attempts ?? 0) + 1) * 60_000).toISOString(),
      });
      return json({ error: "cloudflare_unavailable" }, 502);
    }
    const mapped = mapCloudflareStatuses(r.status ?? "pending", r.ssl?.status ?? "pending");
    const state = nextV2State({ current: (d.v2_state ?? "dns_verified") as V2State, result: verification as VerificationResult,
      routingStatus: mapped.routingStatus, sslStatus: mapped.sslStatus });
    const { data: saved, error: saveError } = await admin.rpc("complete_custom_domain_provisioning", {
      p_actor: u.user.id, p_domain_id: d.id, p_expected_updated_at: d.updated_at,
      p_external_hostname_id: d.external_hostname_id, p_routing_status: mapped.routingStatus, p_ssl_status: mapped.sslStatus,
      p_state: state, p_error: null,
    });
    if (saveError || !saved) return json({ error: "provision_not_saved" }, saveError?.code === "40001" ? 409 : 500);
    return json(saved);
  } catch {
    console.error("manage-custom-domain-hostname: request failed");
    return json({ error: "internal_error" }, 500);
  }
});
