import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { buildCatalogDocument } from "../catalogDocument";
import { generateEditorialPdf, type ImageResolver } from "./generateEditorialPdf";
import { normalizeEditorialConfig } from "./editorialConfig";
import { fixtureStoreA } from "./editorialFixtures";
import { COVER_FONTS, nearestWeight, normalizeCoverTypography, resolveCoverTypography, type FontLoader } from "./coverTypography";

const doc = () => buildCatalogDocument(fixtureStoreA(), { now: new Date("2026-10-06T00:00:00Z") });
const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const resolveImage: ImageResolver = async (url) => ({ data: PIXEL, width: 1000, height: 400, format: "JPEG", alias: url });
const loads: string[] = [];
const loadFont: FontLoader = async (f, w) => { loads.push(`${f}-${w}`); return readFileSync(`public/fonts/editorial/${f}-${w}.ttf`).toString("base64"); };
const gen = (typography?: object, cover: object = {}) => generateEditorialPdf(doc(), { resolveImage, loadFont, editorial: { cover: { ...cover, typography } } });
const fontFiles = (bytes: ArrayBuffer) => (Buffer.from(bytes).toString("latin1").match(/\/FontFile2/g) ?? []).length;
const cover = (r: Awaited<ReturnType<typeof gen>>) => Object.fromEntries(r.rects.filter((x) => x.page === 1 && x.label?.startsWith("cover-")).map((x) => [x.label, x]));

describe("tipografia da capa", () => {
  it("sem escolha: nenhuma fonte embutida e posições idênticas às de antes", async () => {
    const base = await generateEditorialPdf(doc(), { resolveImage, loadFont });
    const def = await gen({});
    expect(fontFiles(def.bytes)).toBe(0);
    for (const k of ["cover-store", "cover-title", "cover-meta"]) expect(cover(def)[k]).toEqual(cover(base)[k]);
  });

  it("Montserrat Bold no título, Poppins Regular no subtítulo e Raleway no nome: só 3 variantes embutidas", async () => {
    loads.length = 0;
    const r = await gen({ title: { fontFamily: "montserrat", fontWeight: 700 }, subtitle: { fontFamily: "poppins", fontWeight: 400 }, storeName: { fontFamily: "raleway" } }, { subtitle: "Coleção primavera" });
    expect(fontFiles(r.bytes)).toBe(3);
    expect(new Set(loads)).toEqual(new Set(["montserrat-700", "poppins-400", "raleway-700"]));
    const base = await gen({}, { subtitle: "Coleção primavera" });
    for (const k of ["cover-store", "cover-title", "cover-subtitle"]) { expect(cover(r)[k].x).toBe(cover(base)[k].x); expect(cover(r)[k].y).toBeCloseTo(cover(base)[k].y, 5); }
  });

  it("título longo quebra dentro da largura útil com fonte larga", async () => {
    const r = await gen({ title: { fontFamily: "montserrat", fontWeight: 700 } }, { title: "Coleção Açaí, Cupuaçu e Castanha — Cosméticos Naturais da Amazônia" });
    const t = cover(r)["cover-title"];
    expect(t.x + t.w).toBeLessThanOrEqual(210 - 14);
    expect(t.h).toBeGreaterThan(20); // mais de uma linha
  });

  it("todas as famílias e pesos geram PDF com acentos sem erro", async () => {
    for (const f of COVER_FONTS) for (const w of [300, 400, 500, 600, 700] as const) {
      const r = await gen({ title: { fontFamily: f.id, fontWeight: w } }, { title: "Ação, Coração ÇÃO àéêõü “aspas” 2026" });
      expect(r.issues.some((i) => i.code === "font_fallback")).toBe(false);
    }
  }, 60000);

  it("peso ausente vai para o mais próximo (Lato 500 → 400, 600 → 700)", () => {
    expect(nearestWeight("lato", 500)).toBe(400);
    expect(nearestWeight("lato", 600)).toBe(700);
    expect(nearestWeight("inter", 600)).toBe(600);
  });

  it("cor branca/preta e cores independentes para ano e quantidade", async () => {
    const { typography } = normalizeCoverTypography({ title: { color: "#ffffff" }, storeName: { color: "#000000" }, year: { color: "#FF0000" }, productCount: { color: "#00AA00" } });
    const { resolved } = await resolveCoverTypography(new jsPDF(), typography, loadFont);
    expect(resolved.title.color).toEqual([255, 255, 255]);
    expect(resolved.storeName.color).toEqual([0, 0, 0]);
    expect(resolved.year.color).toEqual([255, 0, 0]);
    expect(resolved.productCount.color).toEqual([0, 170, 0]);
  });

  it("toggles de ano e quantidade continuam mandando", async () => {
    const r = await gen({ year: { color: "#FF0000" }, productCount: { color: "#00AA00" } }, { showYear: false, showCount: false });
    expect(Object.keys(cover(r))).not.toContain("cover-meta");
    const y = await gen({ year: { color: "#FF0000" } }, { showCount: false });
    expect(Object.keys(cover(y))).toContain("cover-year");
    expect(Object.keys(cover(y))).not.toContain("cover-count");
  });

  it("rejeita fonte arbitrária, URL, CSS e HEX inválido", () => {
    const r = normalizeEditorialConfig(doc(), { cover: { typography: { title: { fontFamily: "https://evil/x.ttf" as never, fontWeight: 900 as never, color: "red; background:url(x)" } } } });
    expect(r.config.cover.typography.title).toEqual({ fontFamily: "default", fontWeight: "default", color: null });
    expect(r.issues.filter((i) => i.code === "invalid_value")).toHaveLength(3);
  });

  it("fonte que não carrega: PDF gerado com fallback e aviso", async () => {
    const r = await generateEditorialPdf(doc(), { resolveImage, loadFont: async () => null, editorial: { cover: { typography: { title: { fontFamily: "nunito", fontWeight: 700 } } } } });
    expect(r.pageCount).toBeGreaterThan(0);
    expect(r.issues).toContainEqual({ field: "cover.typography", code: "font_fallback", font: "Nunito 700" });
    expect(cover(r)["cover-title"]).toBeTruthy();
  });

  it("mesma configuração gera os mesmos bytes (prévia = download = publicação)", async () => {
    const t = { title: { fontFamily: "montserrat", fontWeight: 700 } };
    const a = await gen(t), b = await gen(t);
    expect(a.plan).toEqual(b.plan);
    expect(fontFiles(a.bytes)).toBe(fontFiles(b.bytes));
  });
});
