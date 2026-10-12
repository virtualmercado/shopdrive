import type { jsPDF } from "jspdf";
import { hexToRgb, type RGB } from "./theme";

/**
 * Tipografia dos textos da capa (fonte + peso + cor), fonte única de verdade
 * para o configurador e o renderer. Arquivos TTF servidos pela própria ShopDrive
 * em /fonts/editorial/{id}-{peso}.ttf, carregados sob demanda e só os usados.
 */
export const COVER_FONTS = [
  { id: "inter", label: "Inter", weights: [300, 400, 500, 600, 700] },
  { id: "poppins", label: "Poppins", weights: [300, 400, 500, 600, 700] },
  { id: "roboto", label: "Roboto", weights: [300, 400, 500, 600, 700] },
  { id: "opensans", label: "Open Sans", weights: [300, 400, 500, 600, 700] },
  { id: "lato", label: "Lato", weights: [300, 400, 700] },
  { id: "montserrat", label: "Montserrat", weights: [300, 400, 500, 600, 700] },
  { id: "nunito", label: "Nunito", weights: [300, 400, 500, 600, 700] },
  { id: "raleway", label: "Raleway", weights: [300, 400, 500, 600, 700] },
] as const;
export type CoverFontId = (typeof COVER_FONTS)[number]["id"];

export const COVER_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
] as const;
export type CoverWeight = (typeof COVER_WEIGHTS)[number]["value"];

export const COVER_TEXT_ELEMENTS = [
  { key: "storeName", label: "Nome da loja" },
  { key: "title", label: "Título do catálogo" },
  { key: "subtitle", label: "Subtítulo" },
  { key: "year", label: "Ano" },
  { key: "productCount", label: "Quantidade de produtos" },
] as const;
export type CoverTextKey = (typeof COVER_TEXT_ELEMENTS)[number]["key"];

/** "default" = exatamente o que o renderer já usava (Helvetica, peso e cor atuais). */
export interface CoverTextStyle { fontFamily: CoverFontId | "default"; fontWeight: CoverWeight | "default"; color: string | null }
export type CoverTypographyInput = Partial<Record<CoverTextKey, Partial<CoverTextStyle> | null>>;
export type CoverTypography = Record<CoverTextKey, CoverTextStyle>;

export const DEFAULT_COVER_TEXT_STYLE: CoverTextStyle = { fontFamily: "default", fontWeight: "default", color: null };
/** Peso que o renderer já usava em cada elemento (para quando só a família muda). */
export const COVER_DEFAULT_WEIGHT: Record<CoverTextKey, CoverWeight> = { storeName: 700, title: 700, subtitle: 400, year: 400, productCount: 400 };

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isValidHex = (s: unknown): s is string => typeof s === "string" && HEX.test(s);

export type TypographyIssue = { field: string; code: "invalid_value" };

/** Aceita apenas valores da lista central; o resto volta ao padrão (com aviso). */
export const normalizeCoverTypography = (input: CoverTypographyInput | undefined): { typography: CoverTypography; issues: TypographyIssue[] } => {
  const issues: TypographyIssue[] = [];
  const out = {} as CoverTypography;
  for (const { key } of COVER_TEXT_ELEMENTS) {
    const s = input?.[key] ?? {};
    const fam = s.fontFamily ?? "default";
    const fontFamily = fam === "default" || COVER_FONTS.some((f) => f.id === fam) ? fam : (issues.push({ field: `coverTypography.${key}.fontFamily`, code: "invalid_value" }), "default");
    const w = s.fontWeight ?? "default";
    const fontWeight = w === "default" || COVER_WEIGHTS.some((x) => x.value === w) ? w : (issues.push({ field: `coverTypography.${key}.fontWeight`, code: "invalid_value" }), "default");
    const c = s.color ?? null;
    const color = c === null || c === "" ? null : isValidHex(c) ? c.toUpperCase() : (issues.push({ field: `coverTypography.${key}.color`, code: "invalid_value" }), null);
    out[key] = { fontFamily: fontFamily as CoverTextStyle["fontFamily"], fontWeight: fontWeight as CoverTextStyle["fontWeight"], color };
  }
  return { typography: out, issues };
};

/** Peso disponível mais próximo na família (empate → mais pesado). Regra única. */
export const nearestWeight = (font: CoverFontId, weight: CoverWeight): CoverWeight => {
  const ws = COVER_FONTS.find((f) => f.id === font)!.weights as readonly CoverWeight[];
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) || (Math.abs(w - weight) === Math.abs(best - weight) && w > best) ? w : best), ws[0]);
};

export const fontFileUrl = (font: CoverFontId, weight: CoverWeight) => `/fonts/editorial/${font}-${weight}.ttf`;

/** Fonte efetiva aplicada no jsPDF: nome registrado + estilo. */
export interface PdfFontRef { family: string; style: "normal" | "bold" }
export interface ResolvedCoverText { font: PdfFontRef | null; color: RGB | null }
export type ResolvedCoverTypography = Record<CoverTextKey, ResolvedCoverText>;

/** Retorna o TTF em base64; deve cachear. null/erro = fallback. */
export type FontLoader = (font: CoverFontId, weight: CoverWeight) => Promise<string | null>;

const cache = new Map<string, Promise<string | null>>();
const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
/** Carregador do navegador: arquivos da própria ShopDrive, cache por sessão. */
export const browserFontLoader: FontLoader = (font, weight) => {
  const k = `${font}-${weight}`;
  if (!cache.has(k)) {
    const p = fetch(fontFileUrl(font, weight))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(toBase64)
      .catch(() => { cache.delete(k); return null; });
    cache.set(k, p);
  }
  return cache.get(k)!;
};

/**
 * Registra no jsPDF somente as variantes usadas (uma vez cada).
 * Falha de carga → Helvetica no peso equivalente (fallback previsível) e aviso.
 */
export const resolveCoverTypography = async (pdf: jsPDF, t: CoverTypography, load: FontLoader): Promise<{ resolved: ResolvedCoverTypography; failed: string[] }> => {
  const registered = new Map<string, PdfFontRef | null>();
  const failed: string[] = [];
  const resolved = {} as ResolvedCoverTypography;
  for (const { key } of COVER_TEXT_ELEMENTS) {
    const s = t[key];
    const color = s.color ? hexToRgb(s.color) : null;
    const reqWeight = s.fontWeight === "default" ? COVER_DEFAULT_WEIGHT[key] : s.fontWeight;
    let font: PdfFontRef | null = null;
    if (s.fontFamily === "default") {
      if (s.fontWeight !== "default") font = { family: "helvetica", style: reqWeight >= 600 ? "bold" : "normal" };
    } else {
      const w = nearestWeight(s.fontFamily, reqWeight);
      const name = `ed-${s.fontFamily}-${w}`;
      if (!registered.has(name)) {
        const b64 = await load(s.fontFamily, w).catch(() => null);
        let ref: PdfFontRef | null = null;
        if (b64) {
          try {
            pdf.addFileToVFS(`${name}.ttf`, b64);
            pdf.addFont(`${name}.ttf`, name, "normal");
            ref = { family: name, style: "normal" };
          } catch { ref = null; }
        }
        if (!ref) failed.push(`${COVER_FONTS.find((f) => f.id === s.fontFamily)!.label} ${w}`);
        registered.set(name, ref);
      }
      font = registered.get(name) ?? { family: "helvetica", style: reqWeight >= 600 ? "bold" : "normal" };
    }
    resolved[key] = { font, color };
  }
  return { resolved, failed };
};
