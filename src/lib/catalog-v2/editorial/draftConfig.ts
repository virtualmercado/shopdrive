import { z } from "zod";
import { buildCatalogDocument } from "../catalogDocument";
import type { CatalogSource } from "../types";
import { featuredInDocument, sectionImagesInDocument, toCatalogSelection } from "./uiSelection";
import { COVER_FONTS, type BackTypographyInput, type CoverTypographyInput } from "./coverTypography";
import type { EditorialConfigInput } from "./editorialConfig";

export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_SAVE_DEBOUNCE_MS = 1000;
export const PREVIEW_BUCKET = "catalog-editorial-previews";

const imageMode = z.enum(["default", "custom"]);
const ids = z.array(z.string()).default([]);
const textStyle = z.object({
  fontFamily: z.string().refine((v) => v === "default" || COVER_FONTS.some((f) => f.id === v)).optional(),
  fontWeight: z.union([z.literal("default"), z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
});
const typography = z.record(textStyle.nullable()).default({});

// Raw editor intent includes disabled fields and IDs from inactive selection modes.
// UI-only search, focus, busy flags, zoom and current page are deliberately absent.
export const draftConfigSchema = z.object({
  mode: z.enum(["all", "categories", "brands", "products"]).default("all"),
  categoryIds: ids, brandIds: ids, productIds: ids,
  title: z.string().default("Catálogo de produtos"), subtitle: z.string().default(""),
  coverImage: z.string().default(""), coverMode: imageMode.default("default"),
  showYear: z.boolean().default(true), showCount: z.boolean().default(true), typography,
  backImage: z.string().default(""), backMode: imageMode.default("default"), backTypography: typography,
  grouping: z.enum(["none", "category", "brand"]).default("none"),
  separators: z.enum(["auto", "full", "compact"]).default("auto"),
  sectionImages: z.record(z.string()).default({}), sectionCustom: z.record(z.boolean()).default({}),
  showPrices: z.boolean().default(true), excludeNoImage: z.boolean().default(false),
  instEnabled: z.boolean().default(false), instTitle: z.string().default(""), instText: z.string().default(""),
  instImage: z.string().default(""), instMode: imageMode.default("default"),
  comEnabled: z.boolean().default(false),
  com: z.object({ title: z.string().default(""), intro: z.string().default(""), payment: z.string().default(""), delivery: z.string().default(""), minimumOrder: z.string().default(""), notes: z.string().default("") }).default({}),
  featEnabled: z.boolean().default(false), featured: ids,
  featPolicy: z.enum(["keep_in_section", "featured_only"]).default("keep_in_section"),
});
export type CatalogDraftConfig = Omit<Required<z.infer<typeof draftConfigSchema>>, "com"> & {
  com: { title: string; intro: string; payment: string; delivery: string; minimumOrder: string; notes: string };
};

// jsonb reorders keys; equality must not depend on insertion order.
export function draftConfigKey(value: unknown): string {
  const ordered = (item: unknown): unknown => Array.isArray(item) ? item.map(ordered) : item && typeof item === "object"
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, ordered(v)])) : item;
  return JSON.stringify(ordered(value));
}

export interface CatalogPreviewMetadata {
  id: string; path: string; page_count: number; generated_at: string;
  draft_revision: number; source_revision: number;
  publication_baseline: { updatedAt: string | null; hasCurrent: boolean };
}
export interface CatalogDraftRecord {
  config: unknown | null; schema_version: number; draft_revision: number; source_revision: number;
  draft_updated_at: string | null; preview: CatalogPreviewMetadata | null; stale: boolean;
}
export interface PreviewReservation {
  id: string; path: string; draft_revision: number; source_revision: number;
  publication_baseline: { updatedAt: string | null; hasCurrent: boolean };
}

export function parseDraftConfig(config: unknown, schemaVersion: number): CatalogDraftConfig {
  if (schemaVersion !== DRAFT_SCHEMA_VERSION) throw new Error("unsupported catalog draft version");
  return draftConfigSchema.parse(config) as CatalogDraftConfig;
}

// Saved unavailable IDs are retained as intent but never passed to the strict
// ownership validator. An empty manual selection never falls back to all.
export function effectiveDraftSelection(source: CatalogSource, config: CatalogDraftConfig) {
  const products = new Set(source.products.filter((p) => p.user_id === source.storeId && p.is_active).map((p) => p.id));
  const categories = new Set(source.categories.filter((c) => c.user_id === source.storeId).map((c) => c.id));
  const brands = new Set(source.brands.filter((b) => b.user_id === source.storeId).map((b) => b.id));
  return toCatalogSelection({ mode: config.mode,
    productIds: config.productIds.filter((id) => products.has(id)),
    categoryIds: config.categoryIds.filter((id) => id === "__sem_categoria__" || categories.has(id)),
    brandIds: config.brandIds.filter((id) => id === "__sem_marca__" || brands.has(id)),
  });
}

export function buildDraftDocument(source: CatalogSource, config: CatalogDraftConfig) {
  const selection = effectiveDraftSelection(source, config);
  if (!selection) return null;
  let selectedSource = source;
  if (config.excludeNoImage) {
    const initial = buildCatalogDocument(source, { selection, presentation: { grouping: config.grouping, showPrices: config.showPrices } });
    const allowed = new Set(initial.products.filter((p) => p.primaryImage || p.additionalImages.length).map((p) => p.id));
    selectedSource = { ...source, products: source.products.filter((p) => allowed.has(p.id)) };
    if (selection.productIds) selection.productIds = selection.productIds.filter((id) => allowed.has(id));
    if (!allowed.size) return null;
  }
  return buildCatalogDocument(selectedSource, { selection, presentation: { grouping: config.grouping, showPrices: config.showPrices } });
}

export function draftEditorialInput(doc: NonNullable<ReturnType<typeof buildDraftDocument>>, c: CatalogDraftConfig): EditorialConfigInput {
  return {
    cover: { title: c.title, subtitle: c.subtitle, imageUrl: c.coverMode === "custom" ? c.coverImage || null : null, showYear: c.showYear, showCount: c.showCount, typography: c.typography as CoverTypographyInput },
    institutional: c.instEnabled ? { enabled: true, title: c.instTitle, text: c.instText, useStoreAbout: false, imageUrl: c.instMode === "custom" ? c.instImage || null : null } : undefined,
    commercial: c.comEnabled ? { enabled: true, ...c.com } : undefined,
    separators: c.separators, sectionImages: sectionImagesInDocument(doc, Object.fromEntries(Object.entries(c.sectionImages).filter(([id]) => c.sectionCustom[id] !== false))),
    featured: c.featEnabled ? { productIds: featuredInDocument(doc, c.featured), policy: c.featPolicy } : undefined,
    backCover: { imageUrl: c.backMode === "custom" ? c.backImage || null : null, typography: c.backTypography as BackTypographyInput },
  };
}