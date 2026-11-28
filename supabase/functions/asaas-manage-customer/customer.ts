// Phase 5.1: local preparation only. No provider transport or credential access.
import { isUuid, normalizeInstitutionalEmail, validCpf, validCnpj } from "../_shared/asaasSubaccount.ts";

export const CUSTOMER_STORE = "323c7e89-7d28-492f-b3bc-be9f7f014bf0";
export const CUSTOMER_ACCOUNT = "111ce0e7-8dd0-4348-97bd-4b25add64fb0";
const REFERENCE = /^sd_customer_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Result = { status: number; body: Record<string, unknown> };
export type CustomerData = { name: string; cpfCnpj: string; email?: string; phone?: string; mobilePhone?: string;
  postalCode?: string; address?: string; addressNumber?: string; complement?: string; province?: string };
type Validated = { ok: true; data: CustomerData } | { ok: false; field: string };
export interface LocalCustomer {
  id: string; document: string; profileId: string | null; accountId: string;
  state: string; providerId: string | null; externalReference: string; sent: boolean;
}
export interface CustomerDeps {
  getUserId: (jwt: string) => Promise<string | null>;
  isAdmin: (actor: string) => Promise<boolean>;
  accountId: () => Promise<string | null>;
  assertScope: (actor: string, account: string) => Promise<void>;
  hasCommercialLink: (profile: string) => Promise<boolean>;
  findLocal: (document: string, profile: string | null) => Promise<LocalCustomer[]>;
}
const rejected = (status: number, code: string): Result => ({ status, body: { ok: false, error: code } });
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length <= max &&
  !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : "";
const digits = (v: unknown) => typeof v === "string" && /^[\d\s().+/-]+$/.test(v) ? v.replace(/\D/g, "") : "";

export function normalizeCustomer(input: unknown): Validated {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, field: "data" };
  const raw = input as Record<string, unknown>;
  const name = text(raw.name, 160), cpfCnpj = digits(raw.cpfCnpj);
  if (!name) return { ok: false, field: "name" };
  if (!validCpf(cpfCnpj) && !validCnpj(cpfCnpj)) return { ok: false, field: "cpfCnpj" };
  const data: CustomerData = { name, cpfCnpj };
  if (raw.email !== undefined && raw.email !== null && raw.email !== "") {
    const email = normalizeInstitutionalEmail(raw.email);
    if (!email) return { ok: false, field: "email" };
    data.email = email;
  }
  for (const field of ["phone", "mobilePhone", "postalCode"] as const) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === "") continue;
    let value = digits(raw[field]);
    if (field !== "postalCode" && value.startsWith("55") && [12, 13].includes(value.length)) value = value.slice(2);
    const validLength = field === "postalCode" ? value.length === 8 : [10, 11].includes(value.length);
    if (!validLength || /^(\d)\1+$/.test(value)) return { ok: false, field };
    data[field] = value;
  }
  for (const [field, max] of [["address", 200], ["addressNumber", 30], ["complement", 200], ["province", 120]] as const) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === "") continue;
    const value = text(raw[field], max);
    if (!value) return { ok: false, field };
    data[field] = value;
  }
  return { ok: true, data };
}

// Prepared only in memory from normalized fields; never sent or returned by HTTP.
export function sandboxCustomerPayload(data: CustomerData, externalReference: string) {
  if (!REFERENCE.test(externalReference)) throw new Error("ASAAS_CUSTOMER_INVALID_REFERENCE");
  const checked = normalizeCustomer(data);
  if (!checked.ok) throw new Error("ASAAS_CUSTOMER_INVALID_DATA");
  return { ...checked.data, externalReference, notificationDisabled: true as const };
}

// Evidence must come from a future authenticated GET in this exact subaccount.
// Incomplete pagination, document-only hits and duplicate IDs cannot establish identity.
export function matchCustomerEvidence(reference: string, document: string, accountId: string,
  evidence: { accountId: string; complete: boolean; data: unknown[] }) {
  if (accountId !== CUSTOMER_ACCOUNT || evidence.accountId !== accountId || !evidence.complete || !REFERENCE.test(reference))
    return { state: "reconciliation_required" };
  if (evidence.data.length !== 1) return { state: "reconciliation_required" };
  const raw = evidence.data[0];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { state: "identity_conflict" };
  const row = raw as Record<string, unknown>;
  if (row.externalReference !== reference || digits(row.cpfCnpj) !== document ||
    typeof row.id !== "string" || !/^cus_[A-Za-z0-9]+$/.test(row.id)) return { state: "identity_conflict" };
  return { state: "matched", providerId: row.id };
}

export function inspectLocalMatches(rows: LocalCustomer[], document: string, profile: string | null, account: string) {
  if (rows.length > 1) return { state: "identity_conflict" };
  const row = rows[0];
  if (!row) return { state: "ready_for_local_reservation" };
  if (row.document !== document || (profile !== null && row.profileId !== profile) || row.accountId !== account ||
    !REFERENCE.test(row.externalReference)) return { state: "identity_conflict" };
  if (row.state === "linked" && row.providerId) return { state: "existing", customerId: row.id };
  return { state: row.sent || row.state === "blocked" ? "reconciliation_required" : "reservation_exists", customerId: row.id };
}

export async function handleAsaasManageCustomer(req: Request, deps: CustomerDeps): Promise<Result> {
  if (req.method !== "POST") return rejected(405, "method_not_allowed");
  const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) return rejected(401, "unauthorized");
  const actor = await deps.getUserId(bearer).catch(() => null);
  if (!actor || !isUuid(actor)) return rejected(401, "unauthorized");
  if (!await deps.isAdmin(actor).catch(() => false)) return rejected(403, "forbidden");
  let input: Record<string, unknown>;
  try {
    const raw: unknown = JSON.parse(await req.text());
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return rejected(400, "invalid_request");
    input = raw as Record<string, unknown>;
  } catch { return rejected(400, "invalid_json"); }
  // Explicit environment, never fallback to Production or read any Asaas secret.
  if (input.environment !== "sandbox") return rejected(403, "ASAAS_CUSTOMER_ENVIRONMENT_BLOCKED");
  if (input.storeId !== CUSTOMER_STORE) return rejected(403, "ASAAS_CUSTOMER_SCOPE_BLOCKED");
  // No runtime flag, visual access or expired/consumed grant can bypass this gate.
  if (["create", "reserve", "reconcile", "lookup_external"].includes(String(input.action)))
    return rejected(403, "ASAAS_PHASE_52_NOT_AUTHORIZED");
  if (input.action !== "prepare") return rejected(400, "invalid_action");
  const checked = normalizeCustomer(input.data);
  if (!checked.ok) return { status: 400, body: { ok: false, error: "invalid_customer_data", field: checked.field } };
  const profile = input.customerProfileId ?? null;
  if (profile !== null && !isUuid(profile)) return rejected(400, "invalid_customer_profile_id");
  try {
    const account = await deps.accountId();
    if (!account) return rejected(403, "ASAAS_CUSTOMER_ACCOUNT_NOT_APPROVED");
    await deps.assertScope(actor, account);
    if (profile !== null && !await deps.hasCommercialLink(profile)) return rejected(403, "ASAAS_CUSTOMER_COMMERCIAL_SCOPE_BLOCKED");
    const rows = await deps.findLocal(checked.data.cpfCnpj, profile);
    const result = inspectLocalMatches(rows, checked.data.cpfCnpj, profile, account);
    return { status: result.state === "identity_conflict" ? 409 : 200,
      body: { ok: result.state !== "identity_conflict", ...result, environment: "sandbox", externalExecutionEnabled: false } };
  } catch { return rejected(503, "ASAAS_CUSTOMER_LOCAL_CHECK_FAILED"); }
}