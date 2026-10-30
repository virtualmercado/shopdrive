import { describe, it, expect } from "vitest";
import {
  extractBearerToken,
  isValidJobTokenFormat,
  mediaDeleteDecision,
  canAccessPixPayment,
  buildCheckoutItemsFromOrder,
  resolveOrderChargeAmount,
} from "../../supabase/functions/_shared/authorization";

const STORE_A = "11111111-1111-1111-1111-111111111111";
const STORE_B = "22222222-2222-2222-2222-222222222222";
const CUSTOMER = "33333333-3333-3333-3333-333333333333";

describe("extractBearerToken", () => {
  it("extrai token de header Bearer válido", () => {
    const req = new Request("https://x", { headers: { authorization: "Bearer abc123" } });
    expect(extractBearerToken(req)).toBe("abc123");
  });
  it("retorna null sem header ou sem prefixo Bearer", () => {
    expect(extractBearerToken(new Request("https://x"))).toBeNull();
    expect(extractBearerToken(new Request("https://x", { headers: { authorization: "Basic zzz" } }))).toBeNull();
  });
});

describe("isValidJobTokenFormat", () => {
  it("aceita hex de 64 caracteres", () => {
    expect(isValidJobTokenFormat("a".repeat(64))).toBe(true);
  });
  it("rejeita formatos inválidos", () => {
    expect(isValidJobTokenFormat("")).toBe(false);
    expect(isValidJobTokenFormat("short")).toBe(false);
    expect(isValidJobTokenFormat("g".repeat(64))).toBe(false);
    expect(isValidJobTokenFormat("a".repeat(63))).toBe(false);
  });
});

describe("mediaDeleteDecision (fail-closed)", () => {
  const key = `products/prod-1/2026/10/foto.jpg`;

  it("dono do produto pode deletar sua imagem", () => {
    expect(mediaDeleteDecision(key, { userId: STORE_A, isAdmin: false }, STORE_A)).toBe("allow");
  });
  it("Master/admin pode deletar imagem de produto", () => {
    expect(mediaDeleteDecision(key, { userId: STORE_B, isAdmin: true }, STORE_A)).toBe("allow");
  });
  it("lojista A NÃO pode deletar arquivo da loja B", () => {
    expect(mediaDeleteDecision(key, { userId: STORE_B, isAdmin: false }, STORE_A)).toBe("deny");
  });
  it("prefixo não reconhecido é rejeitado mesmo para autenticado", () => {
    expect(mediaDeleteDecision("uploads/master.png", { userId: STORE_A, isAdmin: false }, null)).toBe("deny");
    expect(mediaDeleteDecision("campaigns/x.png", { userId: STORE_A, isAdmin: false }, null)).toBe("deny");
  });
  it("produto inexistente não pode ser deletado por não-admin", () => {
    expect(mediaDeleteDecision(key, { userId: STORE_A, isAdmin: false }, null)).toBe("deny");
  });
});

describe("canAccessPixPayment (cross-tenant)", () => {
  const payment = { store_owner_id: STORE_A };
  const order = { customer_id: CUSTOMER };

  it("dono da loja acessa", () => {
    expect(canAccessPixPayment({ userId: STORE_A, isAdmin: false }, payment, order)).toBe(true);
  });
  it("Master/admin acessa", () => {
    expect(canAccessPixPayment({ userId: STORE_B, isAdmin: true }, payment, order)).toBe(true);
  });
  it("cliente do pedido acessa", () => {
    expect(canAccessPixPayment({ userId: CUSTOMER, isAdmin: false }, payment, order)).toBe(true);
  });
  it("guest (sem user id) acessa — polling do checkout, escritas derivadas do gateway", () => {
    expect(canAccessPixPayment({ userId: null, isAdmin: false }, payment, order)).toBe(true);
  });
  it("usuário autenticado de OUTRA loja NÃO acessa", () => {
    expect(canAccessPixPayment({ userId: STORE_B, isAdmin: false }, payment, order)).toBe(false);
  });
  it("autenticado sem vínculo NÃO acessa pedido sem customer_id", () => {
    expect(canAccessPixPayment({ userId: STORE_B, isAdmin: false }, payment, null)).toBe(false);
  });
});

describe("buildCheckoutItemsFromOrder (InfinitePay)", () => {
  it("monta itens somente a partir dos dados persistidos, em centavos", () => {
    const items = buildCheckoutItemsFromOrder([
      { product_name: "Óleo de Copaíba", quantity: 2, product_price: 49.9 },
      { product_name: "Sabonete", quantity: 1, product_price: 12.5 },
    ]);
    expect(items).toEqual([
      { name: "Óleo de Copaíba", quantity: 2, price: 4990 },
      { name: "Sabonete", quantity: 1, price: 1250 },
    ]);
  });
  it("ignora campos extras e força quantidade mínima 1", () => {
    const items = buildCheckoutItemsFromOrder([
      { product_name: "X", quantity: 0, product_price: 10 },
    ]);
    expect(items[0].quantity).toBe(1);
    expect(Object.keys(items[0]).sort()).toEqual(["name", "price", "quantity"]);
  });
});

describe("resolveOrderChargeAmount (valor sempre do pedido)", () => {
  it("usa o total persistido do pedido", () => {
    expect(resolveOrderChargeAmount(199.97)).toBe(199.97);
    expect(resolveOrderChargeAmount(3.46)).toBe(3.46);
  });
  it("rejeita totais inválidos", () => {
    expect(() => resolveOrderChargeAmount(0)).toThrow();
    expect(() => resolveOrderChargeAmount(-5)).toThrow();
    expect(() => resolveOrderChargeAmount(NaN)).toThrow();
  });
});
