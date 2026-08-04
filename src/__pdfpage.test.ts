import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
}));
import { jsPDF } from "jspdf";
import { printOrderA4 } from "@/components/orders/OrderPrintA4";

const saved: any[] = [];
(jsPDF as any).prototype.save = function (name: string) {
  saved.push({ name, pages: this.getNumberOfPages(), doc: this });
  return this;
};

const mkItems = (n: number, longName = false) =>
  Array.from({ length: n }, (_, i) => ({
    product_name: longName ? `Produto muito extenso com descricao gigante numero ${i + 1} `.repeat(3) : `Produto ${i + 1}`,
    quantity: (i % 3) + 1,
    product_price: 10 + i,
    subtotal: ((i % 3) + 1) * (10 + i),
    variations: i % 2 ? { AROMA: "Capim Santo", Tamanho: "G" } : null,
  }));

const base = {
  id: "11111111-1111-1111-1111-111111111111",
  order_number: "#0001",
  created_at: new Date().toISOString(),
  customer_name: "Cliente Teste",
  customer_email: "a@b.com",
  total_amount: 1000,
  store_owner_id: "e599e99d-9156-4b8e-a5af-00b19ceec4c1",
};

const pageText = (doc: any, page: number) => {
  // extract text via internal pages stream
  const s = doc.internal.pages[page].join("\n");
  return s;
};

const run = async (items: any[], extra: any = {}) => {
  saved.length = 0;
  await printOrderA4({ order: { ...base, order_items: items, ...extra }, store: { store_name: "Aroma" } });
  const doc = saved[0].doc;
  const pages = saved[0].pages;
  const texts = Array.from({ length: pages }, (_, i) => pageText(doc, i + 1));
  return { pages, texts };
};

const countItemLabels = (texts: string[], n: number) => {
  const all = texts.join("\n");
  let found = 0;
  for (let i = 1; i <= n; i++) {
    const label = String(i).padStart(2, "0");
    if (new RegExp(`\\(${label}\\)`).test(all)) found++;
  }
  return found;
};

describe("OrderPrintA4 pagination", () => {
  it("5 items -> 1 page", async () => {
    const r = await run(mkItems(5));
    expect(r.pages).toBe(1);
    expect(countItemLabels(r.texts, 5)).toBe(5);
  });

  it("40 items -> multi-page, all rendered, no blank page", async () => {
    const r = await run(mkItems(40));
    expect(r.pages).toBeGreaterThan(1);
    expect(countItemLabels(r.texts, 40)).toBe(40);
    // last page has content
    expect(r.texts[r.pages - 1].length).toBeGreaterThan(200);
    // header repeated on item pages
    expect(r.texts[1]).toContain("DESCRI");
  });

  it("120 items with long names+variations -> all rendered", async () => {
    const r = await run(mkItems(120, true), { notes: "Observacao muito longa. ".repeat(120), delivery_fee: 25 });
    expect(countItemLabels(r.texts, 120)).toBe(120);
    expect(r.texts[r.pages - 1]).toContain("Assinatura");
  });

  it("no items -> 1 page", async () => {
    const r = await run([]);
    expect(r.pages).toBe(1);
  });
});
