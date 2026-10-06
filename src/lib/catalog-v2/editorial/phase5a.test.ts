import { describe, it, expect } from "vitest";
import { buildCatalogDocument, CatalogSelectionError } from "../catalogDocument";
import { generateEditorialPdf, type ImageResolver } from "./generateEditorialPdf";
import { normalizeEditorialConfig } from "./editorialConfig";
import { featuredInDocument, toCatalogSelection } from "./uiSelection";
import { fixtureStoreA, fixtureStoreB } from "./editorialFixtures";

const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const resolver: ImageResolver = async (url) => ({ data: PIXEL, width: 800, height: 1000, format: "JPEG", alias: url });
const NOW = new Date("2026-10-06T00:00:00Z");

describe("Fase 5A — seleção do configurador", () => {
  it("modo específico sem itens não vira 'todos'", () => {
    expect(toCatalogSelection({ mode: "categories", categoryIds: [], brandIds: ["x"], productIds: [] })).toBeNull();
    expect(toCatalogSelection({ mode: "all", categoryIds: ["c"], brandIds: [], productIds: [] })).toEqual({});
  });
  it("um modo não herda filtros de outro", () => {
    expect(toCatalogSelection({ mode: "brands", categoryIds: ["c1"], brandIds: ["b1", "b1"], productIds: ["p"] })).toEqual({ brandIds: ["b1"] });
  });
  it("produto de outra loja é recusado", () => {
    const foreign = fixtureStoreB().products[0].id;
    expect(() => buildCatalogDocument(fixtureStoreA(), { selection: { productIds: [foreign] } })).toThrow(CatalogSelectionError);
  });
  it("destaques fora do documento são descartados", () => {
    const doc = buildCatalogDocument(fixtureStoreA(), { now: NOW });
    expect(featuredInDocument(doc, [doc.products[0].id, "outro", doc.products[0].id])).toEqual([doc.products[0].id]);
  });
});

describe("Fase 5A — capa: ano e quantidade independentes", () => {
  const doc = () => buildCatalogDocument(fixtureStoreA(), { now: NOW });
  const meta = async (cover: object) => {
    const r = await generateEditorialPdf(doc(), { resolveImage: resolver, editorial: { cover } });
    return r.rects.filter((x) => x.label === "cover-meta").length;
  };
  it("defaults preservam ano e quantidade", async () => {
    const { config } = normalizeEditorialConfig(doc(), {});
    expect(config.cover.showYear).toBe(true);
    expect(config.cover.showCount).toBe(true);
  });
  it("ocultar ambos remove a linha; ocultar só um mantém", async () => {
    expect(await meta({ showYear: false, showCount: false })).toBe(0);
    expect(await meta({ showYear: false })).toBe(1);
  });
  it("showMeta=false legado continua ocultando", async () => {
    expect(await meta({ showMeta: false })).toBe(0);
  });
});

describe("Fase 5B — texto seguro para o PDF", async () => {
  const { pdfSafe } = await import("./canvas");
  it("remove emojis e mantém acentos e pontuação tipográfica", () => {
    expect(pdfSafe("Chá 🌿 de ervas — “natural” ✅")).toBe("Chá de ervas — “natural” ");
  });
});
