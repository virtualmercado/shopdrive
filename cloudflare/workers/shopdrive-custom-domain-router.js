/**
 * shopdrive-custom-domain-router — global ingress Worker for ShopDrive merchant custom domains.
 *
 * Plain JavaScript single-file module (default export only) so it can be pasted unchanged into the
 * Cloudflare dashboard editor. No secrets: the resolver key below is the public publishable key that the
 * ShopDrive storefront already ships in its browser bundle.
 *
 * Flow (fail-closed):
 *  1. hostname = new URL(request.url).hostname, normalized (lowercase, no trailing dot, valid DNS name).
 *  2. ShopDrive/internal hostnames (PROTECTED_HOST_SUFFIXES, kept identical to
 *     supabase/functions/_shared/customDomainCore.ts by a unit test) pass through untouched.
 *  3. Any other hostname must resolve through the existing backend rule
 *     public.resolve_public_store_by_domain (active V2 domain + authorized store). Unknown, pending,
 *     blocked, removed or inactive hostnames get 421. Resolver unavailable -> 503 (never a default store).
 *  4. Authorized hosts are proxied to the fixed UPSTREAM_ORIGIN with a header allowlist (no cookies,
 *     no Authorization); redirects to shopdrive.com.br are rewritten to the current hostname and
 *     Set-Cookie is dropped from responses.
 *
 * Logs contain only sanitized hostname, status, duration and a technical code.
 * Deploy/rollback: docs/custom-domain-global-ingress.md.
 */

const UPSTREAM_ORIGIN = "https://shopdrive.com.br";
const UPSTREAM_REDIRECT_HOSTS = ["shopdrive.com.br", "www.shopdrive.com.br"];
const RESOLVER_URL = "https://nkoogfznnqlnragbauez.supabase.co/rest/v1/rpc/resolve_public_store_by_domain";
const RESOLVER_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rb29nZnpubnFsbnJhZ2JhdWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzkxNDksImV4cCI6MjA3ODgxNTE0OX0.aN2FpNeCDx19jzEv9LA5vyf8TRFric5lO3HLxAZnsoA";
const RESOLVER_TIMEOUT_MS = 4000;
const CACHE_ALLOW_MS = 60_000;
const CACHE_DENY_MS = 30_000;
const STALE_ALLOW_ON_ERROR_MS = 300_000;
const CACHE_MAX_ENTRIES = 1000;
const LOOP_HEADER = "x-shopdrive-custom-domain";
const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

const PROTECTED_HOST_SUFFIXES = [
  "shopdrive.com.br",
  "virtualmercado.com.br",
  "lovable.app",
  "lovable.dev",
  "lovableproject.com",
  "supabase.co",
  "supabase.in",
  "supabase.com",
];

/** Request headers forwarded to the upstream. Everything else (cookie, authorization, x-forwarded-*, x-shopdrive-*) is dropped. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "cache-control",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "pragma",
  "range",
  "user-agent",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @type {Map<string, { allowed: boolean; at: number }>} */
const decisionCache = new Map();

/** lowercase, no port, no trailing dot, valid DNS name with alphabetic TLD; null when empty/invalid. */
function normalizeIngressHostname(input) {
  let h = String(input ?? "").trim().toLowerCase();
  h = h.replace(/:\d+$/, "").replace(/\.$/, "");
  if (!h || h.length > 253) return null;
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/.test(h)) return null;
  return h;
}

function isProtectedHost(host) {
  return PROTECTED_HOST_SUFFIXES.some((r) => host === r || host.endsWith("." + r));
}

function isWorkersDevHost(host) {
  return host === "workers.dev" || host.endsWith(".workers.dev");
}

function plain(status, text, extra) {
  const headers = new Headers({ "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  if (extra) for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(text, { status, headers });
}

function log(host, status, started, code) {
  console.log(JSON.stringify({ host, status, ms: Date.now() - started, code }));
}

function remember(host, allowed, now) {
  if (decisionCache.size >= CACHE_MAX_ENTRIES) decisionCache.clear();
  decisionCache.set(host, { allowed, at: now });
}

/** Asks the existing backend rule whether this exact hostname belongs to one authorized active store. */
async function resolveHostname(host, now) {
  const cached = decisionCache.get(host);
  if (cached && now - cached.at < (cached.allowed ? CACHE_ALLOW_MS : CACHE_DENY_MS)) {
    return { decision: cached.allowed ? "allow" : "deny", code: "cache" };
  }
  try {
    const res = await fetch(RESOLVER_URL, {
      method: "POST",
      headers: {
        apikey: RESOLVER_PUBLISHABLE_KEY,
        authorization: "Bearer " + RESOLVER_PUBLISHABLE_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ p_hostname: host }),
      // Workers runtime only supports "follow" | "manual"; a redirect is treated as a resolver failure below.
      redirect: "manual",
      signal: AbortSignal.timeout(RESOLVER_TIMEOUT_MS),
    });
    if (res.status !== 200) throw new Error("resolver_http_" + res.status);
    const rows = await res.json();
    const allowed = Array.isArray(rows) && rows.length === 1 &&
      typeof rows[0]?.store_id === "string" && UUID_RE.test(rows[0].store_id);
    remember(host, allowed, now);
    return { decision: allowed ? "allow" : "deny", code: allowed ? "resolved" : "not_authorized" };
  } catch {
    // A hostname confirmed active moments ago keeps working through a short backend outage;
    // anything else fails closed.
    if (cached && cached.allowed && now - cached.at < STALE_ALLOW_ON_ERROR_MS) {
      return { decision: "allow", code: "stale_allow" };
    }
    return { decision: "unavailable", code: "resolver_unavailable" };
  }
}

/** Rewrites ShopDrive-origin redirects to the hostname the visitor actually used. */
function rewriteLocation(location, host) {
  let target;
  try {
    target = new URL(location, UPSTREAM_ORIGIN + "/");
  } catch {
    return location;
  }
  if (!UPSTREAM_REDIRECT_HOSTS.includes(target.hostname.toLowerCase())) return location;
  // Relative redirects stay relative; absolute ShopDrive redirects move to the current hostname over https.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(location) && !location.startsWith("//")) return location;
  target.protocol = "https:";
  target.hostname = host;
  target.port = "";
  return target.toString();
}

export default {
  async fetch(request) {
    const started = Date.now();
    const url = new URL(request.url);
    const host = normalizeIngressHostname(url.hostname);
    if (!host) {
      log("invalid", 400, started, "invalid_hostname");
      return plain(400, "Hostname inválido.");
    }

    // Internal ShopDrive hosts are never rerouted: forward the original request unchanged.
    if (isProtectedHost(host)) {
      return fetch(request);
    }

    // Loop protection: a request already stamped by this Worker fails closed.
    if (request.headers.get(LOOP_HEADER)) {
      log(host, 508, started, "loop");
      return plain(508, "loop detected");
    }

    const method = request.method.toUpperCase();
    if (!ALLOWED_METHODS.includes(method)) {
      return plain(405, "Método não permitido.", { allow: ALLOWED_METHODS.join(", ") });
    }

    if (isWorkersDevHost(host)) {
      log(host, 421, started, "workers_dev");
      return plain(421, "Domínio não autorizado.");
    }

    const resolved = await resolveHostname(host, started);
    if (resolved.decision === "deny") {
      log(host, 421, started, resolved.code);
      return plain(421, "Domínio não autorizado.");
    }
    if (resolved.decision === "unavailable") {
      log(host, 503, started, resolved.code);
      return plain(503, "Serviço temporariamente indisponível.", { "retry-after": "30" });
    }

    // Fixed upstream only: path and query preserved, never a client-supplied target.
    const upstream = new URL(url.pathname + url.search, UPSTREAM_ORIGIN);
    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const v = request.headers.get(name);
      if (v !== null) headers.set(name, v);
    }
    headers.set(LOOP_HEADER, "1");
    headers.set("x-forwarded-host", host);
    headers.set("x-forwarded-proto", "https");

    const hasBody = method !== "GET" && method !== "HEAD";
    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstream.toString(), {
        method,
        headers,
        body: hasBody ? request.body : undefined,
        redirect: "manual",
      });
    } catch {
      log(host, 502, started, "upstream_unavailable");
      return plain(502, "Loja temporariamente indisponível.");
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("set-cookie");
    const location = responseHeaders.get("location");
    if (location && upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      responseHeaders.set("location", rewriteLocation(location, host));
    }
    if (upstreamResponse.status >= 500) log(host, upstreamResponse.status, started, "upstream_status");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

