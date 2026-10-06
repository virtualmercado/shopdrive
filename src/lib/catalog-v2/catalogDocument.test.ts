import { describe, it, expect, vi } from "vitest";
import {
  buildCatalogDocument,
  CatalogSelectionError,
  validateCatalogDocument,
  loadCatalogSource,
  UNBRANDED_KEY,
  UNCATEGORIZED_KEY,
  type CatalogSource,
  type RawProductRow,
} from "./index";

const STORE = "store-a";
const OTHER = "store-b";

const product = (id: string, over: Partial<RawProductRow> = {}): RawProductRow => ({
  id, user_id: STORE, name: `Produto ${id}`, description: null, price: 10, promotional_price: null,
  image_url: null, images: null, category_id: null, brand_id: null, inventory_mode: "simple",
  is_active: true, is_featured: false, is_new: false, weight: null, shipping_weight: null,
  height: null, width: null, length: null, created_at: "2026-01-01T00:00:00Z", ...over,
});

const source = (products: RawProductRow[], extra: Partial<CatalogSource> = {}): CatalogSource => ({
  storeId: STORE,
  profile: { id: STORE, store_name: "Aroma", store_slug: "aroma", store_logo_url: null, primary_color: "#111", secondary_color: null, button_bg_color: null, button_text_color: null, price_color: null, whatsapp_number: "5592999999999", email: null, instagram_url: null, facebook_url: null, youtube_url: null, x_url: null, about_us_title: null, about_us_text: null, address: null, address_number: null, address_neighborhood: null, address_city: "Manaus", address_state: "AM" },
  products,
  categories: [{ id: "cat-cha", user_id: STORE, name: "Chás", icon_url: null }, { id: "cat-oleo", user_id: STORE, name: "Óleos", icon_url: null }],
  brands: [{ id: "br-eko", user_id: STORE, name: "EKOPHITO", logo_url: null }, { id: "br-aroma", user_id: STORE, name: "AROMA", logo_url: null }, { id: "br-x", user_id: OTHER, name: "Outra", logo_url: null }],
  galleryByProduct: {},
  variantsByProduct: {},
  ...extra,
});

describe("CatalogDocument v2", () => {
  it("normaliza simples e variação", () => {
    const doc = buildCatalogDocument(source([product("s"), product("v", { inventory_mode: "variant" })], {
      variantsByProduct: { v: [{ id: "var1", sku: "V-1", active: true, options: [{ group: "Tamanho", value: "M" }] }] },
    }));
    expect(doc.products.find((p) => p.id === "s")!.variants).toEqual([]);
    expect(doc.products.find((p) => p.id === "v")!.variants[0].sku).toBe("V-1");
  });

  it("exclui inativos e produtos de outra loja", () => {
    const doc = buildCatalogDocument(source([product("a"), product("i", { is_active: false }), product("x", { user_id: OTHER })]));
    expect(doc.products.map((p) => p.id)).toEqual(["a"]);
  });

  it("aceita produto sem marca, categoria, imagem e descrição", () => {
    const p = buildCatalogDocument(source([product("a")])).products[0];
    expect(p.brandId).toBeNull();
    expect(p.categoryId).toBeNull();
    expect(p.primaryImage).toBeNull();
    expect(p.description.plainText).toBe("");
    expect(p.description.benefits).toBeNull();
  });

  it("limpa HTML da descrição e preserva o original", () => {
    const p = buildCatalogDocument(source([product("a", { description: "<p><b>Chá</b> natural</p><script>x</script>" })])).products[0];
    expect(p.description.plainText).toBe("Chá natural");
    expect(p.description.originalHtml).toContain("<b>");
    expect(p.description.summary).toEqual({ text: "Chá natural", derived: true });
  });

  it("agrupa por categoria com seção Sem categoria por último", () => {
    const doc = buildCatalogDocument(source([product("1", { category_id: "cat-oleo" }), product("2", { category_id: "cat-cha" }), product("3")]), { presentation: { grouping: "category" } });
    expect(doc.sections.map((s) => s.title)).toEqual(["Chás", "Óleos", "Sem categoria"]);
  });

  it("agrupa por marca usando IDs reais", () => {
    const doc = buildCatalogDocument(source([product("1", { brand_id: "br-eko" }), product("2", { brand_id: "br-aroma" }), product("3")]), { presentation: { grouping: "brand" } });
    expect(doc.sections.map((s) => [s.refId, s.productIds])).toEqual([["br-aroma", ["2"]], ["br-eko", ["1"]], [null, ["3"]]]);
  });

  it("combina filtros com ordenação estável", () => {
    const rows = [
      product("c", { name: "Chá B", brand_id: "br-eko", category_id: "cat-cha" }),
      product("a", { name: "Chá A", brand_id: "br-eko", category_id: "cat-cha" }),
      product("b", { name: "chá a", brand_id: "br-eko", category_id: "cat-cha" }),
      product("d", { name: "Óleo", brand_id: "br-eko", category_id: "cat-oleo" }),
      product("e", { name: "Chá C", brand_id: "br-aroma", category_id: "cat-cha" }),
    ];
    const doc = buildCatalogDocument(source(rows), { selection: { brandIds: ["br-eko"], categoryIds: ["cat-cha"] }, sort: "name_asc" });
    expect(doc.products.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("filtra explicitamente sem marca / sem categoria", () => {
    const doc = buildCatalogDocument(source([product("1", { brand_id: "br-eko" }), product("2")]), { selection: { brandIds: [UNBRANDED_KEY], categoryIds: [UNCATEGORIZED_KEY] } });
    expect(doc.products.map((p) => p.id)).toEqual(["2"]);
  });

  it("não duplica produtos", () => {
    const doc = buildCatalogDocument(source([product("a"), product("a")]));
    expect(doc.products).toHaveLength(1);
  });

  it("suporta mais de 200 produtos", () => {
    const rows = Array.from({ length: 250 }, (_, i) => product(`p${String(i).padStart(3, "0")}`));
    const doc = buildCatalogDocument(source(rows));
    expect(doc.products).toHaveLength(250);
    expect(validateCatalogDocument(doc)).toEqual([]);
  });

  it("preserva valores monetários e promoção válida", () => {
    const [p1, p2] = buildCatalogDocument(source([product("1", { price: 49.9, promotional_price: 39.9 }), product("2", { price: 20, promotional_price: 25 })]), { sort: "price_desc" }).products;
    expect(p1.price.effective.amount).toBe(39.9);
    expect(p1.price.regular.amount).toBe(49.9);
    expect(p1.price.discountPercent).toBe(20);
    expect(p2.price.promotional).toBeNull();
    expect(p2.price.effective.amount).toBe(20);
  });

  it("gera URLs públicas canônicas com rastreamento", () => {
    const doc = buildCatalogDocument(source([product("abc")]));
    expect(doc.products[0].publicUrl).toBe("https://shopdrive.com.br/aroma/produto/abc?src=catalogo_pdf");
    expect(doc.identity.publicUrl).toBe("https://shopdrive.com.br/aroma");
  });

  it("recusa produto ou marca de outra loja", () => {
    const s = source([product("a"), product("x", { user_id: OTHER })]);
    expect(() => buildCatalogDocument(s, { selection: { productIds: ["x"] } })).toThrow(CatalogSelectionError);
    expect(() => buildCatalogDocument(s, { selection: { brandIds: ["br-x"] } })).toThrow(CatalogSelectionError);
  });

  it("documento é válido e serializável", () => {
    const doc = buildCatalogDocument(source([product("a", { image_url: "https://cdn/x.jpg", images: ["https://cdn/x.jpg", "https://cdn/y.jpg"] })]), { now: new Date("2026-10-06T00:00:00Z") });
    expect(validateCatalogDocument(doc)).toEqual([]);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    expect(doc.products[0].additionalImages.map((i) => i.url)).toEqual(["https://cdn/y.jpg"]);
  });
});

describe("loadCatalogSource", () => {
  it("recusa carregar loja de outro usuário", async () => {
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: OTHER } } }) } } as any;
    await expect(loadCatalogSource(client, STORE)).rejects.toThrow("não autorizada");
  });
});
