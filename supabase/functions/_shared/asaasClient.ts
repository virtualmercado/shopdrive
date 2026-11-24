// Server-side only Asaas API v3 transport. Phase 2 permits Sandbox calls only.
// Never pass provider response bodies, credentials or headers to callers or logs.

export type AsaasEnvironment = "sandbox" | "production";
export type AsaasErrorCode =
  | "ASAAS_TIMEOUT"
  | "ASAAS_NETWORK_ERROR"
  | "ASAAS_AUTH_ERROR"
  | "ASAAS_RATE_LIMITED"
  | "ASAAS_VALIDATION_ERROR"
  | "ASAAS_SERVER_ERROR"
  | "ASAAS_INVALID_ENVIRONMENT"
  | "ASAAS_PRODUCTION_BLOCKED"
  | "ASAAS_INVALID_RESPONSE"
  | "ASAAS_CREDENTIAL_NOT_CONFIGURED";

const BASE_URLS: Readonly<Record<AsaasEnvironment, string>> = Object.freeze({
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
});
const MAX_RESPONSE_BYTES = 256_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export class AsaasError extends Error {
  readonly code: AsaasErrorCode;
  readonly httpStatus: number | null;

  constructor(code: AsaasErrorCode, httpStatus: number | null = null) {
    super(code);
    this.name = "AsaasError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function resolveAsaasBaseUrl(environment: unknown): string {
  if (environment !== "sandbox" && environment !== "production") {
    throw new AsaasError("ASAAS_INVALID_ENVIRONMENT");
  }
  return BASE_URLS[environment];
}

export function assertAsaasPhase2Environment(environment: unknown): asserts environment is "sandbox" {
  if (environment !== "sandbox") {
    throw new AsaasError(environment === "production" ? "ASAAS_PRODUCTION_BLOCKED" : "ASAAS_INVALID_ENVIRONMENT");
  }
}

export function assertAsaasUrlMatchesEnvironment(environment: unknown, candidate: string): void {
  const expected = new URL(resolveAsaasBaseUrl(environment));
  const actual = new URL(candidate);
  const expectedPath = `${expected.pathname.replace(/\/$/, "")}/`;
  if (actual.protocol !== "https:" || actual.origin !== expected.origin || !actual.pathname.startsWith(expectedPath)) {
    throw new AsaasError("ASAAS_INVALID_ENVIRONMENT");
  }
}

export function buildAsaasUrl(environment: unknown, path: string): string {
  const base = resolveAsaasBaseUrl(environment);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /(?:^|\/)\.\.(?:\/|$)/.test(path)) {
    throw new AsaasError("ASAAS_VALIDATION_ERROR");
  }
  const url = `${base}${path}`;
  assertAsaasUrlMatchesEnvironment(environment, url);
  return url;
}

function classifyHttpStatus(status: number): AsaasErrorCode {
  if (status === 401 || status === 403) return "ASAAS_AUTH_ERROR";
  if (status === 429) return "ASAAS_RATE_LIMITED";
  if (status >= 500) return "ASAAS_SERVER_ERROR";
  return "ASAAS_VALIDATION_ERROR";
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new AsaasError("ASAAS_INVALID_RESPONSE", response.status);
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AsaasError("ASAAS_INVALID_RESPONSE", response.status);
    }
  }
  if (!response.ok) throw new AsaasError(classifyHttpStatus(response.status), response.status);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AsaasError("ASAAS_INVALID_RESPONSE", response.status);
  }
  return parsed as Record<string, unknown>;
}

export interface AsaasRequestOptions {
  environment: unknown;
  apiKey: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** One request only: no automatic retry, including ambiguous network failures. */
export async function asaasRequest(options: AsaasRequestOptions): Promise<Record<string, unknown>> {
  assertAsaasPhase2Environment(options.environment);
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new AsaasError("ASAAS_CREDENTIAL_NOT_CONFIGURED");
  const method = options.method ?? "GET";
  const url = buildAsaasUrl(options.environment, options.path);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1), 30_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "ShopDrive-Asaas-BaaS/1.0",
    access_token: apiKey,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "error",
      signal: controller.signal,
    });
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof AsaasError) throw error;
    if (controller.signal.aborted || (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))) {
      throw new AsaasError("ASAAS_TIMEOUT");
    }
    throw new AsaasError("ASAAS_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

/** Defensive redaction for future structured logs; provider payloads remain excluded by design. */
export function redactAsaasText(value: string, secrets: readonly string[] = []): string {
  let output = value;
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join("[REDACTED]");
  }
  return output
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(access_token["']?\s*[:=]\s*["']?)[^"'\s,;}]+/gi, "$1[REDACTED]")
    .replace(/((?:webhook[_-]?)?(?:auth[_-]?)?token["']?\s*[:=]\s*["']?)[^"'\s,;}]+/gi, "$1[REDACTED]");
}

export function sanitizeAsaasError(error: unknown): { code: AsaasErrorCode; httpStatus: number | null } {
  if (error instanceof AsaasError) return { code: error.code, httpStatus: error.httpStatus };
  return { code: "ASAAS_NETWORK_ERROR", httpStatus: null };
}
