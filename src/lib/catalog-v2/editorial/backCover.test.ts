import { describe, it, expect } from "vitest";
import { buildCatalogDocument } from "../catalogDocument";
import { generateEditorialPdf, type ImageResolver } from "./generateEditorialPdf";
import { isOwnBackCoverUrl, normalizeEditorialConfig } from "./editorialConfig";
import { fixtureStoreA } from "./editorialFixtures";
import { qrMatrix } from "./renderBackCover";

const docA = () => buildCatalogDocument(fixtureStoreA(), { presentation: { grouping: "category" }, now: new Date("2026-10-06T00:00:00Z") });
const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const resolver: ImageResolver = async (url) => ({ data: PIXEL, width: 1000, height: 1414, format: "JPEG", alias: url });

describe("contracapa: Padrão / Imagem personalizada", () => {
  it("só aceita a pasta de contracapa da própria loja", () => {
    const base = "https://x.supabase.co";
    const p = (s: string, f: string) => `${base}/storage/v1/object/public/product-images/${s}/${f}/1-a.jpg`;
    expect(isOwnBackCoverUrl(p("loja-a", "catalog-backcovers"), "loja-a", base)).toBe(true);
    expect(isOwnBackCoverUrl(p("loja-b", "catalog-backcovers"), "loja-a", base)).toBe(false);
    expect(isOwnBackCoverUrl(p("loja-a", "catalog-covers"), "loja-a", base)).toBe(false);
  });

  it("foto de produto é recusada como contracapa", () => {
    const d = docA();
    const url = d.products.find((p) => p.primaryImage)!.primaryImage!.url;
    const r = normalizeEditorialConfig(d, { backCover: { imageUrl: url } });
    expect(r.config.backCover.image).toBeNull();
    expect(r.issues.some((i) => i.field === "backCover.imageUrl" && i.code === "unauthorized_image")).toBe(true);
  });

  it("QR Code aponta para o link público da loja", async () => {
    const d = docA();
    const r = await generateEditorialPdf(d, { resolveImage: resolver });
    const last = r.pageCount;
    if (d.identity.publicUrl) {
      expect(r.rects.some((x) => x.page === last && x.label === "back-qr")).toBe(true);
      expect(r.links.some((l) => l.page === last && l.url === d.identity.publicUrl)).toBe(true);
    }
    expect(qrMatrix("https://shopdrive.com.br/aroma").length).toBeGreaterThan(20);
  });

  it("sem texto institucional repetido na contracapa", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver });
    expect(r.rects.some((x) => x.page === r.pageCount && x.label === "back-about")).toBe(false);
  });
});
