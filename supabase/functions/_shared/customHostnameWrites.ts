// Cloudflare Custom Hostname write orchestration shared by the merchant action and the 5-min job.
// Pure: network and database lookups are injected. Every POST/DELETE passes the backend kill switch.
import { isReservedDomain } from "./customDomainCore.ts";
import { classifyDeleteStatus, normalizeIngressHostname } from "./customDomainProvisioning.ts";

export interface WritePolicy { writesEnabled: boolean; deletesEnabled: boolean; protectedIds: string[] }

/** Missing/invalid config always means "no writes" (fail-closed). */
export function writePolicyFromConfig(cfg: unknown): WritePolicy {
  const c = (cfg ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(c.protected_external_hostname_ids)
    ? (c.protected_external_hostname_ids as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  return { writesEnabled: c.cloudflare_writes_enabled === true, deletesEnabled: c.cloudflare_deletes_enabled === true, protectedIds: ids };
}

export type WriteBlock = "writes_disabled" | "deletes_disabled" | "protected_hostname" | "reserved_hostname" | "invalid_hostname" | "invalid_external_id";
const EXTERNAL_ID = /^[a-f0-9-]{36}$/i;

export function evaluateCloudflareWrite(
  policy: WritePolicy,
  op: "create" | "delete",
  target: { hostname?: string | null; externalId?: string | null },
): { allowed: true } | { allowed: false; reason: WriteBlock } {
  if (!policy.writesEnabled) return { allowed: false, reason: "writes_disabled" };
  if (op === "delete" && !policy.deletesEnabled) return { allowed: false, reason: "deletes_disabled" };
  if (target.externalId != null) {
    if (!EXTERNAL_ID.test(target.externalId)) return { allowed: false, reason: "invalid_external_id" };
    if (policy.protectedIds.includes(target.externalId)) return { allowed: false, reason: "protected_hostname" };
  } else if (op === "delete") {
    return { allowed: false, reason: "invalid_external_id" };
  }
  if (op === "create") {
    const h = normalizeIngressHostname(target.hostname ?? "");
    if (!h || h !== target.hostname) return { allowed: false, reason: "invalid_hostname" };
    if (isReservedDomain(h)) return { allowed: false, reason: "reserved_hostname" };
  }
  return { allowed: true };
}

export type CfCall = (method: "GET" | "POST" | "DELETE", path: string, body?: unknown) => Promise<{ status: number; body: unknown }>;

type CfHostname = { id?: string; hostname?: string; status?: string; ssl?: { status?: string } };
const resultOf = (b: unknown) => (b as { result?: unknown } | null)?.result;

export type EnsureOutcome =
  | { kind: "reconcile"; id: string }
  | { kind: "created"; id: string; result: CfHostname }
  | { kind: "adopted"; id: string; result: CfHostname }
  | { kind: "blocked"; reason: WriteBlock }
  | { kind: "conflict"; reason: "duplicate_external" | "claimed_elsewhere" | "protected_hostname" }
  | { kind: "unavailable"; stage: "lookup" | "post" }
  | { kind: "failed"; status: number; body: unknown };

/**
 * Idempotent creation for one normalized hostname:
 * known id → reconcile (never POST); otherwise GET by hostname first and adopt an unclaimed
 * exact match; POST only when Cloudflare confirms none exists. A timed-out POST is resolved by
 * the next attempt's lookup, never by a blind second POST.
 */
export async function ensureCustomHostname(deps: {
  policy: WritePolicy; zoneId: string; hostname: string; knownId: string | null;
  cf: CfCall; isIdClaimedElsewhere: (id: string) => Promise<boolean>;
}): Promise<EnsureOutcome> {
  if (deps.knownId) return { kind: "reconcile", id: deps.knownId };
  const guard = evaluateCloudflareWrite(deps.policy, "create", { hostname: deps.hostname });
  if (!guard.allowed) return { kind: "blocked", reason: guard.reason };

  const lookup = async (): Promise<EnsureOutcome | null | "unavailable"> => {
    let r: { status: number; body: unknown };
    try {
      r = await deps.cf("GET", `/zones/${deps.zoneId}/custom_hostnames?hostname=${encodeURIComponent(deps.hostname)}`);
    } catch { return "unavailable"; }
    const list = resultOf(r.body);
    if (r.status !== 200 || !Array.isArray(list)) return "unavailable";
    const matches = (list as CfHostname[]).filter((h) => h?.hostname === deps.hostname && typeof h.id === "string");
    if (matches.length === 0) return null;
    if (matches.length > 1) return { kind: "conflict", reason: "duplicate_external" };
    const id = matches[0].id!;
    if (deps.policy.protectedIds.includes(id)) return { kind: "conflict", reason: "protected_hostname" };
    if (await deps.isIdClaimedElsewhere(id)) return { kind: "conflict", reason: "claimed_elsewhere" };
    return { kind: "adopted", id, result: matches[0] };
  };

  const before = await lookup();
  if (before === "unavailable") return { kind: "unavailable", stage: "lookup" };
  if (before) return before;

  let created: { status: number; body: unknown };
  try {
    created = await deps.cf("POST", `/zones/${deps.zoneId}/custom_hostnames`, {
      hostname: deps.hostname,
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    });
  } catch {
    return { kind: "unavailable", stage: "post" };
  }
  const r = resultOf(created.body) as CfHostname | undefined;
  if (created.status >= 200 && created.status < 300 && r && typeof r.id === "string") {
    return { kind: "created", id: r.id, result: r };
  }
  // Cloudflare refused (e.g. duplicate from a concurrent run): re-read, never POST again here.
  const after = await lookup();
  if (after && after !== "unavailable") return after;
  return { kind: "failed", status: created.status, body: created.body };
}

export type RemoveOutcome =
  | { kind: "removed"; via: "delete" | "already_absent" }
  | { kind: "blocked"; reason: WriteBlock }
  | { kind: "mismatch" }
  | { kind: "retry"; status: number; body: unknown }
  | { kind: "failed"; status: number; body: unknown };

/** Explicit removal only: the row must already be revoked internally (disconnect requested). */
export function isExplicitRemoval(d: { routing_status: string | null; v2_state: string | null; disconnected_at: string | null; external_hostname_id: string | null }): boolean {
  return d.routing_status === "removing" && d.v2_state === "inactive" && !!d.disconnected_at && !!d.external_hostname_id;
}

/** DELETE only after the guard and a GET proving the object is exactly the expected hostname. */
export async function removeCustomHostname(deps: {
  policy: WritePolicy; zoneId: string; externalId: string; expectedHostname: string; cf: CfCall;
}): Promise<RemoveOutcome> {
  const guard = evaluateCloudflareWrite(deps.policy, "delete", { externalId: deps.externalId });
  if (!guard.allowed) return { kind: "blocked", reason: guard.reason };
  let got: { status: number; body: unknown };
  try {
    got = await deps.cf("GET", `/zones/${deps.zoneId}/custom_hostnames/${deps.externalId}`);
  } catch { return { kind: "retry", status: 0, body: null }; }
  if (got.status === 404) return { kind: "removed", via: "already_absent" };
  const r = resultOf(got.body) as CfHostname | undefined;
  if (got.status !== 200 || !r) return { kind: "retry", status: got.status, body: got.body };
  if (r.hostname !== deps.expectedHostname) return { kind: "mismatch" };
  let del: { status: number; body: unknown };
  try {
    del = await deps.cf("DELETE", `/zones/${deps.zoneId}/custom_hostnames/${deps.externalId}`);
  } catch { return { kind: "retry", status: 0, body: null }; }
  const c = classifyDeleteStatus(del.status);
  if (c === "removed") return { kind: "removed", via: "delete" };
  return c === "retry" ? { kind: "retry", status: del.status, body: del.body } : { kind: "failed", status: del.status, body: del.body };
}

/** Structured, token-free audit line for Custom Hostname transitions (first real merchant follow-up). */
export function provisioningAuditLine(e: {
  event: string; store_id: string; hostname: string | null; internal_state?: string | null;
  external_hostname_id?: string | null; cloudflare_status?: string | null; ssl_status?: string | null; error?: string | null;
}): string {
  return JSON.stringify({ scope: "custom_hostname", at: new Date().toISOString(), ...e,
    error: e.error ? e.error.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]").slice(0, 200) : null });
}
