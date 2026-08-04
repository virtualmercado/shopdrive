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
const capture = function (this: any, name: string) {
  saved.push({ name, pages: this.getNumberOfPages(), doc: this });
  return this;
};
(jsPDF as any).prototype.save = capture;
(jsPDF as any).API.save = capture;

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

import fs from "fs";
describe("visual", () => {
  it("writes pdfs", async () => {
    for (const n of [5, 25, 40]) {
      const r = await run(mkItems(n, n === 40));
      const buf = Buffer.from((saved[0].doc as any).output("arraybuffer"));
      fs.writeFileSync(`/tmp/browser/order_${n}.pdf`, buf);
      console.log("items", n, "pages", r.pages);
    }
  });
});
