// Admin-only, GET-only Cloudflare infrastructure audit (fixed endpoints, sanitized fields).
// Used before any ingress change: lists Custom Hostnames, fallback origin, Worker routes/scripts,
// DNS names and each credential's read reach. Never returns tokens, TXT contents or raw payloads.
import { CLOUDFLARE_API, type DiagnosticDeps } from "./diagnostic.ts";

type Tok = { label: "existing_read_token" | "provisioning_token"; value: string };
const HOST = /^(\*\.)?([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const ID = /^[a-f0-9]{32}$|^[a-f0-9-]{36}$/i;
const SCRIPT = /^[a-z0-9_-]{1,63}$/i;
const PATTERN = /^[a-z0-9*._\/-]{1,255}$/i;
const STATUS = /^[a-z_]{1,40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

const s = (v: unknown, re: RegExp): string | null => (typeof v === "string" && re.test(v) ? v : null);
const host = (v: unknown) => (typeof v === "string" ? s(v.toLowerCase(), HOST) : null);

async function get(deps: DiagnosticDeps, path: string, token: string) {
  try {
    const res = await deps.fetchImpl(`${CLOUDFLARE_API}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, ok: res.status === 200 && body?.success === true, body };
  } catch {
    return { status: 0, ok: false, body: null };
  }
}

/** Try each token in order; report every HTTP status, use the first successful body. */
async function firstOk(deps: DiagnosticDeps, path: string, tokens: Tok[]) {
  const statuses: Record<string, number | null> = {};
  for (const t of tokens) {
    const r = await get(deps, path, t.value);
    statuses[t.label] = r.status || null;
    if (r.ok) return { statuses, readWith: t.label, result: r.body?.result as unknown };
  }
  return { statuses, readWith: null, result: null };
}

export async function runInfrastructureAudit(deps: DiagnosticDeps, zone: string): Promise<Record<string, unknown>> {
  const tokens: Tok[] = [];
  const legacy = (deps.env("CLOUDFLARE_API_TOKEN") ?? "").trim();
  const prov = (deps.env("CLOUDFLARE_CUSTOM_HOSTNAMES_TOKEN") ?? "").trim();
  if (legacy) tokens.push({ label: "existing_read_token", value: legacy });
  if (prov) tokens.push({ label: "provisioning_token", value: prov });
  const z = encodeURIComponent(zone);

  const zoneR = await firstOk(deps, `/zones/${z}`, tokens);
  const zr = zoneR.result as { name?: string; account?: { id?: string }; plan?: { legacy_id?: string } } | null;
  const accountId = s(zr?.account?.id, ID);

  const chR = await firstOk(deps, `/zones/${z}/custom_hostnames?per_page=50`, [...tokens].reverse());
  const customHostnames = Array.isArray(chR.result)
    ? (chR.result as Array<Record<string, any>>).map((h) => ({
        id: s(h?.id, ID),
        hostname: host(h?.hostname),
        status: s(h?.status, STATUS),
        ssl_status: s(h?.ssl?.status, STATUS),
        ssl_method: s(h?.ssl?.method, STATUS),
        ssl_type: s(h?.ssl?.type, STATUS),
        created_at: s(h?.created_at, ISO),
        has_custom_origin_server: typeof h?.custom_origin_server === "string" && h.custom_origin_server.length > 0,
        custom_origin_server: host(h?.custom_origin_server),
        has_custom_metadata: !!h?.custom_metadata && typeof h.custom_metadata === "object",
      }))
    : null;

  const foR = await firstOk(deps, `/zones/${z}/custom_hostnames/fallback_origin`, [...tokens].reverse());
  const fo = foR.result as { origin?: string; status?: string; errors?: unknown[] } | null;

  const routesR = await firstOk(deps, `/zones/${z}/workers/routes`, tokens);
  const routes = Array.isArray(routesR.result)
    ? (routesR.result as Array<Record<string, unknown>>).map((r) => ({
        id: s(r?.id, ID), pattern: s(r?.pattern, PATTERN), script: r?.script == null ? null : s(r.script, SCRIPT),
      }))
    : null;

  const dnsR = await firstOk(deps, `/zones/${z}/dns_records?per_page=200`, tokens);
  const dns = Array.isArray(dnsR.result)
    ? (dnsR.result as Array<Record<string, unknown>>).map((r) => {
        const type = s(r?.type, /^[A-Z]{1,10}$/);
        const showContent = type === "A" || type === "AAAA" || type === "CNAME";
        return {
          name: host(r?.name), type, proxied: r?.proxied === true,
          content: showContent ? (typeof r?.content === "string" && /^[a-z0-9.:_-]{1,253}$/i.test(r.content) ? r.content.toLowerCase() : null) : null,
        };
      })
    : null;

  const scriptsR = accountId
    ? await firstOk(deps, `/accounts/${accountId}/workers/scripts`, tokens)
    : { statuses: {}, readWith: null, result: null };
  const scripts = Array.isArray(scriptsR.result)
    ? (scriptsR.result as Array<Record<string, unknown>>).map((w) => ({ id: s(w?.id, SCRIPT), modified_on: s(w?.modified_on, ISO) }))
    : null;

  // Permission groups of each credential (names only) when the token may read itself.
  const permissions: Record<string, unknown> = {};
  for (const t of tokens) {
    const v = await get(deps, "/user/tokens/verify", t.value);
    const id = s((v.body?.result as { id?: string } | undefined)?.id, ID);
    if (!id) { permissions[t.label] = { readable: false, verify_status: v.status || null }; continue; }
    const d = await get(deps, `/user/tokens/${id}`, t.value);
    const pol = (d.body?.result as { policies?: Array<{ effect?: string; permission_groups?: Array<{ name?: string }> }> } | undefined)?.policies;
    permissions[t.label] = d.ok && Array.isArray(pol)
      ? { readable: true, groups: pol.flatMap((p) => (p.permission_groups ?? []).map((g) => `${p.effect === "deny" ? "deny:" : ""}${typeof g?.name === "string" ? g.name.slice(0, 80) : "?"}`)) }
      : { readable: false, detail_status: d.status || null };
  }

  return {
    zone: { read_status: zoneR.statuses, name_matches_expected: zr?.name ? zr.name.toLowerCase() === "shopdrive.com.br" : null, account_id_present: !!accountId },
    custom_hostnames: { read_status: chR.statuses, read_with: chR.readWith, items: customHostnames },
    fallback_origin: { read_status: foR.statuses, origin: host(fo?.origin), status: s(fo?.status, STATUS), has_errors: Array.isArray(fo?.errors) && fo!.errors!.length > 0 },
    worker_routes: { read_status: routesR.statuses, read_with: routesR.readWith, items: routes },
    worker_scripts: { read_status: scriptsR.statuses, items: scripts },
    dns_records: { read_status: dnsR.statuses, items: dns },
    credential_permissions: permissions,
  };
}
