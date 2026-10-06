import { describe, it, expect } from "vitest";
import { buildCatalogDocument } from "../catalogDocument";
import { composePages, splitSection } from "./composer";
import { generateEditorialPdf, type ImageResolver } from "./generateEditorialPdf";
import { buildEditorialTheme, contrast, PAGE } from "./theme";
import { fixtureStoreA, fixtureStoreB, FIXTURE_STORE_A, FIXTURE_STORE_B } from "./editorialFixtures";
import type { DrawnRect } from "./canvas";

// 1×1 JPEG válido; dimensões declaradas simulam fotos reais.
const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const resolver: ImageResolver = async (url) => (url.includes("p3.") ? null : { data: PIXEL, width: 900, height: 1200, format: "JPEG", alias: url });

const docA = () => buildCatalogDocument(fixtureStoreA(), { presentation: { grouping: "category" }, now: new Date("2026-10-06T00:00:00Z") });

const overlaps = (a: DrawnRect, b: DrawnRect) => a.page === b.page && a.x < b.x + b.w - 0.05 && b.x < a.x + a.w - 0.05 && a.y < b.y + b.h - 0.05 && b.y < a.y + a.h - 0.05;

describe("composer", () => {
  it("divide seções em páginas de 1 a 4 sem sobras pequenas", () => {
    expect(splitSection(1)).toEqual([1]);
    expect(splitSection(2)).toEqual([2]);
    expect(splitSection(3)).toEqual([3]);
    expect(splitSection(4)).toEqual([4]);
    expect(splitSection(5)).toEqual([3, 2]);
    expect(splitSection(7)).toEqual([3, 4]);
    expect(splitSection(8)).toEqual([3, 3, 2]);
    for (let n = 1; n < 60; n++) expect(splitSection(n).reduce((a, b) => a + b, 0)).toBe(n);
  });

  it("gera capa, separadores, páginas 1/2/3/4 e contracapa", () => {
    const plan = composePages(docA());
    expect(plan[0].kind).toBe("cover");
    expect(plan.at(-1)!.kind).toBe("back");
    expect(plan.filter((p) => p.kind === "separator")).toHaveLength(3);
    const layouts = plan.flatMap((p) => (p.kind === "products" ? [p.layout] : []));
    expect(new Set(layouts)).toEqual(new Set([1, 2, 3, 4]));
  });

  it("não duplica produtos nem gera página vazia", () => {
    const plan = composePages(docA());
    const ids = plan.flatMap((p) => (p.kind === "products" ? p.productIds : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(docA().products.length);
    plan.forEach((p) => p.kind === "products" && expect(p.productIds.length).toBe(p.layout));
  });
});

describe("editorial_01 PDF", () => {
  it("gera o PDF com uma página por item do plano e links reais", async () => {
    const doc = docA();
    const r = await generateEditorialPdf(doc, { resolveImage: resolver, title: "Coleção Primavera" });
    expect(r.pageCount).toBe(r.plan.length);
    const productLinks = r.links.filter((l) => l.url.includes("/produto/"));
    expect(productLinks).toHaveLength(doc.products.length);
    productLinks.forEach((l) => expect(l.url).toMatch(/^https:\/\/shopdrive\.com\.br\/emporio-serra-verde\/produto\/.+\?src=catalogo_pdf$/));
    expect(r.links.some((l) => l.url.startsWith("https://wa.me/5592991234567"))).toBe(true);
    const raw = new TextDecoder("latin1").decode(r.bytes);
    expect(raw).toContain("src=catalogo_pdf");
    expect(raw).not.toContain("<script");
    expect(raw).not.toContain("<strong");
    expect(raw).not.toContain("inativo");
  });

  it("mantém textos dentro da página e sem sobreposição", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    const texts = r.rects.filter((x) => x.kind === "text" || x.kind === "button");
    texts.forEach((t) => {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(PAGE.w + 0.01);
      expect(t.y + t.h).toBeLessThanOrEqual(PAGE.h + 0.01);
    });
    const productTexts = texts.filter((t) => r.plan[t.page - 1].kind === "products" && t.label !== "badge" && t.label !== "noimg");
    for (let i = 0; i < productTexts.length; i++)
      for (let j = i + 1; j < productTexts.length; j++)
        if (overlaps(productTexts[i], productTexts[j])) throw new Error(`sobreposição p${productTexts[i].page}: ${productTexts[i].label} × ${productTexts[j].label}`);
  });

  it("aceita produto sem imagem e sem descrição", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    expect(r.rects.some((x) => x.label === "noimg")).toBe(true);
  });

  it("aplica a identidade de cada loja fictícia", () => {
    const a = buildEditorialTheme(docA().identity);
    const b = buildEditorialTheme(buildCatalogDocument(fixtureStoreB()).identity);
    expect(a.primary).toEqual([46, 94, 62]);
    expect(b.primary).toEqual([150, 40, 56]);
    [a, b].forEach((t) => expect(contrast(t.primary, t.onPrimary)).toBeGreaterThanOrEqual(4.5));
  });

  it("não mistura lojas", async () => {
    const r = await generateEditorialPdf(buildCatalogDocument(fixtureStoreB()), { resolveImage: resolver });
    expect(r.links.every((l) => !l.url.includes("emporio-serra-verde"))).toBe(true);
    const ids = r.plan.flatMap((p) => (p.kind === "products" ? p.productIds : []));
    expect(ids.every((id) => id.startsWith(FIXTURE_STORE_B) && !id.startsWith(FIXTURE_STORE_A))).toBe(true);
  });

  it("processa 230 produtos resolvendo imagens por página", async () => {
    let maxInFlight = 0, inFlight = 0;
    const counting: ImageResolver = async (url, e, t) => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); await Promise.resolve(); inFlight--; return resolver(url, e, t); };
    const doc = buildCatalogDocument(fixtureStoreB(230), { presentation: { grouping: "category" } });
    const r = await generateEditorialPdf(doc, { resolveImage: counting });
    const ids = r.plan.flatMap((p) => (p.kind === "products" ? p.productIds : []));
    expect(new Set(ids).size).toBe(230);
    expect(r.pageCount).toBe(r.plan.length);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  }, 30000);
});

describe("editorial_01 v1.1 — refinamento visual", () => {
  const sized = (w: number, h: number): ImageResolver => async (url) => (url.includes("p3.") || url.includes("missing") ? null : { data: PIXEL, width: w, height: h, format: "JPEG", alias: `${url}-${w}x${h}` });
  const pageOf = (r: Awaited<ReturnType<typeof generateEditorialPdf>>, kind: string, layout?: number) =>
    r.plan.findIndex((p) => p.kind === kind && (layout === undefined || (p.kind === "products" && p.layout === layout))) + 1;

  it("1. dois produtos em faixas horizontais (imagem à esquerda, texto à direita)", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    const pg = pageOf(r, "products", 2);
    const imgs = r.rects.filter((x) => x.page === pg && x.kind === "image");
    const names = r.rects.filter((x) => x.page === pg && x.label === "name");
    expect(names).toHaveLength(2);
    expect(names[1].y).toBeGreaterThan(names[0].y + 100);
    imgs.forEach((im) => names.forEach((n) => expect(im.x + im.w).toBeLessThanOrEqual(n.x)));
  });

  it("2/3. sem imagem: aviso 'Imagem indisponível'; com imagem adicional válida: usa a adicional", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: sized(900, 1200) });
    expect(r.rects.filter((x) => x.label === "noimg")).toHaveLength(1); // Shampoo sem foto
    const raw = new TextDecoder("latin1").decode(r.bytes);
    expect(raw).not.toMatch(/\(S\) Tj/);
    // Esfoliante tem principal quebrada + adicional válida → não cai no aviso
    const doc = docA();
    expect(doc.products.find((p) => p.name.startsWith("Esfoliante"))!.additionalImages).toHaveLength(1);
  });

  it.each([[900, 1200], [1200, 900], [1000, 1000]])("4-6. imagem %ix%i sem distorção", async (w, h) => {
    const r = await generateEditorialPdf(docA(), { resolveImage: sized(w, h) });
    r.rects.filter((x) => x.kind === "image" && r.plan[x.page - 1].kind === "products" && x.w < 150).forEach((im) => {
      expect(Math.abs(im.w / im.h - w / h)).toBeLessThan(0.01);
    });
  });

  it("7/8. nome extenso até 3 linhas e truncamento sem partir palavra", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    const cond = r.rects.find((x) => x.label === "name" && x.h > 12);
    expect(cond).toBeTruthy();
    const doc = docA();
    doc.products[0] = { ...doc.products[0], name: "Sabonete ".repeat(40).trim() };
    const r2 = await generateEditorialPdf(doc, { resolveImage: resolver });
    const raw = new TextDecoder("latin1").decode(r2.bytes);
    expect(raw).toMatch(/Sabonete\.\.\./);
    expect(raw).not.toMatch(/Sab(o|on|one|onet)\.\.\./);
  });

  it("9-13. descrição curta/longa, preço normal/promo e CTA dentro do bloco", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    expect(r.rects.some((x) => x.label === "price-old")).toBe(true);
    r.plan.forEach((p, i) => {
      if (p.kind !== "products") return;
      const pg = i + 1;
      const descs = r.rects.filter((x) => x.page === pg && x.label === "desc");
      const prices = r.rects.filter((x) => x.page === pg && (x.label === "price" || x.label === "price-old"));
      descs.forEach((d) => prices.forEach((pr) => !(d.x + d.w < pr.x || pr.x + pr.w < d.x) && d.y < pr.y && expect(d.y + d.h).toBeLessThanOrEqual(pr.y)));
    });
    expect(r.links.filter((l) => l.url.includes("/produto/")).every((l) => l.box.w > 15 && l.box.h > 5)).toBe(true);
  });

  it("14/15. separador com título longo e sem imagem permanece na página", async () => {
    const doc = docA();
    doc.sections[0] = { ...doc.sections[0], title: "Cuidados Diários Para Corpo, Rosto e Cabelos com Ingredientes Amazônicos Certificados" };
    for (const res of [resolver, (async () => null) as ImageResolver]) {
      const r = await generateEditorialPdf(doc, { resolveImage: res });
      const t = r.rects.filter((x) => x.label === "sep-title");
      expect(t.length).toBe(3);
      t.forEach((x) => { expect(x.x + x.w).toBeLessThanOrEqual(PAGE.w); expect(x.y + x.h).toBeLessThanOrEqual(PAGE.h - PAGE.margin); });
    }
  });

  it("16/17. capa sem imagem e contracapa só com o que existe", async () => {
    const src = fixtureStoreB();
    const r = await generateEditorialPdf(buildCatalogDocument(src), { resolveImage: async () => null });
    expect(r.rects.some((x) => x.label === "cover-title")).toBe(true);
    const back = r.rects.filter((x) => x.page === r.pageCount).map((x) => x.label);
    expect(back).toContain("back-WHATSAPP");
    expect(back).not.toContain("back-E-MAIL");
    expect(back).not.toContain("back-ENDEREÇO");
  });

  it("18. caracteres PT-BR e R$", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    const raw = new TextDecoder("latin1").decode(r.bytes);
    expect(raw).toContain("R$");
    expect(raw).toMatch(/indispon\xedvel|Imagem/);
    expect(r.templateId).toBe("editorial_01");
    expect(r.templateVersion).toBe("1.1");
  });
});
