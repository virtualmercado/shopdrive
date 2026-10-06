import type { CatalogDocument, CatalogImageRef, CatalogProduct } from "../types";
import type { CommercialItem, EditorialConfig } from "./editorialConfig";
import { PAGE } from "./theme";

export type ProductSlotCount = 1 | 2 | 3 | 4;

/** Cabeçalho de seção dentro da própria página de produtos (separador compacto). */
export interface CompactHeader { title: string; index: number; productCount: number }

export type SeparatorImageSource = "custom" | "ref" | "product";

export type PagePlan =
  | { kind: "cover"; heroImage: CatalogImageRef | null }
  | { kind: "institutional"; title: string; image: CatalogImageRef | null; part: number; parts: number; blocks: string[][] }
  | { kind: "commercial"; title: string; intro: string | null; items: CommercialItem[] }
  | { kind: "separator"; sectionId: string; title: string; subtitle: string | null; index: number; productCount: number; image: CatalogImageRef | null; imageSource?: SeparatorImageSource }
  | { kind: "products"; sectionId: string; sectionTitle: string; layout: ProductSlotCount; productIds: string[]; header?: CompactHeader }
  | { kind: "featured"; productId: string }
  | { kind: "back" };

/**
 * Divide n produtos de uma seção em páginas de 1–4 itens, priorizando a
 * faixa editorial de 3. Restos viram composições que preenchem a página
 * (4 em grade ou 2 lado a lado), nunca uma página quase vazia.
 */
export const splitSection = (n: number): ProductSlotCount[] => {
  if (n <= 0) return [];
  if (n <= 4) return [n as ProductSlotCount];
  const threes = Math.floor(n / 3);
  const rest = n % 3;
  if (rest === 0) return Array(threes).fill(3);
  if (rest === 1) return [...Array(threes - 1).fill(3), 4];
  return [...Array(threes).fill(3), 2];
};

/** Geometria da página institucional, compartilhada por compositor e renderer. */
export const INSTITUTIONAL = {
  x: PAGE.margin + 10,
  w: PAGE.w - PAGE.margin * 2 - 20,
  size: 10.5,
  leading: 1.5,
  paraGap: 3.2,
  /** Topo do corpo de texto: 1ª página com foto / sem foto / continuação. */
  topImage: 146,
  topPlain: 104,
  topNext: PAGE.margin + PAGE.headerH + 10,
  bottom: PAGE.h - PAGE.margin - 14,
} as const;

/** Quebra de linhas usada na paginação. O gerador injeta a medição real do jsPDF. */
export type WrapLines = (text: string, width: number, size: number) => string[];

/** Estimativa pura (sem jsPDF) — só para uso fora do gerador. */
export const estimateWrap: WrapLines = (text, width, size) => {
  const perLine = Math.max(10, Math.floor(width / (size * 0.3528 * 0.52)));
  const out: string[] = [];
  let cur = "";
  text.split(/\s+/).forEach((w) => {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= perLine) cur += " " + w;
    else { out.push(cur); cur = w; }
  });
  if (cur) out.push(cur);
  return out;
};

export const paginateInstitutional = (paragraphs: string[], hasImage: boolean, wrap: WrapLines): string[][][] => {
  const L = INSTITUTIONAL;
  const lh = L.size * 0.3528 * L.leading;
  const pages: string[][][] = [[]];
  let y = hasImage ? L.topImage : L.topPlain;
  paragraphs.forEach((para) => {
    let lines = wrap(para, L.w, L.size);
    while (lines.length) {
      const room = Math.floor((L.bottom - y) / lh);
      if (room < 2 && pages[pages.length - 1].length) { pages.push([]); y = L.topNext; continue; }
      const take = lines.length - room === 1 ? room - 1 : Math.min(room, lines.length); // evita linha viúva
      const chunk = lines.slice(0, Math.max(1, take));
      pages[pages.length - 1].push(chunk);
      y += chunk.length * lh + L.paraGap;
      lines = lines.slice(chunk.length);
      if (lines.length) { pages.push([]); y = L.topNext; }
    }
  });
  return pages.filter((p) => p.length);
};

export interface ComposeOptions {
  includeCover?: boolean;
  includeSeparators?: boolean;
  includeBackCover?: boolean;
  /** Configuração editorial normalizada (Fase 4). Ausente = comportamento v1.1. */
  editorial?: EditorialConfig;
  wrapLines?: WrapLines;
}

/** Paginação única do documento; renderer e preview consomem este plano. */
export const composePages = (doc: CatalogDocument, opts: ComposeOptions = {}): PagePlan[] => {
  const { includeCover = true, includeBackCover = doc.presentation.backCover, editorial: ed } = opts;
  const byId = new Map<string, CatalogProduct>(doc.products.map((p) => [p.id, p]));
  const featured = (ed?.featured.productIds ?? []).filter((id) => byId.has(id));
  const featuredOnly = ed?.featured.policy === "featured_only" ? new Set(featured) : null;
  const used = new Set<string>();
  const sections = doc.sections
    .map((s) => ({ ...s, productIds: s.productIds.filter((id) => byId.has(id) && !featuredOnly?.has(id) && !used.has(id) && (used.add(id), true)) }))
    .filter((s) => s.productIds.length > 0);
  const separators = opts.includeSeparators ?? (doc.presentation.grouping !== "none" && sections.length > 0);
  const mode = ed?.separators ?? "full";

  const pages: PagePlan[] = [];
  if (includeCover) {
    const hero = ed?.cover.image ?? doc.products.find((p) => p.isFeatured && p.primaryImage)?.primaryImage ?? doc.products.find((p) => p.primaryImage)?.primaryImage ?? null;
    pages.push({ kind: "cover", heroImage: hero });
  }
  if (ed?.institutional) {
    const parts = paginateInstitutional(ed.institutional.paragraphs, !!ed.institutional.image, opts.wrapLines ?? estimateWrap);
    parts.forEach((blocks, i) => pages.push({ kind: "institutional", title: ed.institutional!.title, image: i === 0 ? ed.institutional!.image : null, part: i + 1, parts: parts.length, blocks }));
  }
  if (ed?.commercial) pages.push({ kind: "commercial", ...ed.commercial });

  sections.forEach((s, i) => {
    const compact = separators && (mode === "compact" || (mode === "auto" && s.productIds.length <= (ed?.autoCompactMax ?? 2)));
    if (separators && !compact) {
      const custom = ed?.sectionImages[s.id] ?? null;
      const ref = ed && s.refId ? (s.kind === "category" ? doc.categories.find((c) => c.id === s.refId)?.iconUrl : s.kind === "brand" ? doc.brands.find((b) => b.id === s.refId)?.logoUrl : null) : null;
      const product = s.featuredImage ?? s.productIds.map((id) => byId.get(id)!.primaryImage).find(Boolean) ?? null;
      const [image, imageSource]: [CatalogImageRef | null, SeparatorImageSource | undefined] = custom
        ? [custom, "custom"]
        : ref ? [{ url: ref, order: 0 }, "ref"]
        : product ? [product, ed ? "product" : undefined] : [null, undefined];
      const sep: PagePlan = { kind: "separator", sectionId: s.id, title: s.title, subtitle: s.subtitle, index: i + 1, productCount: s.productIds.length, image };
      if (imageSource) sep.imageSource = imageSource;
      pages.push(sep);
    }
    let cursor = 0;
    splitSection(s.productIds.length).forEach((layout, j) => {
      const page: PagePlan = { kind: "products", sectionId: s.id, sectionTitle: s.title, layout, productIds: s.productIds.slice(cursor, cursor + layout) };
      if (compact && j === 0) page.header = { title: s.title, index: i + 1, productCount: s.productIds.length };
      pages.push(page);
      cursor += layout;
    });
  });
  featured.forEach((productId) => pages.push({ kind: "featured", productId }));
  if (includeBackCover) pages.push({ kind: "back" });
  return pages;
};
