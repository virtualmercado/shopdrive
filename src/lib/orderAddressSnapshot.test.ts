import { describe, expect, it } from "vitest";
import {
  labelRecipientFromOrder, parseOrderAddressSnapshot, planShippingLabel, isDeliverableRecipient,
  confirmationWarning, LABEL_LEGACY_WARNING, LABEL_TO_BE_AGREED_WARNING,
} from "./orderAddressSnapshot";

describe("shipping label uses the address stored on the order", () => {
  it("reads every field from a checkout snapshot", () => {
    expect(parseOrderAddressSnapshot("Rua das Flores, 123 - Apto 4, Centro, Manaus - AM, CEP: 69005-010")).toEqual({
      street: "Rua das Flores", number: "123", complement: "Apto 4", neighborhood: "Centro",
      city: "Manaus", state: "AM", cep: "69005-010",
    });
  });

  it("reads every field from a manual-order snapshot", () => {
    expect(parseOrderAddressSnapshot("Av. Brasil, 50, Bloco B, Jardim, Rio Branco/AC, CEP: 69900000")).toEqual({
      street: "Av. Brasil", number: "50", complement: "Bloco B", neighborhood: "Jardim",
      city: "Rio Branco", state: "AC", cep: "69900-000",
    });
  });

  it("keeps the historical address A even after the registration changes to B", () => {
    const order = {
      customer_name: "Cliente Teste",
      customer_address: "Rua A, 1, Bairro A, Manaus - AM, CEP: 69000-001",
      delivery_method: "entrega",
    };
    // The function receives only the order: the current registration (address B) is not an input.
    const label = labelRecipientFromOrder(order);
    expect(label?.street).toBe("Rua A");
    expect(label?.cep).toBe("69000-001");
    expect(label?.full_name).toBe("Cliente Teste");
  });

  it("falls back (null) for pickup, 'a combinar' and incomplete legacy copies", () => {
    expect(labelRecipientFromOrder({ customer_address: "Loja, 10, Centro, Manaus - AM, CEP: 69000-000", delivery_method: "retirada" })).toBeNull();
    expect(labelRecipientFromOrder({ customer_address: "A combinar pelo WhatsApp", delivery_method: null })).toBeNull();
    expect(labelRecipientFromOrder({ customer_address: "Rua sem cidade nem CEP", delivery_method: "entrega" })).toBeNull();
    expect(labelRecipientFromOrder({ customer_address: null, delivery_method: "entrega" })).toBeNull();
  });
});

describe("legacy label plan never presents the current registration as historical", () => {
  it("prints directly from a complete snapshot", () => {
    const plan = planShippingLabel({ customer_name: "C", customer_address: "Rua A, 1, Bairro, Manaus - AM, CEP: 69000-001", delivery_method: "entrega" });
    expect(plan.kind).toBe("snapshot");
  });

  it("requires confirmation for an old delivery order without CEP in the copy", () => {
    expect(planShippingLabel({ customer_address: "Rua A, 1, Bairro, Manaus - AM", delivery_method: "entrega" }))
      .toEqual({ kind: "needs_confirmation", reason: "incomplete" });
    expect(confirmationWarning("incomplete")).toBe(LABEL_LEGACY_WARNING);
  });

  it("requires confirmation for 'A combinar pelo WhatsApp' with its own warning", () => {
    expect(planShippingLabel({ customer_address: "A combinar pelo WhatsApp", delivery_method: null }))
      .toEqual({ kind: "needs_confirmation", reason: "to_be_agreed" });
    expect(confirmationWarning("to_be_agreed")).toBe(LABEL_TO_BE_AGREED_WARNING);
  });

  it("never plans a delivery label for pickup, even with a complete-looking copy", () => {
    expect(planShippingLabel({ customer_address: "Loja, 10, Centro, Manaus - AM, CEP: 69000-000", delivery_method: "retirada" }))
      .toEqual({ kind: "pickup" });
  });

  it("blocks when no deliverable fallback address exists", () => {
    expect(isDeliverableRecipient(null)).toBe(false);
    expect(isDeliverableRecipient({ full_name: "C", street: "Rua", city: "Manaus", state: "AM", cep: "" })).toBe(false);
    expect(isDeliverableRecipient({ full_name: "C", street: "", city: "Manaus", state: "AM", cep: "69000-001" })).toBe(false);
    expect(isDeliverableRecipient({ full_name: "C", street: "Rua", city: "Manaus", state: "AM", cep: "69000-001" })).toBe(true);
  });
});
