/**
 * shopdrive-custom-domain-router — generic multi-hostname ingress Worker.
 *
 * Receives any Cloudflare Custom Hostname provisioned on the SaaS zone and forwards
 * the request to the fixed ShopDrive upstream. The active Custom Hostname is the
 * first ingress allowlist; final store authorization is done by the V2 resolver
 * inside the application. This Worker has no database dependency, no merchant
 * hostname hardcoded and never identifies a store by slug/querystring.
 *
 * Deploy note (manual admin step): publish keeping the AROMA-specific route,
 * validate, add the zone wildcard route `*/*`, validate again, only then remove
 * the `www.redearoma.com.br/*` route. Rollback: remove the wildcard, keep the
 * AROMA route.
 */

const UPSTREAM_ORIGIN = "https://shopdrive.com.br";
const LOOP_HEADER = "x-shopdrive-custom-domain";

const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
];

/** lowercase, no port, no trailing dot, valid DNS name; null when empty/invalid. */
function normalizeIngressHostname(input: string): string | null {
  let h = (input ?? "").trim().toLowerCase();
  h = h.replace(/:\d+$/, "").replace(/\.$/, "");
  if (!h || h.length > 253) return null;
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/.test(h)) return null;
  return h;
}

export default {
  async fetch(request: Request): Promise<Response> {
    // Loop protection: a request already stamped by this Worker fails closed.
    if (request.headers.get(LOOP_HEADER)) {
      return new Response("loop detected", { status: 508 });
    }

    const url = new URL(request.url);
    const host = normalizeIngressHostname(url.hostname);
    if (!host) {
      return new Response("invalid hostname", { status: 400 });
    }

    // Fixed upstream only: path and query preserved, never a client-supplied target.
    const upstream = new URL(url.pathname + url.search, UPSTREAM_ORIGIN);

    const headers = new Headers(request.headers);
    for (const h of HOP_BY_HOP) headers.delete(h);
    headers.set(LOOP_HEADER, "1");
    headers.set("x-forwarded-host", host);

    const method = request.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";

    // No logging of Authorization, cookies, tokens or payment data anywhere here.
    return fetch(upstream.toString(), {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
    });
  },
};
