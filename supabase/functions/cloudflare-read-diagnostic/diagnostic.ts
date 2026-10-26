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

// Provider text is untrusted: only fixed sanitized messages may leave this function.
const SAFE_ERRORS = {
  token_invalid: "A Cloudflare recusou a autenticação.",
  permission_insufficient: "A Cloudflare recusou a leitura; confira SSL and Certificates Read e o acesso à zona.",
  zone_id_incorrect: "A Cloudflare não encontrou o recurso na zona informada.",
  resource_unavailable: "A Cloudflare não retornou uma resposta válida para o recurso solicitado.",
  network_error: "Não foi possível completar a conexão HTTPS com a Cloudflare.",
};
const HOSTNAME_STATUSES = ["active", "pending", "active_redeploying", "moved", "pending_deletion", "deleted", "pending_blocked", "pending_migration", "pending_provisioned", "test_pending", "test_active", "test_active_apex", "test_blocked", "test_failed", "test_timed_out"];
const SSL_STATUSES = ["active", "initializing", "pending_validation", "pending_issuance", "pending_deployment", "pending_expiration", "expired", "pending_deletion", "deleted"];

export async function runDiagnostic(bearer: string | null, deps: DiagnosticDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!bearer) return { status: 401, body: { error: "not_authenticated" } };
  const userId = await deps.getUserId(bearer);
  if (!userId) return { status: 401, body: { error: "not_authenticated" } };
  if (!(await deps.isAdmin(userId))) return { status: 403, body: { error: "forbidden" } };

  const missing = SECRET_NAMES.filter((n) => !(deps.env(n) ?? "").trim());
  if (missing.length) return { status: 200, body: { ok: false, missing_secrets: missing } };
  const token = deps.env("CLOUDFLARE_API_TOKEN")?.trim();
  const zone = deps.env("CLOUDFLARE_ZONE_ID")?.trim();
  if (!token || !zone) return { status: 503, body: { error: "secrets_unavailable" } };
  if (!/^[a-f0-9]{32}$/i.test(zone)) return { status: 200, body: { ok: false, reachable: false, http_status: null, classification: "zone_id_incorrect", error_message: SAFE_ERRORS.zone_id_incorrect } };

  let res: Response;
  try {
    res = await deps.fetchImpl(`${CLOUDFLARE_API}/zones/${encodeURIComponent(zone)}/custom_hostnames?per_page=50`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { status: 200, body: { ok: false, reachable: false, http_status: null, classification: "network_error" } };
  }
  const j = await res.json().catch(() => null) as
    | { success?: boolean; errors?: Array<{ code?: number; message?: string }>; result?: Array<{ status?: string; ssl?: { status?: string } }>; result_info?: { total_count?: number } }
    | null;
  const codes = (Array.isArray(j?.errors) ? j.errors : []).map((e) => Number(e?.code)).filter((c) => Number.isInteger(c) && c >= 0 && c <= 99999);
  const success = res.ok && j?.success === true && Array.isArray(j?.result);
  const rows = Array.isArray(j?.result) ? j.result : [];
  const reportedTotal = j?.result_info?.total_count;
  const total = typeof reportedTotal === "number" && Number.isSafeInteger(reportedTotal) && reportedTotal >= rows.length ? reportedTotal : rows.length;
  const category = success ? null : (classify(res.status, codes) ?? "resource_unavailable");
  const agg = (k: (h: { status?: string; ssl?: { status?: string } }) => string | undefined, allowed: string[]) =>
    rows.reduce<Record<string, number>>((a, h) => { const raw = k(h); const v = raw && allowed.includes(raw) ? raw : "unknown"; a[v] = (a[v] ?? 0) + 1; return a; }, {});
  return {
    status: 200,
    body: {
      ok: success,
      reachable: true,
      http_status: res.status,
      success: j?.success === true,
      structure_valid: Array.isArray(j?.result),
      total_count: success ? total : null,
      aggregated_count: success ? rows.length : null,
      aggregates_complete: success ? total === rows.length : false,
      hostname_status: success ? agg((h) => h?.status, HOSTNAME_STATUSES) : null,
      ssl_status: success ? agg((h) => h?.ssl?.status, SSL_STATUSES) : null,
      error_code: codes[0] ?? null,
      error_message: category ? SAFE_ERRORS[category] : null,
      classification: category,
    },
  };
}

export async function handleDiagnostic(req: Request, deps: DiagnosticDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  if (req.method !== "GET") return { status: 405, body: { error: "method_not_allowed" } };
  if (new URL(req.url).search) return { status: 400, body: { error: "parameters_not_allowed" } };
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = /^Bearer\s+\S+$/i.test(auth) ? auth.replace(/^Bearer\s+/i, "") : null;
  return runDiagnostic(bearer, deps);
}