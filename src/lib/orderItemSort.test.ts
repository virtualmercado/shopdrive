import { describe, expect, it } from "vitest";
import { presentOrderItems, sortOrderItems, isPositionedOrder } from "./orderItemSort";

const item = (id: string, pos: number | null, name: string, extra: Record<string, unknown> = {}) => ({
  id, item_position: pos, product_name: name, product_id: `prod-${name}`, quantity: 1, product_price: 10, subtotal: 10, ...extra,
});

// Inserted on purpose in mixed order: three soaps of the same base, added at different moments.
const SABONETE = "prod-sabonete";
const mixed = [
  item("a", 1, "Sabonete", { product_id: SABONETE, variations: { Aroma: "Açaí" }, variant_sku: "SAB-ACAI" }),
  item("b", 2, "Óleo de Copaíba", { variant_sku: null }),
  item("c", 3, "Sabonete", { product_id: SABONETE, variations: { Aroma: "Buriti" }, variant_sku: "SAB-BURITI" }),
  item("d", 4, "Chá", { variant_sku: "CHA-01" }),
  item("e", 5, "Sabonete", { product_id: SABONETE, variations: { Aroma: "Breu" }, variant_sku: "SAB-BREU" }),
];
const shuffled = [mixed[3], mixed[0], mixed[4], mixed[1], mixed[2]]; // as a SELECT might return them
const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe("order item presentation order", () => {
  it("legacy orders keep exactly the order they were fetched in", () => {
    expect(isPositionedOrder({ order_format_version: null })).toBe(false);
    expect(ids(presentOrderItems({ order_format_version: null }, shuffled, "product"))).toEqual(["d", "a", "e", "b", "c"]);
    expect(ids(presentOrderItems({}, shuffled, "code"))).toEqual(["d", "a", "e", "b", "c"]);
  });

  it("Inserção follows item_position regardless of fetch order", () => {
    expect(ids(presentOrderItems({ order_format_version: 2 }, shuffled, "insertion"))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("Produto keeps the three soap variations consecutive, as three separate lines", () => {
    const out = sortOrderItems(shuffled, "product");
    expect(ids(out)).toEqual(["d", "b", "a", "e", "c"]); // Chá, Óleo, Sabonete Açaí/Breu/Buriti
    expect(out).toHaveLength(5);
    expect(out.filter((i) => i.product_id === SABONETE).map((i) => i.quantity)).toEqual([1, 1, 1]);
  });

  it("Código sorts by frozen code and puts items without code last", () => {
    expect(ids(sortOrderItems(shuffled, "code"))).toEqual(["d", "a", "e", "c", "b"]);
  });

  it("identical lines are never merged and tie-break by position", () => {
    const dup = [item("x2", 7, "Chá", { product_id: "p" }), item("x1", 2, "Chá", { product_id: "p" })];
    expect(ids(sortOrderItems(dup, "product"))).toEqual(["x1", "x2"]);
    expect(ids(sortOrderItems(dup, "code"))).toEqual(["x1", "x2"]);
  });

  it("never changes quantities, prices or totals", () => {
    const total = (l: { subtotal: number; quantity: number }[]) => l.reduce((s, i) => s + i.subtotal * 1000 + i.quantity, 0);
    for (const mode of ["insertion", "product", "code"] as const) {
      const out = sortOrderItems(shuffled, mode);
      expect(total(out)).toBe(total(shuffled));
      expect(new Set(out)).toEqual(new Set(shuffled));
    }
  });

  it("lines added during an edit (no position yet) come after positioned ones", () => {
    const edit = [item("new", null, "Abacate"), item("old", 6, "Zebra")];
    expect(ids(sortOrderItems(edit, "insertion"))).toEqual(["old", "new"]);
  });

  it("multipage lists are ordered once as a whole (positions 1..25 stay sequential)", () => {
    const many = Array.from({ length: 25 }, (_, i) => item(`i${i + 1}`, i + 1, `Produto ${25 - i}`)).reverse();
    expect(ids(sortOrderItems(many, "insertion"))).toEqual(Array.from({ length: 25 }, (_, i) => `i${i + 1}`));
    expect(sortOrderItems(many, "product").map((i) => i.product_name)[0]).toBe("Produto 1"); // numeric-aware
  });
});
