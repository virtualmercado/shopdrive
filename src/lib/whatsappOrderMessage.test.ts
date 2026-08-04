import { describe, it, expect } from "vitest";
import {
  calculateOrderItemSummary,
  buildItemizedWhatsAppMessage,
} from "./whatsappOrderMessage";

const item = (name: string, quantity: any, price = 10, subtotal = 10) =>
  ({ product_name: name, quantity, product_price: price, subtotal }) as any;

describe("calculateOrderItemSummary", () => {
  it("array vazio", () => {
    expect(calculateOrderItemSummary([])).toEqual({ numberOfItems: 0, totalUnits: 0 });
    expect(calculateOrderItemSummary(null)).toEqual({ numberOfItems: 0, totalUnits: 0 });
  });

  it("um item, uma unidade", () => {
    expect(calculateOrderItemSummary([item("A", 1)])).toEqual({ numberOfItems: 1, totalUnits: 1 });
  });

  it("um item, várias unidades", () => {
    expect(calculateOrderItemSummary([item("A", 8)])).toEqual({ numberOfItems: 1, totalUnits: 8 });
  });

  it("vários itens", () => {
    const items = [item("A", 3), item("B", 8), item("C", 1)];
    expect(calculateOrderItemSummary(items)).toEqual({ numberOfItems: 3, totalUnits: 12 });
  });

  it("quantidade como string numérica", () => {
    expect(calculateOrderItemSummary([item("A", "3"), item("B", "2")])).toEqual({
      numberOfItems: 2,
      totalUnits: 5,
    });
  });

  it("valores inválidos não geram NaN", () => {
    const items = [item("A", null), item("B", "abc"), item("C", -5), item("D", 2)];
    const r = calculateOrderItemSummary(items);
    expect(r.numberOfItems).toBe(4);
    expect(r.totalUnits).toBe(2);
    expect(Number.isNaN(r.totalUnits)).toBe(false);
  });

  it("ignora itens null e preserva o array original", () => {
    const items = [item("A", 2), null, undefined];
    const copy = [...items];
    expect(calculateOrderItemSummary(items as any)).toEqual({ numberOfItems: 1, totalUnits: 2 });
    expect(items).toEqual(copy);
  });

  it("variações contam como linhas distintas", () => {
    const items = [
      { ...item("A", 3), variations: { Aroma: "Canela" } },
      { ...item("A", 2), variations: { Aroma: "Lavanda" } },
    ];
    expect(calculateOrderItemSummary(items as any)).toEqual({ numberOfItems: 2, totalUnits: 5 });
  });

  it("quantidades decimais", () => {
    expect(calculateOrderItemSummary([item("A", 1.5), item("B", 0.5)])).toEqual({
      numberOfItems: 2,
      totalUnits: 2,
    });
  });
});

describe("buildItemizedWhatsAppMessage", () => {
  it("inclui resumo antes do subtotal e preserva demais dados", () => {
    const items = Array.from({ length: 22 }, (_, i) =>
      item(`Produto ${i + 1}`, i === 0 ? 91 - 21 : 1, 10, 60.89)
    );
    const msg = buildItemizedWhatsAppMessage(
      {
        order_number: "#0001",
        customer_name: "Cliente Teste",
        subtotal: 1339.6,
        total_amount: 1339.6,
        delivery_method: "retirada",
        payment_method: "whatsapp",
      },
      items,
      "Aroma"
    );
    expect(msg).toContain("Nº de itens: 22");
    expect(msg).toContain("Total de unidades: 91");
    expect(msg).toContain("Subtotal: R$ 1339,60");
    expect(msg).toContain("*Total: R$ 1339,60*");
    expect(msg).toContain("Entrega: Retirada na loja");
    expect(msg).toContain("Pagamento: Combinar via WhatsApp");
    expect(msg).toContain("Olá! Gostaria de confirmar este pedido");
    expect(msg.indexOf("Nº de itens")).toBeLessThan(msg.indexOf("\nSubtotal: R$"));
    expect(msg.indexOf("Produto 22")).toBeLessThan(msg.indexOf("Nº de itens"));
  });

  it("pedido sem itens não quebra", () => {
    const msg = buildItemizedWhatsAppMessage({ total_amount: 0 }, []);
    expect(msg).toContain("Nº de itens: 0");
    expect(msg).toContain("Total de unidades: 0");
  });
});
