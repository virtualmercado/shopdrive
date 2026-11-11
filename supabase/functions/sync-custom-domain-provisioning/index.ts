import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { nextV2State, type V2State, type VerificationResult } from "../_shared/customDomainCore.ts";
import {
  CLOUDFLARE_API_BASE,
  PROVISIONING_BATCH_LIMIT,
  computeBackoffMinutes,
  externalHostnameForDomain,
  isSyncableDomain,
  mapCloudflareStatuses,
  sanitizeCloudflareError,
} from "../_shared/customDomainProvisioning.ts";
import {
  isExplicitRemoval,
  provisioningAuditLine,
  removeCustomHostname,
  writePolicyFromConfig,
  type CfCall,
} from "../_shared/customHostnameWrites.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const JOB = "sync-custom-domain-provisioning";

async function cfFetch(token: string, method: "GET" | "POST" | "DELETE", path: string): Promise<{ status: number; body: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${CLOUDFLARE_API_BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "internal_error" }, 500);
    const admin = createClient(url, key);

    const jobToken = req.headers.get("x-internal-job-token") ?? "";
    const { data: ok, error: tokErr } = await admin.rpc("verify_internal_job_token", { p_job: JOB, p_token: jobToken });
    if (tokErr || !ok) return json({ error: "not_authenticated" }, 401);

    // Small batches, pending states only; active domains are never polled.
    const { data: rows, error: qErr } = await admin.from("merchant_domains").select("*")
      .eq("flow_version", 2).is("released_at", null)
      .or("v2_state.in.(routing_provisioning,ssl_provisioning),routing_status.in.(provisioning,removing)")
      .or("provision_next_retry_at.is.null,provision_next_retry_at.lte." + new Date().toISOString())
      .order("updated_at", { ascending: true }).limit(PROVISIONING_BATCH_LIMIT);
    if (qErr) return json({ error: "query_failed" }, 500);
    const pending = (rows ?? []).filter(isSyncableDomain);
    if (pending.length === 0) return json({ processed: 0 });

    const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");
    const cfToken = Deno.env.get("CLOUDFLARE_CUSTOM_HOSTNAMES_TOKEN");
    if (!zoneId || !cfToken) return json({ error: "credential_not_configured", pending: pending.length }, 503);

    const { data: cfg, error: cfgErr } = await admin.from("custom_domain_platform_config").select("*").eq("id", true).maybeSingle();
    // Config unavailable → policy defaults to no writes (fail-closed); status GETs continue.
    const policy = writePolicyFromConfig(cfgErr ? null : cfg);
    const cf: CfCall = (method, path) => cfFetch(cfToken, method, path);

    let processed = 0;
    let errors = 0;
    for (const d of pending) {
      const retryAt = () => new Date(Date.now() + computeBackoffMinutes((d.provision_attempts ?? 0) + 1) * 60_000).toISOString();
      try {
        if (d.routing_status === "removing") {
          // DELETE only for an explicit, internally revoked disconnect; never after transient errors.
          if (!isExplicitRemoval(d)) continue;
          const expected = externalHostnameForDomain(d.normalized_domain ?? "");
          if (!expected) continue;
          const removal = await removeCustomHostname({ policy, zoneId, externalId: d.external_hostname_id, expectedHostname: expected, cf });
          console.log(provisioningAuditLine({ event: `sync_delete_${removal.kind}`, store_id: d.merchant_id, hostname: expected,
            internal_state: d.v2_state, external_hostname_id: d.external_hostname_id,
            error: removal.kind === "blocked" ? removal.reason : null }));
          if (removal.kind === "blocked") continue; // kill switch/protection: no external call, no state churn
          if (removal.kind === "removed") {
            await admin.rpc("finalize_custom_domain_revoke", { p_actor: d.merchant_id, p_domain_id: d.id, p_expected_updated_at: d.updated_at });
            processed++;
          } else {
            await admin.rpc("fail_custom_domain_provisioning", { p_actor: d.merchant_id, p_domain_id: d.id,
              p_expected_updated_at: d.updated_at,
              p_error: removal.kind === "mismatch" ? "external_hostname_mismatch"
                : removal.status ? sanitizeCloudflareError(removal.status, removal.body) : "cf_timeout:delete",
              p_next_retry_at: removal.kind === "retry" ? retryAt() : null });
            errors++;
          }
          continue;
        }
        if (!d.external_hostname_id) continue; // nothing external yet; merchant action required
        const got = await cf("GET", `/zones/${zoneId}/custom_hostnames/${d.external_hostname_id}`);
        const r = (got.body as { result?: { status?: string; ssl?: { status?: string } } } | null)?.result;
        if (!r) {
          await admin.rpc("fail_custom_domain_provisioning", { p_actor: d.merchant_id, p_domain_id: d.id,
            p_expected_updated_at: d.updated_at,
            p_error: got.status === 404 ? "cf_404:external_hostname_missing" : sanitizeCloudflareError(got.status, got.body),
            p_next_retry_at: got.status === 404 ? null : retryAt() });
          errors++;
          continue;
        }
        const mapped = mapCloudflareStatuses(r.status ?? "pending", r.ssl?.status ?? "pending");
        const last = d.last_verification_result as VerificationResult | null;
        if (!last) continue; // without a DNS snapshot there is no safe state decision
        const state = nextV2State({ current: (d.v2_state ?? "dns_verified") as V2State, result: last,
          routingStatus: mapped.routingStatus, sslStatus: mapped.sslStatus });
        await admin.rpc("complete_custom_domain_provisioning", { p_actor: d.merchant_id, p_domain_id: d.id,
          p_expected_updated_at: d.updated_at, p_external_hostname_id: d.external_hostname_id,
          p_routing_status: mapped.routingStatus, p_ssl_status: mapped.sslStatus, p_state: state, p_error: null });
        processed++;
      } catch {
        await admin.rpc("fail_custom_domain_provisioning", { p_actor: d.merchant_id, p_domain_id: d.id,
          p_expected_updated_at: d.updated_at, p_error: "cf_timeout:status_check", p_next_retry_at: retryAt() });
        errors++;
      }
    }
    return json({ processed, errors, pending: pending.length });
  } catch {
    console.error("sync-custom-domain-provisioning: run failed");
    return json({ error: "internal_error" }, 500);
  }
});
