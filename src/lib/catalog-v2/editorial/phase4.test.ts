import { describe, it, expect } from "vitest";
import { buildCatalogDocument } from "../catalogDocument";
import { composePages, type PagePlan } from "./composer";
import { generateEditorialPdf, type ImageResolver } from "./generateEditorialPdf";
import { EditorialConfigError, EDITORIAL_LIMITS, normalizeEditorialConfig, isOwnCoverUrl, type EditorialConfigInput } from "./editorialConfig";
import { fixtureStoreA, fixtureStoreB, FIXTURE_STORE_B } from "./editorialFixtures";
import type { DrawnRect } from "./canvas";
import { PAGE } from "./theme";

const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const resolver: ImageResolver = async (url) => (url.includes("p3.") || url.includes("missing") ? null : { data: PIXEL, width: 1000, height: 900, format: "JPEG", alias: url });
const NOW = new Date("2026-10-06T00:00:00Z");
const docA = (grouping: "none" | "category" | "brand" = "category") => buildCatalogDocument(fixtureStoreA(), { presentation: { grouping }, now: NOW });
const gen = (doc = docA(), editorial?: EditorialConfigInput) => generateEditorialPdf(doc, { resolveImage: resolver, editorial });
const kinds = (plan: PagePlan[]) => plan.map((p) => (p.kind === "products" ? `P${p.layout}${p.header ? "h" : ""}` : p.kind));
const productIds = (plan: PagePlan[]) => plan.flatMap((p) => (p.kind === "products" ? p.productIds : []));
const overlaps = (a: DrawnRect, b: DrawnRect) => a.page === b.page && a.x < b.x + b.w - 0.05 && b.x < a.x + a.w - 0.05 && a.y < b.y + b.h - 0.05 && b.y < a.y + a.h - 0.05;
const inside = (rects: DrawnRect[]) => rects.filter((r) => r.kind !== "image").forEach((r) => {
  expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x + r.w).toBeLessThanOrEqual(PAGE.w + 0.01); expect(r.y + r.h).toBeLessThanOrEqual(PAGE.h + 0.01);
});
const noOverlap = (rects: DrawnRect[], pages: number[]) => {
  const t = rects.filter((r) => pages.includes(r.page) && (r.kind === "text" || r.kind === "button") && r.label !== "badge" && r.label !== "noimg" && r.label !== "featured-badge");
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (overlaps(t[i], t[j])) throw new Error(`sobreposição p${t[i].page}: ${t[i].label} × ${t[j].label}`);
};
const pagesOf = (plan: PagePlan[], kind: PagePlan["kind"]) => plan.flatMap((p, i) => (p.kind === kind ? [i + 1] : []));

const ABOUT = "Somos uma pequena oficina de cosmética natural.\nCada lote é preparado à mão.";

describe("Fase 4 — retrocompatibilidade", () => {
  it("26. sem configuração o plano é idêntico ao da v1.1", () => {
    const base = composePages(docA());
    const empty = composePages(docA(), { editorial: normalizeEditorialConfig(docA(), {}).config });
    const strip = (p: PagePlan[]) => p.map((x) => (x.kind === "separator" ? { ...x, imageSource: undefined } : x));
    expect(strip(empty)).toEqual(strip(base));
    expect(kinds(base).join(" ")).toBe("cover separator P2 separator P3 P4 separator P1 back");
  });

  it("1. só capa, produtos e contracapa (sem agrupamento)", async () => {
    const r = await gen(docA("none"));
    expect(kinds(r.plan)[0]).toBe("cover");
    expect(r.plan.some((p) => p.kind === "separator" || p.kind === "institutional" || p.kind === "commercial" || p.kind === "featured")).toBe(false);
    expect(r.plan.at(-1)!.kind).toBe("back");
  });
});

describe("Fase 4 — páginas institucional e comercial", () => {
  it("2/5. institucional após a capa, sem imagem, com texto informado", async () => {
    const r = await gen(docA(), { institutional: { enabled: true, text: ABOUT } });
    expect(r.plan[1].kind).toBe("institutional");
    expect(r.rects.filter((x) => x.label === "inst-text")).toHaveLength(2);
    expect(r.rects.find((x) => x.label === "inst-title")).toBeTruthy();
    inside(r.rects); noOverlap(r.rects, [2]);
  });

  it("usa o 'Sobre nós' da loja só quando autorizado; sem texto não gera página", () => {
    const d = docA();
    expect(normalizeEditorialConfig(d, { institutional: { enabled: true, useStoreAbout: true } }).config.institutional?.paragraphs[0]).toMatch(/Cosmética natural/);
    const off = normalizeEditorialConfig(d, { institutional: { enabled: true } });
    expect(off.config.institutional).toBeNull();
    expect(off.issues).toContainEqual({ field: "institutional", code: "empty" });
  });

  it("3/6. comerciais só com campos preenchidos e sem inferir pagamento", async () => {
    const r = await gen(docA(), { commercial: { enabled: true, delivery: "Enviamos para todo o Brasil.", payment: "  ", notes: null } });
    const pg = pagesOf(r.plan, "commercial");
    expect(pg).toHaveLength(1);
    const labels = r.rects.filter((x) => x.page === pg[0]).map((x) => x.label);
    expect(labels).toContain("com-label-delivery");
    expect(labels).not.toContain("com-label-payment");
    expect(labels).not.toContain("com-label-notes");
    const raw = new TextDecoder("latin1").decode(r.bytes);
    expect(raw).not.toMatch(/PIX|parcel/i);
  });

  it("4/8. ambas as páginas, ordem correta e textos longos sem corte nem sobreposição", async () => {
    const long = Array.from({ length: 11 }, (_, i) => `Parágrafo ${i + 1}. ` + "Trabalhamos com ingredientes selecionados e processos cuidadosos em cada etapa da produção. ".repeat(3)).join("\n");
    const field = "x".repeat(10) + " palavra".repeat(Math.floor((EDITORIAL_LIMITS.commercialField - 10) / 8));
    const r = await gen(docA(), {
      cover: { title: "Catálogo Atacado Primavera Verão Dois Mil e Vinte e Seis Edição Revendedores", subtitle: "Linha completa de cuidados naturais para corpo, casa e presentes, com preços especiais" },
      institutional: { enabled: true, title: "Bem-vindo ao Empório Serra Verde, cosmética natural feita com calma", text: long },
      commercial: { enabled: true, intro: "Informações para revendedores.", payment: field, delivery: field, minimumOrder: field, notes: field },
    });
    const k = kinds(r.plan);
    const inst = pagesOf(r.plan, "institutional");
    expect(inst.length).toBeGreaterThan(1);
    expect(k.indexOf("commercial")).toBe(inst.at(-1)!);
    expect(k.indexOf("institutional")).toBe(1);
    // Todo o texto institucional desenhado (nenhuma linha perdida).
    const drawnLines = r.plan.flatMap((p) => (p.kind === "institutional" ? p.blocks.flat() : [])).join(" ");
    expect(drawnLines.replace(/\s+/g, " ")).toBe(long.split("\n").join(" ").replace(/\s+/g, " ").trim());
    inside(r.rects);
    noOverlap(r.rects, [...inst, ...pagesOf(r.plan, "commercial"), 1]);
    const body = r.rects.filter((x) => x.label === "inst-text" || x.label?.startsWith("com-text"));
    body.forEach((b) => expect(b.y + b.h).toBeLessThanOrEqual(PAGE.h - PAGE.margin - 8));
  });

  it("13. textos acima do limite são recusados (sem corte silencioso) e HTML é removido", async () => {
    await expect(gen(docA(), { cover: { title: "a".repeat(EDITORIAL_LIMITS.coverTitle + 1) } })).rejects.toBeInstanceOf(EditorialConfigError);
    const n = normalizeEditorialConfig(docA(), { cover: { title: "<b>Coleção</b><script>x()</script> Nova" } });
    expect(n.config.cover.title).not.toMatch(/[<>]/);
  });
});

describe("Fase 4 — capa", () => {
  it("7. título/subtítulo personalizados, sem logo e sem quantidade/ano", async () => {
    const r = await gen(docA(), { cover: { title: "Coleção Inverno", subtitle: "Edição limitada", showLogo: false, showMeta: false } });
    const cover = r.rects.filter((x) => x.page === 1).map((x) => x.label);
    expect(cover).toContain("cover-subtitle");
    expect(cover).not.toContain("cover-meta");
    expect(r.rects.filter((x) => x.label === "cover-title")).toHaveLength(1);
  });

  it("capa: imagem de produto não é aceita; só a pasta de capas da própria loja", () => {
    const d = docA();
    const own = d.products[2].primaryImage!.url;
    const n = normalizeEditorialConfig(d, { cover: { imageUrl: own } });
    expect(n.config.cover.image).toBeNull();
    expect((composePages(d, { editorial: n.config })[0] as { heroImage: unknown }).heroImage).toBeNull();
    expect((composePages(d, {})[0] as { heroImage: unknown }).heroImage).toBeNull();
    const base = "https://x.supabase.co";
    expect(isOwnCoverUrl(`${base}/storage/v1/object/public/product-images/${d.storeId}/catalog-covers/1-a.jpg`, d.storeId, base)).toBe(true);
    expect(isOwnCoverUrl(`${base}/storage/v1/object/public/product-images/outra-loja/catalog-covers/1-a.jpg`, d.storeId, base)).toBe(false);
    expect(isOwnCoverUrl(`${base}/storage/v1/object/public/product-images/${d.storeId}/catalog-covers/../x/a.jpg`, d.storeId, base)).toBe(false);
    expect(isOwnCoverUrl("https://outra-loja.exemplo/privado.jpg", d.storeId, base)).toBe(false);
  });

  it("capa Padrão: fundo branco, sem produto, logo centralizada", async () => {
    const r = await gen(docA(), {});
    const logo = r.rects.find((x) => x.page === 1 && x.label === "cover-logo");
    if (logo) { expect(logo.w).toBeLessThanOrEqual(70.01); expect(Math.abs(logo.x + logo.w / 2 - 105)).toBeLessThan(0.1); }
    expect(r.plan[0]).toEqual({ kind: "cover", heroImage: null });
  });
});

describe("Fase 4 — separadores e agrupamento", () => {
  it("9-14. completo, compacto e automático (1, 2 e 3+ produtos)", () => {
    const d = docA();
    const plan = (separators: "full" | "compact" | "auto") => kinds(composePages(d, { editorial: normalizeEditorialConfig(d, { separators }).config })).join(" ");
    expect(plan("full")).toBe("cover separator P2 separator P3 P4 separator P1 back");
    expect(plan("compact")).toBe("cover P2h P3h P4 P1h back");
    // Casa (2) e Kits (1) = compactos; Corpo (7) = completo.
    expect(plan("auto")).toBe("cover P2h separator P3 P4 P1h back");
  });

  it("10. cabeçalho compacto não sobrepõe produtos nem sai da página", async () => {
    const r = await gen(docA(), { separators: "compact" });
    const withHeader = r.plan.flatMap((p, i) => (p.kind === "products" && p.header ? [i + 1] : []));
    expect(withHeader).toHaveLength(3);
    withHeader.forEach((pg) => {
      const h = r.rects.find((x) => x.page === pg && x.label === "compact-header")!;
      r.rects.filter((x) => x.page === pg && (x.kind === "image" || x.label === "name")).forEach((x) => expect(x.y).toBeGreaterThanOrEqual(h.y + h.h));
    });
    inside(r.rects); noOverlap(r.rects, withHeader);
  });

  it("15/17. agrupamento por marca com 'Sem marca'", () => {
    const plan = composePages(docA("brand"));
    const seps = plan.filter((p) => p.kind === "separator").map((p) => (p as { title: string }).title);
    expect(seps).toEqual(["Linha Origem", "Sem marca"]);
  });

  it("16/18. agrupamento por categoria com 'Sem categoria'", () => {
    const src = fixtureStoreA();
    src.products[9].category_id = null;
    const plan = composePages(buildCatalogDocument(src, { presentation: { grouping: "category" } }));
    expect(plan.filter((p) => p.kind === "separator").map((p) => (p as { title: string }).title).at(-1)).toBe("Sem categoria");
  });

  it("19 + imagem por seção: personalizada só da própria seção; sem imagem cai no tipográfico", async () => {
    const d = docA();
    const casa = d.sections.find((s) => s.title === "Casa Perfumada")!;
    const corpoImg = d.products.find((p) => p.categoryId === "a-cat-corpo")!.primaryImage!.url;
    const casaImg = d.products.find((p) => p.categoryId === "a-cat-casa" && p.name.startsWith("Difusor"))!.primaryImage!.url;
    const bad = normalizeEditorialConfig(d, { sectionImages: { [casa.id]: corpoImg } });
    expect(bad.config.sectionImages[casa.id]).toBeUndefined();
    const good = composePages(d, { editorial: normalizeEditorialConfig(d, { sectionImages: { [casa.id]: casaImg } }).config });
    const sep = good.find((p) => p.kind === "separator" && p.sectionId === casa.id) as Extract<PagePlan, { kind: "separator" }>;
    expect(sep.image?.url).toBe(casaImg);
    expect(sep.imageSource).toBe("custom");
    const r = await generateEditorialPdf(d, { resolveImage: async () => null, editorial: { separators: "full" } });
    expect(r.rects.filter((x) => x.label === "sep-title").length).toBe(3);
  });
});

describe("Fase 4 — destaques", () => {
  it("20/22. destaque mantido na seção (padrão) ou só no destaque, sem duplicar no fluxo", () => {
    const d = docA();
    const id = d.products.find((p) => p.name.startsWith("Vela"))!.id;
    const keep = composePages(d, { editorial: normalizeEditorialConfig(d, { featured: { productIds: [id, id] } }).config });
    expect(keep.filter((p) => p.kind === "featured")).toHaveLength(1);
    expect(productIds(keep).filter((x) => x === id)).toHaveLength(1);
    const only = composePages(d, { editorial: normalizeEditorialConfig(d, { featured: { productIds: [id], policy: "featured_only" } }).config });
    expect(productIds(only)).not.toContain(id);
    expect(new Set(productIds(only)).size).toBe(productIds(only).length);
    expect(kinds(only).at(-2)).toBe("featured");
  });

  it("21/23. destaque sem imagem mostra aviso e tem link", async () => {
    const d = docA();
    const noImg = d.products.find((p) => !p.primaryImage)!;
    const r = await gen(d, { featured: { productIds: [noImg.id] } });
    const pg = pagesOf(r.plan, "featured")[0];
    expect(r.rects.some((x) => x.page === pg && x.label === "noimg")).toBe(true);
    expect(r.rects.some((x) => x.page === pg && x.label === "featured-badge")).toBe(true);
    expect(r.links.some((l) => l.page === pg && l.url.includes(noImg.id))).toBe(true);
    noOverlap(r.rects, [pg]);
  });

  it("produto de fora do documento (outra loja ou inativo) é recusado", async () => {
    await expect(gen(docA(), { featured: { productIds: [`${FIXTURE_STORE_B}-p000`] } })).rejects.toBeInstanceOf(EditorialConfigError);
    await expect(gen(docA(), { featured: { productIds: ["fixture-store-a-p010"] } })).rejects.toBeInstanceOf(EditorialConfigError);
  });
});

describe("Fase 4 — escala, isolamento e preview", () => {
  it("24/25. 230 produtos com todos os recursos: páginas = plano, sem duplicação", async () => {
    const d = buildCatalogDocument(fixtureStoreB(230), { presentation: { grouping: "category" } });
    const r = await generateEditorialPdf(d, { resolveImage: resolver, editorial: { separators: "auto", institutional: { enabled: true, text: ABOUT }, commercial: { enabled: true, minimumOrder: "R$ 300,00" }, featured: { productIds: [d.products[0].id], policy: "featured_only" } } });
    expect(r.pageCount).toBe(r.plan.length);
    const ids = productIds(r.plan);
    expect(new Set(ids).size).toBe(229);
    expect(ids.length).toBe(229);
  }, 30000);

  it("28. isolamento entre lojas mantido com configurações", async () => {
    const r = await gen(buildCatalogDocument(fixtureStoreB()), { separators: "compact" });
    expect(r.links.every((l) => !l.url.includes("emporio-serra-verde"))).toBe(true);
  });
});
