import { describe, expect, it } from "vitest";
import {
  addressSaveErrorMessage, addressToForm, formatCep, pickPrimaryAddress, validateAddressForm,
  EMPTY_ADDRESS_FORM, type CustomerAddressRow,
} from "./customerAddress";

const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_C = "33333333-3333-4333-8333-333333333333";
const row = (over: Partial<CustomerAddressRow>): CustomerAddressRow => ({
  id: over.id ?? "r", store_owner_id: null, recipient_name: "Ana", cep: "69000000", street: "Rua", number: "1",
  complement: null, neighborhood: "Centro", city: "Manaus", state: "AM", is_default: true, updated_at: "2026-01-01T00:00:00Z", ...over,
});
const valid = { ...EMPTY_ADDRESS_FORM, cep: "69005-010", street: "Av. Teste", number: "100", neighborhood: "Centro", city: "Manaus", state: "AM" };

describe("customer primary address rules", () => {
  it("masks CEP as 00000-000", () => {
    expect(formatCep("69005010")).toBe("69005-010");
    expect(formatCep("69005-0109999")).toBe("69005-010");
  });

  it("requires CEP, street, number, neighborhood, city and state", () => {
    const errors = validateAddressForm(EMPTY_ADDRESS_FORM);
    expect(Object.keys(errors).sort()).toEqual(["cep", "city", "neighborhood", "number", "state", "street"]);
    expect(validateAddressForm(valid)).toEqual({});
  });

  it("rejects a CEP without 8 digits and a non-Brazilian UF", () => {
    expect(validateAddressForm({ ...valid, cep: "6900" }).cep).toBeDefined();
    expect(validateAddressForm({ ...valid, state: "XX" }).state).toBeDefined();
    expect(validateAddressForm({ ...valid, state: "am" })).toEqual({});
  });

  it("shows this store's address before the customer's own, and never another store's", () => {
    const own = row({ id: "own", store_owner_id: STORE_A, is_default: false });
    const personal = row({ id: "personal", store_owner_id: null, is_default: true });
    const other = row({ id: "other", store_owner_id: STORE_C, is_default: true });
    expect(pickPrimaryAddress([personal, other, own], STORE_A)?.id).toBe("own");
    expect(pickPrimaryAddress([personal, other], STORE_A)?.id).toBe("personal");
    expect(pickPrimaryAddress([other], STORE_A)).toBeNull();
  });

  it("prefers the store's default and then the newest row", () => {
    const older = row({ id: "older", store_owner_id: STORE_A, is_default: false, updated_at: "2026-01-01T00:00:00Z" });
    const newer = row({ id: "newer", store_owner_id: STORE_A, is_default: false, updated_at: "2026-02-01T00:00:00Z" });
    const def = row({ id: "default", store_owner_id: STORE_A, is_default: true, updated_at: "2025-01-01T00:00:00Z" });
    expect(pickPrimaryAddress([older, newer], STORE_A)?.id).toBe("newer");
    expect(pickPrimaryAddress([older, newer, def], STORE_A)?.id).toBe("default");
  });

  it("prefills the edit form with the masked CEP", () => {
    expect(addressToForm(row({ cep: "69000000", complement: null })).cep).toBe("69000-000");
    expect(addressToForm(null)).toEqual(EMPTY_ADDRESS_FORM);
  });

  it("maps server rejections to friendly messages", () => {
    expect(addressSaveErrorMessage({ message: "customer_not_found" })).toBe("Este cliente não pertence à loja atual.");
    expect(addressSaveErrorMessage({ message: "invalid_state" })).toContain("Estado inválido");
    expect(addressSaveErrorMessage(new Error("network"))).toContain("Seus dados foram mantidos");
  });
});
