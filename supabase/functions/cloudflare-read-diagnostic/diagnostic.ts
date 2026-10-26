// Admin-only, GET-only Cloudflare Custom Hostnames diagnostic. Pure: dependencies are injected.
// Never returns, logs or persists credential values.

export interface DiagnosticDeps {
  getUserId: (bearer: string) => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  env: (name: string) => string | undefined;
  fetchImpl: typeof fetch;
}

export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const SECRET_NAMES = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"] as const;

export type Classification = "token_invalid" | "permission_insufficient" | "zone_id_incorrect" | "resource_unavailable" | "network_error" | null;

export function classify(status: number, codes: number[]): Classification {
  if (status === 0) return "network_error";
  if (status === 401 || codes.some((c) => [1000, 6003, 6111, 9106, 9109].includes(c))) return "token_invalid";
  if (status === 403 || codes.includes(10000)) return "permission_insufficient";
  if (status === 404 || codes.some((c) => [7003, 1001].includes(c))) return "zone_id_incorrect";
  if (status >= 400) return "resource_unavailable";
  return null;
}

/** Removes anything that could echo a credential/identifier from a provider message. */
export function sanitizeMessage(msg: unknown, secrets: string[]): string {
  let s = String(msg ?? "").slice(0, 200);
  for (const v of secrets) if (v) s = s.split(v).join("[redacted]");
  return s.replace(/[a-f0-9]{32}/gi, "[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export async function runDiagnostic(bearer: string | null, deps: DiagnosticDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!bearer) return { status: 401, body: { error: "not_authenticated" } };
  const userId = await deps.getUserId(bearer);
  if (!userId) return { status: 401, body: { error: "not_authenticated" } };
  if (!(await deps.isAdmin(userId))) return { status: 403, body: { error: "forbidden" } };

  const missing = SECRET_NAMES.filter((n) => !(deps.env(n) ?? "").trim());
  if (missing.length) return { status: 200, body: { ok: false, missing_secrets: missing } };
  const token = deps.env("CLOUDFLARE_API_TOKEN")!.trim();
  const zone = deps.env("CLOUDFLARE_ZONE_ID")!.trim();

  let res: Response;
  try {
    res = await deps.fetchImpl(`${CLOUDFLARE_API}/zones/${encodeURIComponent(zone)}/custom_hostnames?per_page=50`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    return { status: 200, body: { ok: false, reachable: false, http_status: null, classification: "network_error" } };
  }
  const j = await res.json().catch(() => null) as
    | { success?: boolean; errors?: Array<{ code?: number; message?: string }>; result?: Array<{ status?: string; ssl?: { status?: string } }>; result_info?: { total_count?: number } }
    | null;
  const codes = (j?.errors ?? []).map((e) => Number(e.code)).filter(Number.isFinite);
  const success = res.ok && j?.success === true && Array.isArray(j?.result);
  const agg = (k: (h: { status?: string; ssl?: { status?: string } }) => string | undefined) =>
    (j?.result ?? []).reduce<Record<string, number>>((a, h) => { const v = k(h) ?? "unknown"; a[v] = (a[v] ?? 0) + 1; return a; }, {});
  return {
    status: 200,
    body: {
      ok: success,
      reachable: true,
      http_status: res.status,
      success: j?.success === true,
      structure_valid: Array.isArray(j?.result),
      total_count: success ? (j?.result_info?.total_count ?? j!.result!.length) : null,
      hostname_status: success ? agg((h) => h.status) : null,
      ssl_status: success ? agg((h) => h.ssl?.status) : null,
      error_code: codes[0] ?? null,
      error_message: success ? null : sanitizeMessage(j?.errors?.[0]?.message, [token, zone]),
      classification: success ? null : classify(res.status, codes),
    },
  };
}