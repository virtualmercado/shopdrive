import type { CatalogDocument, CatalogSelection } from "../types";

/** Modos de seleção do configurador. Cada modo usa SOMENTE os próprios IDs (sem herdar filtros de outro). */
export type EditorialSelectionMode = "all" | "categories" | "brands" | "products";

export interface EditorialSelectionState {
  mode: EditorialSelectionMode;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
}

/** null = seleção incompleta (modo específico sem nenhum item marcado). Nunca vira "todos" silenciosamente. */
export const toCatalogSelection = (s: EditorialSelectionState): CatalogSelection | null => {
  if (s.mode === "all") return {};
  const ids = s.mode === "categories" ? s.categoryIds : s.mode === "brands" ? s.brandIds : s.productIds;
  const unique = Array.from(new Set(ids));
  if (!unique.length) return null;
  if (s.mode === "categories") return { categoryIds: unique };
  if (s.mode === "brands") return { brandIds: unique };
  return { productIds: unique };
};

/** Mantém apenas destaques que ainda estão no documento (ex.: após mudar a seleção). */
export const featuredInDocument = (doc: CatalogDocument, ids: string[]) => {
  const known = new Set(doc.products.map((p) => p.id));
  return ids.filter((id, i) => known.has(id) && ids.indexOf(id) === i);
};

/** Seções cujo ID ainda existe no documento atual. */
export const sectionImagesInDocument = (doc: CatalogDocument, map: Record<string, string>) => {
  const ids = new Set(doc.sections.map((s) => s.id));
  return Object.fromEntries(Object.entries(map).filter(([k, v]) => ids.has(k) && !!v));
};
