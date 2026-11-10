/**
 * Merchant-side rules for a customer's primary address (Clientes → detalhe).
 * The server function `merchant_save_customer_primary_address` repeats every check;
 * this module only drives the form and picks the same row the server edits.
 */
export const BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export interface CustomerAddressForm {
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface CustomerAddressRow {
  id: string;
  customer_id?: string;
  store_owner_id: string | null;
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean | null;
  updated_at?: string | null;
}

export type AddressField = keyof CustomerAddressForm;

export const EMPTY_ADDRESS_FORM: CustomerAddressForm = {
  recipient_name: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
};

export const cepDigits = (value: string) => (value || "").replace(/\D/g, "").slice(0, 8);

/** Mask used by the form and the card: 00000-000. */
export function formatCep(value: string): string {
  const digits = cepDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export const isBrazilianUf = (value: string) =>
  (BRAZILIAN_UFS as readonly string[]).includes((value || "").trim().toUpperCase());

/** Returns a message per invalid field; empty object means the form can be saved. */
export function validateAddressForm(form: CustomerAddressForm): Partial<Record<AddressField, string>> {
  const errors: Partial<Record<AddressField, string>> = {};
  const required: [AddressField, string][] = [
    ["cep", "Informe o CEP."], ["street", "Informe a rua."], ["number", "Informe o número."],
    ["neighborhood", "Informe o bairro."], ["city", "Informe a cidade."], ["state", "Informe o estado."],
  ];
  for (const [field, message] of required) if (!form[field].trim()) errors[field] = message;
  if (!errors.cep && cepDigits(form.cep).length !== 8) errors.cep = "CEP deve ter 8 dígitos (00000-000).";
  if (!errors.state && !isBrazilianUf(form.state)) errors.state = "Use a sigla de um estado brasileiro (ex.: AM).";
  return errors;
}

/**
 * The address the merchant sees and edits: this store's own address (primary first, newest
 * first); otherwise the customer's own primary address with no store. Another store's
 * address is never shown or edited.
 */
export function pickPrimaryAddress<T extends CustomerAddressRow>(rows: T[], storeId: string | null): T | null {
  if (!storeId) return null;
  const time = (r: T) => (r.updated_at ? Date.parse(r.updated_at) || 0 : 0);
  const own = rows
    .filter((r) => r.store_owner_id === storeId)
    .sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default) || time(b) - time(a) || a.id.localeCompare(b.id));
  if (own.length) return own[0];
  const personal = rows.filter((r) => r.store_owner_id == null && r.is_default).sort((a, b) => time(b) - time(a));
  return personal[0] ?? null;
}

export function addressToForm(row: CustomerAddressRow | null): CustomerAddressForm {
  if (!row) return { ...EMPTY_ADDRESS_FORM };
  return {
    recipient_name: row.recipient_name ?? "", cep: formatCep(row.cep ?? ""), street: row.street ?? "",
    number: row.number ?? "", complement: row.complement ?? "", neighborhood: row.neighborhood ?? "",
    city: row.city ?? "", state: (row.state ?? "").toUpperCase(),
  };
}

/** Friendly message for a server rejection; never echoes raw backend text. */
export function addressSaveErrorMessage(error: unknown): string {
  const text = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (text.includes("invalid_cep")) return "CEP inválido. Use o formato 00000-000.";
  if (text.includes("invalid_state")) return "Estado inválido. Use a sigla de um estado brasileiro.";
  if (text.includes("missing_required_field")) return "Preencha todos os campos obrigatórios.";
  if (text.includes("field_too_long")) return "Algum campo está longo demais. Revise e tente novamente.";
  if (text.includes("customer_not_found") || text.includes("store_access_denied")) return "Este cliente não pertence à loja atual.";
  return "Não foi possível salvar o endereço. Seus dados foram mantidos; tente novamente.";
}

/** Arguments for `merchant_save_customer_primary_address`; shared by the detail page and manual signup. */
export function primaryAddressRpcArgs(customerId: string, form: CustomerAddressForm) {
  return {
    p_customer_id: customerId,
    p_recipient_name: form.recipient_name,
    p_cep: form.cep,
    p_street: form.street,
    p_number: form.number,
    p_complement: form.complement,
    p_neighborhood: form.neighborhood,
    p_city: form.city,
    p_state: form.state,
  };
}
