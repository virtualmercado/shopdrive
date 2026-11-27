export const ASAAS_HOMOLOGATION_STORE_ID = "323c7e89-7d28-492f-b3bc-be9f7f014bf0";

export const ASAAS_MERCHANT_STATUS_STATES = [
  "active",
  "awaiting_documents",
  "under_review",
  "rejected",
  "communication_failed",
  "reconciliation_required",
  "unavailable",
  "no_account",
] as const;

export type AsaasMerchantStatusState = (typeof ASAAS_MERCHANT_STATUS_STATES)[number];
export type AsaasPersistedAccountStatus = "active" | "awaiting_documents" | "under_review" | "rejected";
export type AsaasAreaStatus = "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED";

export interface AsaasMerchantAccount {
  storeId: string;
  environment: "sandbox";
  status: AsaasPersistedAccountStatus;
  commercialStatus: AsaasAreaStatus;
  bankAccountStatus: AsaasAreaStatus;
  documentStatus: AsaasAreaStatus;
  generalApprovalStatus: AsaasAreaStatus;
  lastSyncAt: string;
}

export interface AsaasMerchantStatus {
  state: AsaasMerchantStatusState;
  storeId: string;
  account: AsaasMerchantAccount | null;
}

const AREA_STATUSES = new Set(["PENDING", "AWAITING_APPROVAL", "APPROVED", "REJECTED"]);
const ACCOUNT_STATUSES = new Set(["active", "awaiting_documents", "under_review", "rejected"]);
const MERCHANT_STATES = new Set<string>(ASAAS_MERCHANT_STATUS_STATES);

export function unavailableAsaasMerchantStatus(storeId = ASAAS_HOMOLOGATION_STORE_ID): AsaasMerchantStatus {
  return { state: "unavailable", storeId, account: null };
}

function parseAreaStatus(value: unknown): AsaasAreaStatus | null {
  return typeof value === "string" && AREA_STATUSES.has(value) ? value as AsaasAreaStatus : null;
}

function parseAccount(value: unknown, expectedStoreId: string): AsaasMerchantAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.storeId !== expectedStoreId || raw.environment !== "sandbox") return null;
  if (typeof raw.status !== "string" || !ACCOUNT_STATUSES.has(raw.status)) return null;
  const commercialStatus = parseAreaStatus(raw.commercialStatus);
  const bankAccountStatus = parseAreaStatus(raw.bankAccountStatus);
  const documentStatus = parseAreaStatus(raw.documentStatus);
  const generalApprovalStatus = parseAreaStatus(raw.generalApprovalStatus);
  if (!commercialStatus || !bankAccountStatus || !documentStatus || !generalApprovalStatus) return null;
  if (typeof raw.lastSyncAt !== "string" || !Number.isFinite(Date.parse(raw.lastSyncAt))) return null;
  return {
    storeId: expectedStoreId,
    environment: "sandbox",
    status: raw.status as AsaasPersistedAccountStatus,
    commercialStatus,
    bankAccountStatus,
    documentStatus,
    generalApprovalStatus,
    lastSyncAt: new Date(raw.lastSyncAt).toISOString(),
  };
}

/** Fail-closed client validation; the backend remains the authorization authority. */
export function parseAsaasMerchantStatus(
  value: unknown,
  expectedStoreId = ASAAS_HOMOLOGATION_STORE_ID,
): AsaasMerchantStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return unavailableAsaasMerchantStatus(expectedStoreId);
  }
  const raw = value as Record<string, unknown>;
  if (raw.ok !== true || raw.environment !== "sandbox" || raw.storeId !== expectedStoreId) {
    return unavailableAsaasMerchantStatus(expectedStoreId);
  }
  if (typeof raw.state !== "string" || !MERCHANT_STATES.has(raw.state)) {
    return unavailableAsaasMerchantStatus(expectedStoreId);
  }
  const state = raw.state as AsaasMerchantStatusState;
  if (state === "no_account") return { state, storeId: expectedStoreId, account: null };
  const account = parseAccount(raw.account, expectedStoreId);
  if (!account) return unavailableAsaasMerchantStatus(expectedStoreId);
  if (["active", "awaiting_documents", "under_review", "rejected"].includes(state) && state !== account.status) {
    return unavailableAsaasMerchantStatus(expectedStoreId);
  }
  if (state === "active") {
    const areas = [
      account.commercialStatus,
      account.bankAccountStatus,
      account.documentStatus,
      account.generalApprovalStatus,
    ];
    if (areas.some((status) => status !== "APPROVED")) {
      return unavailableAsaasMerchantStatus(expectedStoreId);
    }
  }
  return { state, storeId: expectedStoreId, account };
}

export function asaasDocumentGuidance(hasOfficialOnboardingUrl: boolean): string {
  return hasOfficialOnboardingUrl
    ? "O Asaas disponibilizou um endereço documental oficial validado pelo backend. O direcionamento somente será habilitado em uma etapa futura autorizada."
    : "Quando houver um endereço documental oficial, o backend deverá validar o HTTPS e o domínio do Asaas antes de qualquer direcionamento futuro.";
}

export function asaasDocumentControls(hasOfficialOnboardingUrl: boolean) {
  return {
    channel: hasOfficialOnboardingUrl ? "validated_future_redirect" : "awaiting_official_url",
    redirectEnabled: false,
    uploadEnabled: false,
    faceRecognitionEnabled: false,
  } as const;
}

export function resolveAsaasStatusForIdentity(
  snapshot: { identity: string; result: AsaasMerchantStatus } | null,
  identity: string | null,
): AsaasMerchantStatus | null {
  return identity && snapshot?.identity === identity ? snapshot.result : null;
}
