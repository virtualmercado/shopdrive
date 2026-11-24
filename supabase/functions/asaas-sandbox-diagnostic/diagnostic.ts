// Admin-only, read-only parent-account Sandbox diagnostic. No database writes.
import { asaasRequest, assertAsaasPhase2Environment, sanitizeAsaasError } from "../_shared/asaasClient.ts";

export interface AsaasDiagnosticDeps {
  getUserId: (bearer: string) => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  env: (name: string) => string | undefined;
  fetchImpl: typeof fetch;
}

export async function runAsaasSandboxDiagnostic(
  bearer: string | null,
  deps: AsaasDiagnosticDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!bearer) return { status: 401, body: { ok: false, error: "not_authenticated" } };
  const userId = await deps.getUserId(bearer);
  if (!userId) return { status: 401, body: { ok: false, error: "not_authenticated" } };
  if (!(await deps.isAdmin(userId))) return { status: 403, body: { ok: false, error: "forbidden" } };

  const environment = deps.env("ASAAS_ENVIRONMENT")?.trim();
  try {
    assertAsaasPhase2Environment(environment);
  } catch (error) {
    const sanitized = sanitizeAsaasError(error);
    return {
      status: sanitized.code === "ASAAS_PRODUCTION_BLOCKED" ? 403 : 503,
      body: { ok: false, environment: environment === "production" ? "production" : null, authenticated: false, error: sanitized.code },
    };
  }

  const apiKey = deps.env("ASAAS_SANDBOX_API_KEY")?.trim() ?? "";
  if (!apiKey) {
    return { status: 503, body: { ok: false, environment: "sandbox", authenticated: false, error: "ASAAS_CREDENTIAL_NOT_CONFIGURED" } };
  }

  try {
    await asaasRequest({
      environment: "sandbox",
      apiKey,
      path: "/myAccount/status",
      method: "GET",
      fetchImpl: deps.fetchImpl,
    });
    return { status: 200, body: { ok: true, environment: "sandbox", authenticated: true } };
  } catch (error) {
    const sanitized = sanitizeAsaasError(error);
    return {
      status: 200,
      body: { ok: false, environment: "sandbox", authenticated: false, error: sanitized.code, http_status: sanitized.httpStatus },
    };
  }
}

export async function handleAsaasSandboxDiagnostic(
  req: Request,
  deps: AsaasDiagnosticDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (req.method !== "GET") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
  if (new URL(req.url).search) return { status: 400, body: { ok: false, error: "parameters_not_allowed" } };
  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, "") : null;
  return await runAsaasSandboxDiagnostic(bearer, deps);
}
