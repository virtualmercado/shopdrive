import { describe, expect, it } from "vitest";
import { labelRecipientFromOrder, parseOrderAddressSnapshot } from "./orderAddressSnapshot";

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
