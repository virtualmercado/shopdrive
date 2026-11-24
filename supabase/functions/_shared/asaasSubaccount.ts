// Phase 3 validation and sanitization. No network or persistence in this module.

export const ASAAS_ACCOUNT_STATUS_EVENTS = Object.freeze([
  ...["BANK_ACCOUNT_INFO", "COMMERCIAL_INFO", "DOCUMENT", "GENERAL_APPROVAL"].flatMap((area) =>
    ["APPROVED", "AWAITING_APPROVAL", "PENDING", "REJECTED"].map((state) => `ACCOUNT_STATUS_${area}_${state}`)
  ),
]);

const COMPANY_TYPES = new Set(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]);
const TAX_REGIMES = new Set(["MEI", "NATIONAL_SIMPLE", "NORMAL_REGIME", "UNKNOWN"]);
const ACCOUNT_STATES = new Set(["PENDING", "AWAITING_APPROVAL", "APPROVED", "REJECTED"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AsaasSubaccountData {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  birthDate?: string;
  companyType?: string;
  taxRegime?: string;
}

export interface AsaasAccountStatuses {
  commercialInfo: string;
  bankAccountInfo: string;
  documentation: string;
  general: string;
}

export type ValidationResult =
  | { ok: true; data: AsaasSubaccountData }
  | { ok: false; field: string; error: string };

function digits(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\D/g, "") : "";
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return result && result.length <= max ? result : null;
}

function repeated(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function validCpf(value: string): boolean {
  if (value.length !== 11 || repeated(value)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index);
    const digit = (sum * 10) % 11 % 10;
    return digit === Number(value[length]);
  };
  return check(9) && check(10);
}

function validCnpj(value: string): boolean {
  if (value.length !== 14 || repeated(value)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
    const remainder = sum % 11;
    return Number(value[length]) === (remainder < 2 ? 0 : 11 - remainder);
  };
  return check(12) && check(13);
}

function validBirthDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() < Date.now();
}

export function normalizeAndValidateSubaccount(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, field: "data", error: "invalid_object" };
  const value = input as Record<string, unknown>;
  const name = cleanText(value.name, 160);
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const cpfCnpj = digits(value.cpfCnpj);
  let mobilePhone = digits(value.mobilePhone);
  if ((mobilePhone.length === 12 || mobilePhone.length === 13) && mobilePhone.startsWith("55")) mobilePhone = mobilePhone.slice(2);
  const postalCode = digits(value.postalCode);
  const address = cleanText(value.address, 200);
  const addressNumber = cleanText(value.addressNumber, 30);
  const province = cleanText(value.province, 120);
  const incomeValue = typeof value.incomeValue === "number" ? value.incomeValue : Number.NaN;

  if (!name) return { ok: false, field: "name", error: "required_or_too_long" };
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, field: "email", error: "invalid_email" };
  if (!validCpf(cpfCnpj) && !validCnpj(cpfCnpj)) return { ok: false, field: "cpfCnpj", error: "invalid_document" };
  if (!/^\d{10,11}$/.test(mobilePhone) || repeated(mobilePhone)) return { ok: false, field: "mobilePhone", error: "invalid_phone" };
  if (!Number.isFinite(incomeValue) || incomeValue <= 0 || incomeValue > 1_000_000_000) return { ok: false, field: "incomeValue", error: "invalid_income" };
  if (!address) return { ok: false, field: "address", error: "required_or_too_long" };
  if (!addressNumber) return { ok: false, field: "addressNumber", error: "required_or_too_long" };
  if (!province) return { ok: false, field: "province", error: "required_or_too_long" };
  if (!/^\d{8}$/.test(postalCode) || repeated(postalCode)) return { ok: false, field: "postalCode", error: "invalid_postal_code" };

  const data: AsaasSubaccountData = {
    name, email, cpfCnpj, mobilePhone, incomeValue: Math.round(incomeValue * 100) / 100,
    address, addressNumber, province, postalCode,
  };
  if (cpfCnpj.length === 11) {
    if (!validBirthDate(value.birthDate)) return { ok: false, field: "birthDate", error: "required_for_individual" };
    if (value.companyType !== undefined || value.taxRegime !== undefined) return { ok: false, field: "companyType", error: "business_only" };
    data.birthDate = value.birthDate;
  } else {
    if (typeof value.companyType !== "string" || !COMPANY_TYPES.has(value.companyType)) return { ok: false, field: "companyType", error: "required_for_business" };
    if (value.birthDate !== undefined) return { ok: false, field: "birthDate", error: "individual_only" };
    if (value.taxRegime !== undefined && (typeof value.taxRegime !== "string" || !TAX_REGIMES.has(value.taxRegime))) {
      return { ok: false, field: "taxRegime", error: "invalid_tax_regime" };
    }
    data.companyType = value.companyType;
    if (typeof value.taxRegime === "string") data.taxRegime = value.taxRegime;
  }
  return { ok: true, data };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function normalizeInstitutionalEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function deriveAsaasAccountStatus(status: AsaasAccountStatuses): "awaiting_documents" | "under_review" | "active" | "rejected" {
  if (status.general === "APPROVED") return "active";
  if (status.general === "REJECTED") return "rejected";
  if (status.documentation === "PENDING" || status.documentation === "REJECTED") return "awaiting_documents";
  return "under_review";
}

export function parseAsaasAccountStatuses(value: unknown): AsaasAccountStatuses | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const status = {
    commercialInfo: raw.commercialInfo,
    bankAccountInfo: raw.bankAccountInfo,
    documentation: raw.documentation,
    general: raw.general,
  };
  return Object.values(status).every((item) => typeof item === "string" && ACCOUNT_STATES.has(item))
    ? status as AsaasAccountStatuses
    : null;
}

export function sanitizeAsaasAccount(account: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "storeId", "environment", "status", "accountId", "commercialStatus", "bankAccountStatus",
    "documentStatus", "generalApprovalStatus", "lastSyncAt", "lastErrorCode",
  ];
  return Object.fromEntries(allowed.filter((key) => account[key] !== undefined).map((key) => [key, account[key]]));
}

export function optionalIdentifier(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 255 ? value.trim() : null;
}

export function accountNumberFromResponse(value: unknown): string | null {
  const direct = optionalIdentifier(value);
  if (direct) return direct;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return optionalIdentifier((value as Record<string, unknown>).accountNumber);
  }
  return null;
}
