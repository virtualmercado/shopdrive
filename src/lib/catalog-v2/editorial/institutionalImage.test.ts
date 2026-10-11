import { describe, it, expect } from "vitest";
import { buildCatalogDocument } from "../catalogDocument";
import { generateEditorialPdf, type ImageResolver } from "./generateEditorialPdf";
import { isOwnInstitutionalUrl, normalizeEditorialConfig } from "./editorialConfig";
import { fixtureStoreA } from "./editorialFixtures";
import { INSTITUTIONAL_BAND } from "./renderInstitutional";

const docA = () => buildCatalogDocument(fixtureStoreA(), { selection: { kind: "all" } as never, presentation: { grouping: "category" } as never });
const TEXT = "Somos uma loja de cosmética natural.";
const resolver: ImageResolver = async () => ({ dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", format: "PNG", width: 400, height: 200 } as never);

describe("apresentação institucional: Padrão / Imagem personalizada", () => {
  it("foto de produto ou logo não são aceitas como imagem institucional", () => {
    const d = docA();
    const url = d.products.find((p) => p.primaryImage)!.primaryImage!.url;
    const r = normalizeEditorialConfig(d, { institutional: { enabled: true, text: TEXT, imageUrl: url } });
    expect(r.config.institutional?.image).toBeNull();
    expect(r.issues.some((i) => i.field === "institutional.imageUrl" && i.code === "unauthorized_image")).toBe(true);
  });

  it("só aceita a pasta institucional da própria loja", () => {
    const base = "https://x.supabase.co";
    const p = (s: string, f: string) => `${base}/storage/v1/object/public/product-images/${s}/${f}/1-a.jpg`;
    expect(isOwnInstitutionalUrl(p("loja-a", "catalog-institutional"), "loja-a", base)).toBe(true);
    expect(isOwnInstitutionalUrl(p("loja-b", "catalog-institutional"), "loja-a", base)).toBe(false);
    expect(isOwnInstitutionalUrl(p("loja-a", "catalog-covers"), "loja-a", base)).toBe(false);
  });

  it("Padrão: sem faixa colorida, logo discreta no canto superior esquerdo, título na posição atual", async () => {
    const r = await generateEditorialPdf(docA(), { resolveImage: resolver, editorial: { institutional: { enabled: true, text: TEXT } } });
    const page = r.plan.findIndex((p) => p.kind === "institutional") + 1;
    const rects = r.rects.filter((x) => x.page === page);
    expect(rects.some((x) => x.kind === "rect" && x.w >= 200 && x.h > 50 && x.h < 297)).toBe(false);
    const logo = rects.find((x) => x.label === "inst-logo");
    if (logo) { expect(logo.x).toBe(14); expect(logo.y).toBe(14); expect(logo.w).toBeLessThanOrEqual(32); }
    expect(rects.find((x) => x.label === "inst-title")?.y).toBe(47);
  });

  it("faixa da imagem personalizada é horizontal 210×100 mm", () => {
    expect(INSTITUTIONAL_BAND).toMatchObject({ w: 210, h: 100 });
  });
});
