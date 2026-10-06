import type { CatalogDocument, CatalogImageRef, CatalogProduct } from "../types";

export type ProductSlotCount = 1 | 2 | 3 | 4;

export type PagePlan =
  | { kind: "cover"; heroImage: CatalogImageRef | null }
  | { kind: "separator"; sectionId: string; title: string; subtitle: string | null; index: number; productCount: number; image: CatalogImageRef | null }
  | { kind: "products"; sectionId: string; sectionTitle: string; layout: ProductSlotCount; productIds: string[] }
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

export interface ComposeOptions {
  includeCover?: boolean;
  includeSeparators?: boolean;
  includeBackCover?: boolean;
}

/** Paginação única do documento; renderer e preview consomem este plano. */
export const composePages = (doc: CatalogDocument, opts: ComposeOptions = {}): PagePlan[] => {
  const { includeCover = true, includeBackCover = doc.presentation.backCover } = opts;
  const byId = new Map<string, CatalogProduct>(doc.products.map((p) => [p.id, p]));
  const used = new Set<string>();
  const sections = doc.sections
    .map((s) => ({ ...s, productIds: s.productIds.filter((id) => byId.has(id) && !used.has(id) && (used.add(id), true)) }))
    .filter((s) => s.productIds.length > 0);
  const separators = opts.includeSeparators ?? (doc.presentation.grouping !== "none" && sections.length > 0);

  const pages: PagePlan[] = [];
  if (includeCover) {
    const hero = doc.products.find((p) => p.isFeatured && p.primaryImage)?.primaryImage ?? doc.products.find((p) => p.primaryImage)?.primaryImage ?? null;
    pages.push({ kind: "cover", heroImage: hero });
  }
  sections.forEach((s, i) => {
    if (separators) {
      const img = s.featuredImage ?? s.productIds.map((id) => byId.get(id)!.primaryImage).find(Boolean) ?? null;
      pages.push({ kind: "separator", sectionId: s.id, title: s.title, subtitle: s.subtitle, index: i + 1, productCount: s.productIds.length, image: img });
    }
    let cursor = 0;
    splitSection(s.productIds.length).forEach((layout) => {
      pages.push({ kind: "products", sectionId: s.id, sectionTitle: s.title, layout, productIds: s.productIds.slice(cursor, cursor + layout) });
      cursor += layout;
    });
  });
  if (includeBackCover) pages.push({ kind: "back" });
  return pages;
};
