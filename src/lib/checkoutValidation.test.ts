import { describe, it, expect } from "vitest";
import { canDeferDelivery, getCheckoutPendingRequirements } from "./checkoutValidation";

const guestNoNumber = {
  customer_name: "Maria Silva",
  customer_phone: "92999999999",
  cep: "69000000",
  address: "Rua A",
  number: "",
  neighborhood: "Centro",
  city: "Manaus",
  state: "AM",
};

describe("entrega opcional só para visitante + WhatsApp", () => {
  it("visitante + WhatsApp sem entrega: número não bloqueia", () => {
    const defer = canDeferDelivery({ isAuthenticated: false, paymentMethod: "whatsapp" });
    expect(defer).toBe(true);
    expect(getCheckoutPendingRequirements({ ...guestNoNumber, delivery_method: "" }, { deliveryCanBeDeferred: defer })).toEqual([]);
  });

  it("visitante + WhatsApp escolhendo SEDEX: número volta a ser obrigatório", () => {
    const keys = getCheckoutPendingRequirements({ ...guestNoNumber, delivery_method: "sedex" }, { deliveryCanBeDeferred: true }).map((p) => p.key);
    expect(keys).toEqual(["number"]);
  });

  it("visitante + WhatsApp ainda exige nome e telefone", () => {
    const keys = getCheckoutPendingRequirements({ delivery_method: "" }, { deliveryCanBeDeferred: true }).map((p) => p.key);
    expect(keys).toEqual(["customer_name", "customer_phone"]);
  });

  it("visitante + Pix ou cartão: exceção não se aplica", () => {
    expect(canDeferDelivery({ isAuthenticated: false, paymentMethod: "pix" })).toBe(false);
    expect(canDeferDelivery({ isAuthenticated: false, paymentMethod: "cartao_credito" })).toBe(false);
  });

  it("cliente logado + WhatsApp: exceção não se aplica", () => {
    expect(canDeferDelivery({ isAuthenticated: true, paymentMethod: "whatsapp" })).toBe(false);
  });
});
