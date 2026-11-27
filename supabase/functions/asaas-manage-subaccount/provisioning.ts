// Sandbox-only subaccount creation. Every provider call goes through asaasRequest once.
import { asaasRequest, AsaasError, assertAsaasPhase2Environment, sanitizeAsaasError } from "../_shared/asaasClient.ts";
import { decryptSubaccountApiKey, encryptSubaccountApiKey, fingerprintSubaccountApiKey, generateWebhookAuthToken, hashWebhookAuthToken } from "../_shared/asaasCrypto.ts";
import {
  ASAAS_ACCOUNT_STATUS_EVENTS,
  accountNumberFromResponse,
  deriveAsaasAccountStatus,
  isUuid,
  normalizeAndValidateSubaccount,
  normalizeInstitutionalEmail,
  optionalIdentifier,
  parseAsaasAccountStatuses,
  sanitizeAsaasAccount,
} from "../_shared/asaasSubaccount.ts";

export interface BeginResult {
  state: string;
  attemptToken?: string;
  account?: Record<string, unknown>;
}

export interface CaptureInput {
  attemptToken: string;
  accountId: string;
  walletId: string;
  accountNumber: string | null;
  encryptedApiKey: string;
  apiKeyFingerprint: string;
}

export interface CompleteInput {
  attemptToken: string;
  statuses: ReturnType<typeof parseAsaasAccountStatuses>;
  status: "awaiting_documents" | "under_review" | "active" | "rejected";
  errorCode: string | null;
}

export interface FailInput {
  attemptToken: string;
  errorCode: string;
  accountId?: string | null;
  walletId?: string | null;
  accountNumber?: string | null;
}

export interface AsaasProvisioningDeps {
  getUserId: (bearer: string) => Promise<string | null>;
  canManageStore: (actor: string, storeId: string) => Promise<boolean>;
  getInstitutionalEmail: () => Promise<string | null>;
  begin: (actor: string, storeId: string, webhookTokenHash: string, authorizationId: string) => Promise<BeginResult | null>;
  isAdmin: (actor: string) => Promise<boolean>;
  reconcileEvents: (storeId: string) => Promise<Record<string, unknown>>;
  capture: (input: CaptureInput) => Promise<boolean>;
  complete: (input: CompleteInput) => Promise<boolean>;
  fail: (input: FailInput) => Promise<boolean>;
  env: (name: string) => string | undefined;
  fetchImpl: typeof fetch;
}

type Result = { status: number; body: Record<string, unknown> };

const error = (status: number, code: string): Result => ({ status, body: { ok: false, error: code } });
const accountResult = (state: string, account: Record<string, unknown>, status = 200): Result => ({
  status,
  body: { ok: true, state, account: sanitizeAsaasAccount(account) },
});

function localAccount(storeId: string, status: string, errorCode: string | null = null, accountId: string | null = null): Record<string, unknown> {
  return { storeId, environment: "sandbox", status, accountId, lastErrorCode: errorCode };
}

function webhookUrl(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const base = new URL(supabaseUrl);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return null;
    return `${base.origin}${base.pathname.replace(/\/$/, "")}/functions/v1/asaas-webhook`;
  } catch {
    return null;
  }
}

function creationIdentifiers(response: Record<string, unknown>) {
  return {
    accountId: optionalIdentifier(response.id),
    walletId: optionalIdentifier(response.walletId),
    accountNumber: accountNumberFromResponse(response.accountNumber),
  };
}

export async function runAsaasSubaccountCreate(
  actor: string,
  input: Record<string, unknown>,
  deps: AsaasProvisioningDeps,
): Promise<Result> {
  if (input.action !== "create") return error(400, "invalid_action");
  if (input.environment !== undefined && input.environment !== "sandbox") {
    return error(input.environment === "production" ? 403 : 400, input.environment === "production" ? "ASAAS_PRODUCTION_BLOCKED" : "ASAAS_INVALID_ENVIRONMENT");
  }
  if (!isUuid(input.storeId)) return error(400, "invalid_store_id");
  const storeId = input.storeId;
  if (!(await deps.canManageStore(actor, storeId).catch(() => false))) return error(403, "forbidden");
  if (!isUuid(input.authorizationId)) return error(403, "creation_not_authorized");

  try {
    assertAsaasPhase2Environment(deps.env("ASAAS_ENVIRONMENT")?.trim());
  } catch (caught) {
    const sanitized = sanitizeAsaasError(caught);
    return error(sanitized.code === "ASAAS_PRODUCTION_BLOCKED" ? 403 : 503, sanitized.code);
  }
  const validated = normalizeAndValidateSubaccount(input.data);
  if (!validated.ok) return { status: 400, body: { ok: false, error: "invalid_subaccount_data", field: validated.field, code: validated.error } };
  const data = validated.data;

  const parentKey = deps.env("ASAAS_SANDBOX_API_KEY")?.trim() ?? "";
  const masterKey = deps.env("ASAAS_SUBACCOUNT_ENCRYPTION_KEY") ?? "";
  const notificationEmail = normalizeInstitutionalEmail(await deps.getInstitutionalEmail().catch(() => null));
  const destination = webhookUrl(deps.env("SUPABASE_URL"));
  if (!parentKey) return error(503, "ASAAS_CREDENTIAL_NOT_CONFIGURED");
  if (masterKey.length < 32) return error(503, "ASAAS_CRYPTO_NOT_CONFIGURED");
  if (!notificationEmail) return error(503, "ASAAS_INSTITUTIONAL_EMAIL_NOT_CONFIGURED");
  if (!destination) return error(503, "ASAAS_WEBHOOK_URL_NOT_CONFIGURED");

  let rawWebhookToken = generateWebhookAuthToken();
  const webhookTokenHash = await hashWebhookAuthToken(rawWebhookToken);
  const begin = await deps.begin(actor, storeId, webhookTokenHash, input.authorizationId).catch(() => null);
  if (!begin) return error(503, "ASAAS_RESERVATION_FAILED");
  if (begin.state === "creation_in_progress") return { status: 202, body: { ok: true, state: "creation_in_progress" } };
  if (begin.state === "forbidden") return error(403, "forbidden");
  if (begin.state === "creation_not_authorized") return error(403, "creation_not_authorized");
  if (begin.state === "reconciliation_required") return error(409, "ASAAS_RECONCILIATION_REQUIRED");
  if (begin.state === "existing" && begin.account) return accountResult("existing", begin.account);
  if (begin.state !== "claimed" || !isUuid(begin.attemptToken)) return error(503, "ASAAS_RESERVATION_FAILED");
  const attemptToken = begin.attemptToken;

  const fail = async (details: FailInput) => {
    await deps.fail(details).catch(() => false);
    return accountResult("error", localAccount(storeId, "error", details.errorCode, details.accountId ?? null), 409);
  };
  const webhook = {
    name: "ShopDrive — situação cadastral",
    url: destination,
    email: notificationEmail,
    apiVersion: 3,
    enabled: true,
    interrupted: false,
    sendType: "SEQUENTIALLY",
    authToken: rawWebhookToken,
    events: [...ASAAS_ACCOUNT_STATUS_EVENTS],
  };
  const payload: Record<string, unknown> = { ...data, webhooks: [webhook] };
  let created: Record<string, unknown>;
  try {
    created = await asaasRequest({
      environment: "sandbox",
      apiKey: parentKey,
      path: "/accounts",
      method: "POST",
      body: payload,
      fetchImpl: deps.fetchImpl,
    });
  } catch (caught) {
    rawWebhookToken = "";
    webhook.authToken = "";
    const sanitized = sanitizeAsaasError(caught);
    if (caught instanceof AsaasError && caught.httpStatus !== null && caught.httpStatus >= 400 && caught.httpStatus < 500 && caught.httpStatus !== 429) {
      return await fail({ attemptToken, errorCode: "ASAAS_CREATE_REJECTED" });
    }
    return await fail({ attemptToken, errorCode: "ASAAS_RECONCILIATION_REQUIRED" });
  }
  rawWebhookToken = "";
  webhook.authToken = "";

  const identifiers = creationIdentifiers(created);
  let rawApiKey = typeof created.apiKey === "string" && created.apiKey.length > 0 && created.apiKey.length <= 4096
    ? created.apiKey
    : null;
  if (!identifiers.accountId || !identifiers.walletId || !rawApiKey) {
    rawApiKey = null;
    // A document lookup cannot distinguish two stores of the same titular.
    return await fail({ attemptToken, errorCode: "ASAAS_RECONCILIATION_REQUIRED" });
  }

  let encryptedApiKey: string;
  let apiKeyFingerprint: string;
  try {
    // Capture and encrypt before any persistence; neither raw key nor provider response is logged.
    encryptedApiKey = await encryptSubaccountApiKey(rawApiKey, masterKey);
    apiKeyFingerprint = await fingerprintSubaccountApiKey(rawApiKey);
  } catch {
    rawApiKey = null;
    return await fail({ attemptToken, errorCode: "ASAAS_SUBACCOUNT_CREATED_API_KEY_NOT_CAPTURED", ...identifiers });
  }
  rawApiKey = null;

  const captured = await deps.capture({
    attemptToken,
    accountId: identifiers.accountId,
    walletId: identifiers.walletId,
    accountNumber: identifiers.accountNumber,
    encryptedApiKey,
    apiKeyFingerprint,
  }).catch(() => false);
  if (!captured) {
    return await fail({ attemptToken, errorCode: "ASAAS_SUBACCOUNT_CREATED_API_KEY_NOT_CAPTURED", ...identifiers });
  }

  let subaccountKey = "";
  try {
    subaccountKey = await decryptSubaccountApiKey(encryptedApiKey, masterKey);
    const statusResponse = await asaasRequest({
      environment: "sandbox",
      apiKey: subaccountKey,
      path: "/myAccount/status",
      method: "GET",
      fetchImpl: deps.fetchImpl,
    });
    const statuses = parseAsaasAccountStatuses(statusResponse);
    if (!statuses) throw new Error("ASAAS_INVALID_RESPONSE");
    const status = deriveAsaasAccountStatus(statuses);
    const completed = await deps.complete({ attemptToken, statuses, status, errorCode: null }).catch(() => false);
    if (!completed) return error(503, "ASAAS_STATUS_PERSISTENCE_FAILED");
    return accountResult("created", localAccount(storeId, status, null, identifiers.accountId), 201);
  } catch {
    await deps.complete({ attemptToken, statuses: null, status: "under_review", errorCode: "ASAAS_STATUS_SYNC_FAILED" }).catch(() => false);
    return accountResult("created", localAccount(storeId, "under_review", "ASAAS_STATUS_SYNC_FAILED", identifiers.accountId), 201);
  } finally {
    subaccountKey = "";
    encryptedApiKey = "";
    apiKeyFingerprint = "";
  }
}

export async function handleAsaasManageSubaccount(req: Request, deps: AsaasProvisioningDeps): Promise<Result> {
  if (req.method !== "POST") return error(405, "method_not_allowed");
  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, "") : null;
  if (!bearer) return error(401, "not_authenticated");
  const actor = await deps.getUserId(bearer).catch(() => null);
  if (!isUuid(actor)) return error(401, "not_authenticated");
  const text = await req.text();
  if (text.length > 32_768) return error(400, "invalid_input");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return error(400, "invalid_json");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return error(400, "invalid_input");
  const parsed = input as Record<string, unknown>;
  if (parsed.action === "reconcile_events") {
    if (parsed.environment !== undefined && parsed.environment !== "sandbox") return error(403, "ASAAS_PRODUCTION_BLOCKED");
    if (!isUuid(parsed.storeId)) return error(400, "invalid_store_id");
    if (!(await deps.isAdmin(actor).catch(() => false))) return error(403, "forbidden");
    const result = await deps.reconcileEvents(parsed.storeId).catch(() => ({ state: "deferred" }));
    return { status: 200, body: { ok: true, ...result } };
  }
  return await runAsaasSubaccountCreate(actor, input as Record<string, unknown>, deps);
}
