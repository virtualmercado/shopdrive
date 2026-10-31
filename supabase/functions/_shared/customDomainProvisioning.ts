// Pure Custom Hostname provisioning rules shared by edge functions and unit tests.
// No Deno/browser globals here; network access is injected by the caller.

export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
/** Fixed official CNAME target for merchant custom hostnames. Never accepted from clients. */
export const CUSTOM_HOSTNAME_TARGET = "domains.shopdrive.com.br";
export const PROVISIONING_BATCH_LIMIT = 10;
export const MAX_PROVISION_ATTEMPTS = 40;

/** Ingress hostname normalization: lowercase, no port, no trailing dot, valid DNS name. */
export function normalizeIngressHostname(input: string): string | null {
  let h = (input ?? "").trim().toLowerCase();
  h = h.replace(/:\d+$/, "").replace(/\.$/, "");
  if (!h || h.length > 253) return null;
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/.test(h)) return null;
  return h;
}

/** This phase supports www hostnames only; the external hostname is always www.<canonical>. */
export function externalHostnameForDomain(canonicalDomain: string): string | null {
  return normalizeIngressHostname(`www.${canonicalDomain}`);
}

/** Cloudflare Custom Hostname creation payload: HTTP DCV, DV cert, minimum TLS 1.2. */
export function buildCustomHostnameCreatePayload(hostname: string) {
  return {
    hostname,
    ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
  };
}

/** Idempotency: an existing external id means reconcile, never create a duplicate. */
export type CreateDecision = "create" | "reconcile";
export function decideCreateAction(externalHostnameId: string | null): CreateDecision {
  return externalHostnameId ? "reconcile" : "create";
}

export type ConflictDecision =
  | { kind: "reconcile"; id: string }
  | { kind: "conflict_unknown" }
  | { kind: "not_found" };

/**
 * Cloudflare says the hostname already exists. Reconcile only when the object matches the
 * internally known external id; an unknown external object stops the flow (never assumed, never deleted).
 */
export function classifyHostnameConflict(
  existing: Array<{ id: string; hostname: string }>,
  hostname: string,
  knownId: string | null,
): ConflictDecision {
  const matches = existing.filter((e) => e.hostname === hostname);
  if (matches.length === 0) return { kind: "not_found" };
  if (knownId && matches.some((m) => m.id === knownId)) return { kind: "reconcile", id: knownId };
  return { kind: "conflict_unknown" };
}

export type DeleteOutcome = "removed" | "retry" | "failed";
export function classifyDeleteStatus(httpStatus: number): DeleteOutcome {
  if (httpStatus === 404) return "removed"; // external object already gone
  if (httpStatus >= 200 && httpStatus < 300) return "removed";
  if (httpStatus === 429 || httpStatus >= 500) return "retry"; // transient: keep revoking state
  return "failed";
}

/** Maps Cloudflare Custom Hostname statuses to internal routing/ssl statuses. */
export function mapCloudflareStatuses(hostnameStatus: string, sslStatus: string): { routingStatus: string; sslStatus: string } {
  const routing = hostnameStatus === "active" ? "active" : hostnameStatus === "deleted" ? "error" : "provisioning";
  const ssl = sslStatus === "active" ? "active" : sslStatus === "deleted" ? "error" : "pending";
  return { routingStatus: routing, sslStatus: ssl };
}

/** Exponential backoff in minutes: 5, 10, 20, ... capped at 6 hours. */
export function computeBackoffMinutes(attempts: number): number {
  return Math.min(5 * 2 ** Math.max(0, attempts - 1), 360);
}

/**
 * Sanitized error for storage/logs: status + first provider message, truncated,
 * with any long token-like run redacted. Never includes credentials or raw payloads.
 */
export function sanitizeCloudflareError(status: number, body: unknown): string {
  let msg = "cloudflare_error";
  try {
    const errs = (body as { errors?: Array<{ message?: string }> } | null)?.errors;
    if (Array.isArray(errs) && errs[0]?.message) msg = String(errs[0].message);
  } catch { /* keep default */ }
  return `cf_${status}:${msg.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]").slice(0, 180)}`;
}

/** States the automatic sync routine is allowed to touch. Active domains are never polled. */
export const SYNCABLE_V2_STATES = ["routing_provisioning", "ssl_provisioning"] as const;
export const SYNCABLE_ROUTING_STATUSES = ["provisioning", "removing"] as const;
export function isSyncableDomain(d: { v2_state: string | null; routing_status: string | null; released_at: string | null }): boolean {
  if (d.released_at) return false;
  return (SYNCABLE_V2_STATES as readonly string[]).includes(d.v2_state ?? "") ||
    (SYNCABLE_ROUTING_STATUSES as readonly string[]).includes(d.routing_status ?? "");
}
