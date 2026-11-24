// Authenticated, idempotent account-status webhooks. Unknown fields are ignored.
import { hashWebhookAuthToken, verifyWebhookAuthToken } from "../_shared/asaasCrypto.ts";

export interface WebhookAccount {
  storeId: string;
  webhookTokenHash: string;
}

export interface ApplyWebhookInput {
  storeId: string;
  webhookTokenHash: string;
  eventId: string;
  eventType: string;
  accountId: string;
  payload: Record<string, unknown>;
  statuses: {
    commercialInfo: string | null;
    bankAccountInfo: string | null;
    documentation: string | null;
    general: string | null;
  } | null;
}

export interface AsaasWebhookDeps {
  findAccountByTokenHash: (hash: string) => Promise<WebhookAccount | null>;
  apply: (input: ApplyWebhookInput) => Promise<Record<string, unknown> | null>;
}

type Result = { status: number; body: Record<string, unknown> };
const response = (status: number, body: Record<string, unknown>): Result => ({ status, body });

function safeText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function optionalState(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return safeText(value, 60);
}

export function parseAccountWebhook(value: unknown): Omit<ApplyWebhookInput, "storeId" | "webhookTokenHash"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const eventId = safeText(raw.id, 200);
  const eventType = safeText(raw.event, 120);
  const account = raw.account && typeof raw.account === "object" && !Array.isArray(raw.account) ? raw.account as Record<string, unknown> : null;
  const accountId = safeText(account?.id, 200);
  if (!eventId || !eventType || !/^[A-Z][A-Z0-9_]*$/.test(eventType) || !accountId) return null;

  let statuses: ApplyWebhookInput["statuses"] = null;
  if (raw.accountStatus !== undefined && raw.accountStatus !== null) {
    if (typeof raw.accountStatus !== "object" || Array.isArray(raw.accountStatus)) return null;
    const source = raw.accountStatus as Record<string, unknown>;
    const commercialInfo = optionalState(source.commercialInfo);
    const bankAccountInfo = optionalState(source.bankAccountInfo);
    const documentation = optionalState(source.documentation);
    const general = optionalState(source.general);
    if (commercialInfo === undefined || bankAccountInfo === undefined || documentation === undefined || general === undefined) return null;
    statuses = { commercialInfo, bankAccountInfo, documentation, general };
  }
  if (eventType.startsWith("ACCOUNT_STATUS_") && !statuses) return null;

  return {
    eventId,
    eventType,
    accountId,
    statuses,
    payload: {
      id: eventId,
      event: eventType,
      accountId,
      dateCreated: safeText(raw.dateCreated, 60),
      accountStatus: statuses,
    },
  };
}

export async function handleAsaasWebhook(req: Request, deps: AsaasWebhookDeps): Promise<Result> {
  if (req.method !== "POST") return response(405, { received: false, error: "method_not_allowed" });
  const token = req.headers.get("asaas-access-token") ?? "";
  if (token.length < 32 || token.length > 255) return response(401, { received: false, error: "invalid_token" });
  const tokenHash = await hashWebhookAuthToken(token);
  const account = await deps.findAccountByTokenHash(tokenHash).catch(() => null);
  if (!account || !(await verifyWebhookAuthToken(token, account.webhookTokenHash))) {
    return response(401, { received: false, error: "invalid_token" });
  }

  const text = await req.text();
  if (text.length > 65_536) return response(400, { received: false, error: "invalid_event" });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return response(400, { received: false, error: "invalid_event" });
  }
  const event = parseAccountWebhook(raw);
  if (!event) return response(400, { received: false, error: "invalid_event" });

  const result = await deps.apply({
    storeId: account.storeId,
    webhookTokenHash: tokenHash,
    ...event,
  }).catch(() => null);
  if (!result) return response(503, { received: false, error: "processing_unavailable" });
  switch (result.state) {
    case "duplicate": return response(200, { received: true, duplicate: true });
    case "deferred": return response(200, { received: true, deferred: true });
    case "processed": return response(200, { received: true, processed: true });
    case "ignored": return response(200, { received: true, ignored: true });
    case "unauthorized": return response(401, { received: false, error: "invalid_token" });
    default: return response(503, { received: false, error: "processing_unavailable" });
  }
}
