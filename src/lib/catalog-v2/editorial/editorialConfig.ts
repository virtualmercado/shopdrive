import { htmlToCatalogText } from "@/lib/catalogPdfClassic";
import type { CatalogDocument, CatalogImageRef } from "../types";

/**
 * Configurações editoriais opcionais do editorial_01 (Fase 4).
 * Entrada = dado NÃO confiável (vem do lojista). Tudo passa por
 * `normalizeEditorialConfig`, que limpa textos, valida limites, IDs e imagens.
 * Sem configuração, o resultado é idêntico ao comportamento da v1.1.
 */

export type SeparatorMode = "full" | "compact" | "auto";
/** keep_in_section: produto aparece na seção e na página de destaque. featured_only: só no destaque. */
export type FeaturedPolicy = "keep_in_section" | "featured_only";

export interface EditorialConfigInput {
  cover?: { title?: string | null; subtitle?: string | null; imageUrl?: string | null; showLogo?: boolean; showMeta?: boolean };
  institutional?: { enabled?: boolean; title?: string | null; text?: string | null; useStoreAbout?: boolean; imageUrl?: string | null };
  commercial?: { enabled?: boolean; title?: string | null; intro?: string | null; payment?: string | null; delivery?: string | null; minimumOrder?: string | null; notes?: string | null };
  separators?: SeparatorMode;
  /** Chave = id da seção do CatalogDocument (ex.: "category:<id>"). */
  sectionImages?: Record<string, string>;
  featured?: { productIds?: string[]; policy?: FeaturedPolicy };
}

export const EDITORIAL_LIMITS = {
  coverTitle: 90,
  coverSubtitle: 160,
  institutionalTitle: 80,
  institutionalText: 4000,
  commercialTitle: 80,
  commercialIntro: 400,
  commercialField: 500,
  featured: 12,
} as const;

/** Seção com até N produtos vira separador compacto no modo automático. */
export const AUTO_COMPACT_MAX = 2;

export interface CommercialItem { key: "payment" | "delivery" | "minimumOrder" | "notes"; label: string; text: string }

export interface EditorialConfig {
  cover: { title: string | null; subtitle: string | null; image: CatalogImageRef | null; showLogo: boolean; showMeta: boolean };
  institutional: { title: string; paragraphs: string[]; image: CatalogImageRef | null } | null;
  commercial: { title: string; intro: string | null; items: CommercialItem[] } | null;
  /** null = comportamento anterior (separador completo quando agrupado). */
  separators: SeparatorMode | null;
  autoCompactMax: number;
  sectionImages: Record<string, CatalogImageRef>;
  featured: { productIds: string[]; policy: FeaturedPolicy };
}

export type EditorialIssue =
  | { field: string; code: "too_long"; limit: number; length: number }
  | { field: string; code: "unknown_product"; id: string }
  | { field: string; code: "unauthorized_image"; url: string }
  | { field: string; code: "empty" };

/** Erro bloqueante: texto acima do limite ou produto fora do documento. Nunca corta em silêncio. */
export class EditorialConfigError extends Error {
  constructor(public readonly issues: EditorialIssue[]) {
    super(`Configuração editorial inválida: ${issues.map((i) => `${i.field}:${i.code}`).join(", ")}`);
    this.name = "EditorialConfigError";
  }
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g;

/** Texto curto: sem HTML, sem controle, uma linha. */
export const cleanLine = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const t = htmlToCatalogText(s).replace(CONTROL, "").replace(/\s+/g, " ").trim();
  return t || null;
};

/** Texto longo: sem HTML, parágrafos preservados. */
export const cleanParagraphs = (s: string | null | undefined): string[] => {
  if (!s) return [];
  return htmlToCatalogText(s)
    .replace(CONTROL, "")
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
};

const docImageUrls = (doc: CatalogDocument) => {
  const all = new Set<string>();
  doc.products.forEach((p) => [p.primaryImage, ...p.additionalImages].forEach((r) => r && all.add(r.url)));
  if (doc.identity.logoUrl) all.add(doc.identity.logoUrl);
  doc.categories.forEach((c) => c.iconUrl && all.add(c.iconUrl));
  doc.brands.forEach((b) => b.logoUrl && all.add(b.logoUrl));
  return all;
};

/** Imagens que pertencem a UMA seção: fotos dos seus produtos + ícone/logo da própria categoria/marca. */
export const sectionImageUrls = (doc: CatalogDocument, sectionId: string) => {
  const s = doc.sections.find((x) => x.id === sectionId);
  const out = new Set<string>();
  if (!s) return out;
  const byId = new Map(doc.products.map((p) => [p.id, p]));
  s.productIds.forEach((id) => {
    const p = byId.get(id);
    p && [p.primaryImage, ...p.additionalImages].forEach((r) => r && out.add(r.url));
  });
  if (s.refId && s.kind === "category") { const c = doc.categories.find((c) => c.id === s.refId); c?.iconUrl && out.add(c.iconUrl); }
  if (s.refId && s.kind === "brand") { const b = doc.brands.find((b) => b.id === s.refId); b?.logoUrl && out.add(b.logoUrl); }
  return out;
};

export const normalizeEditorialConfig = (doc: CatalogDocument, input: EditorialConfigInput = {}): { config: EditorialConfig; issues: EditorialIssue[] } => {
  const issues: EditorialIssue[] = [];
  const allowed = docImageUrls(doc);
  const len = (field: string, value: string | null, limit: number) => {
    if (value && value.length > limit) issues.push({ field, code: "too_long", limit, length: value.length });
    return value;
  };
  const img = (field: string, url: string | null | undefined, set: Set<string>): CatalogImageRef | null => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u) return null;
    if (!set.has(u)) { issues.push({ field, code: "unauthorized_image", url: u }); return null; }
    return { url: u, order: 0 };
  };

  const c = input.cover ?? {};
  const cover = {
    title: len("cover.title", cleanLine(c.title), EDITORIAL_LIMITS.coverTitle),
    subtitle: len("cover.subtitle", cleanLine(c.subtitle), EDITORIAL_LIMITS.coverSubtitle),
    image: img("cover.imageUrl", c.imageUrl, allowed),
    showLogo: c.showLogo ?? true,
    showMeta: c.showMeta ?? true,
  };

  let institutional: EditorialConfig["institutional"] = null;
  const ins = input.institutional;
  if (ins?.enabled) {
    const custom = cleanParagraphs(ins.text);
    const about = ins.useStoreAbout ? cleanParagraphs(doc.identity.about?.text) : [];
    const paragraphs = custom.length ? custom : about;
    const total = paragraphs.join("\n").length;
    if (total > EDITORIAL_LIMITS.institutionalText) issues.push({ field: "institutional.text", code: "too_long", limit: EDITORIAL_LIMITS.institutionalText, length: total });
    const title = len("institutional.title", cleanLine(ins.title) ?? (custom.length ? null : cleanLine(doc.identity.about?.title)), EDITORIAL_LIMITS.institutionalTitle) ?? "Bem-vindo à nossa loja";
    if (paragraphs.length) institutional = { title, paragraphs, image: img("institutional.imageUrl", ins.imageUrl, allowed) };
    else issues.push({ field: "institutional", code: "empty" });
  }

  let commercial: EditorialConfig["commercial"] = null;
  const com = input.commercial;
  if (com?.enabled) {
    const fields: [CommercialItem["key"], string][] = [["payment", "Condições de pagamento"], ["delivery", "Entrega"], ["minimumOrder", "Pedido mínimo"], ["notes", "Observações"]];
    const items = fields
      .map(([key, label]) => ({ key, label, text: len(`commercial.${key}`, cleanParagraphs(com[key]).join("\n") || null, EDITORIAL_LIMITS.commercialField) }))
      .filter((i): i is CommercialItem => !!i.text);
    const intro = len("commercial.intro", cleanParagraphs(com.intro).join("\n") || null, EDITORIAL_LIMITS.commercialIntro);
    const title = len("commercial.title", cleanLine(com.title), EDITORIAL_LIMITS.commercialTitle) ?? "Condições comerciais";
    if (items.length || intro) commercial = { title, intro, items };
    else issues.push({ field: "commercial", code: "empty" });
  }

  const sectionImages: Record<string, CatalogImageRef> = {};
  Object.entries(input.sectionImages ?? {}).forEach(([sid, url]) => {
    const ref = img(`sectionImages.${sid}`, url, sectionImageUrls(doc, sid));
    if (ref) sectionImages[sid] = ref;
  });

  const known = new Set(doc.products.map((p) => p.id));
  const featuredIds: string[] = [];
  (input.featured?.productIds ?? []).forEach((id) => {
    if (!known.has(id)) issues.push({ field: "featured.productIds", code: "unknown_product", id });
    else if (!featuredIds.includes(id)) featuredIds.push(id);
  });
  if (featuredIds.length > EDITORIAL_LIMITS.featured) issues.push({ field: "featured.productIds", code: "too_long", limit: EDITORIAL_LIMITS.featured, length: featuredIds.length });

  return {
    config: {
      cover,
      institutional,
      commercial,
      separators: input.separators ?? null,
      autoCompactMax: AUTO_COMPACT_MAX,
      sectionImages,
      featured: { productIds: featuredIds, policy: input.featured?.policy ?? "keep_in_section" },
    },
    issues,
  };
};

/** Bloqueantes: textos acima do limite e produtos fora do documento. Imagem não autorizada só cai no fallback. */
export const blockingIssues = (issues: EditorialIssue[]) => issues.filter((i) => i.code === "too_long" || i.code === "unknown_product");
