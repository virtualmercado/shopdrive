import { normalizeIdentity, normalizeProduct } from "./catalogNormalizer";
import {
  CATALOG_SCHEMA_VERSION,
  UNBRANDED_KEY,
  UNCATEGORIZED_KEY,
  type CatalogDocument,
  type CatalogGrouping,
  type CatalogOutputConfig,
  type CatalogPresentationConfig,
  type CatalogProduct,
  type CatalogSection,
  type CatalogSelection,
  type CatalogSort,
  type CatalogSource,
} from "./types";

export class CatalogSelectionError extends Error {
  constructor(public readonly foreignIds: string[]) {
    super(`IDs fora da loja autorizada: ${foreignIds.join(", ")}`);
    this.name = "CatalogSelectionError";
  }
}

export const DEFAULT_PRESENTATION: CatalogPresentationConfig = {
  templateId: null,
  style: null,
  colorOverrides: null,
  density: null,
  showPrices: true,
  grouping: "none",
  institutionalPages: false,
  featuredPages: false,
  backCover: true,
};

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const byId = (a: CatalogProduct, b: CatalogProduct) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const sortProducts = (list: CatalogProduct[], sort: CatalogSort): CatalogProduct[] => {
  const cmp: Record<CatalogSort, (a: CatalogProduct, b: CatalogProduct) => number> = {
    name_asc: (a, b) => collator.compare(a.name, b.name),
    name_desc: (a, b) => collator.compare(b.name, a.name),
    price_asc: (a, b) => a.price.effective.amount - b.price.effective.amount,
    price_desc: (a, b) => b.price.effective.amount - a.price.effective.amount,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  };
  // Desempate por nome e id garante ordem determinística.
  return [...list].sort((a, b) => cmp[sort](a, b) || collator.compare(a.name, b.name) || byId(a, b));
};

/** Recusa IDs de produtos/categorias/marcas que não pertencem à loja. */
export const assertSelectionOwned = (source: CatalogSource, sel: CatalogSelection) => {
  const own = (rows: { id: string; user_id: string }[]) =>
    new Set(rows.filter((r) => r.user_id === source.storeId).map((r) => r.id));
  const products = own(source.products);
  const cats = own(source.categories);
  const brands = own(source.brands);
  const foreign = [
    ...(sel.productIds ?? []).filter((id) => !products.has(id)),
    ...(sel.categoryIds ?? []).filter((id) => id !== UNCATEGORIZED_KEY && !cats.has(id)),
    ...(sel.brandIds ?? []).filter((id) => id !== UNBRANDED_KEY && !brands.has(id)),
  ];
  if (foreign.length) throw new CatalogSelectionError(foreign);
};

const matches = (ids: string[] | undefined, value: string | null, emptyKey: string) =>
  !ids || ids.length === 0 || ids.includes(value ?? emptyKey);

export const buildSections = (
  products: CatalogProduct[],
  grouping: CatalogGrouping,
  categories: CatalogDocument["categories"],
  brands: CatalogDocument["brands"],
): CatalogSection[] => {
  if (grouping === "none") {
    return [{ id: "all", title: "Todos os produtos", subtitle: null, kind: "all", refId: null, productIds: products.map((p) => p.id), featuredImage: products[0]?.primaryImage ?? null }];
  }
  const key = grouping === "category" ? "categoryId" : "brandId";
  const refs = grouping === "category" ? categories : brands;
  const emptyTitle = grouping === "category" ? "Sem categoria" : "Sem marca";
  const emptyKey = grouping === "category" ? UNCATEGORIZED_KEY : UNBRANDED_KEY;
  const known = new Set(refs.map((r) => r.id));
  const buckets = new Map<string, CatalogProduct[]>();
  products.forEach((p) => {
    const ref = p[key];
    const k = ref && known.has(ref) ? ref : emptyKey;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(p);
  });
  const ordered = [...refs].sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1));
  const sections: CatalogSection[] = [];
  ordered.forEach((r) => {
    const list = buckets.get(r.id);
    if (list?.length) sections.push({ id: `${grouping}:${r.id}`, title: r.name, subtitle: null, kind: grouping, refId: r.id, productIds: list.map((p) => p.id), featuredImage: list[0].primaryImage });
  });
  const rest = buckets.get(emptyKey);
  if (rest?.length) sections.push({ id: `${grouping}:${emptyKey}`, title: emptyTitle, subtitle: null, kind: grouping, refId: null, productIds: rest.map((p) => p.id), featuredImage: rest[0].primaryImage });
  return sections;
};

export interface BuildCatalogOptions {
  selection?: CatalogSelection;
  sort?: CatalogSort;
  presentation?: Partial<CatalogPresentationConfig>;
  output?: Partial<CatalogOutputConfig>;
  now?: Date;
}

export const buildCatalogDocument = (source: CatalogSource, opts: BuildCatalogOptions = {}): CatalogDocument => {
  const selection = opts.selection ?? {};
  const sort = opts.sort ?? "name_asc";
  const presentation = { ...DEFAULT_PRESENTATION, ...opts.presentation };
  assertSelectionOwned(source, selection);

  const identity = normalizeIdentity(source.profile);
  const categories = source.categories
    .filter((c) => c.user_id === source.storeId)
    .map((c) => ({ id: c.id, name: c.name.trim(), iconUrl: c.icon_url ?? null }));
  const brands = source.brands
    .filter((b) => b.user_id === source.storeId)
    .map((b) => ({ id: b.id, name: b.name.trim(), logoUrl: b.logo_url ?? null }));

  const seen = new Set<string>();
  const manual = selection.productIds?.length ? new Set(selection.productIds) : null;
  const products = source.products
    .filter((r) => r.user_id === source.storeId && r.is_active === true)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .filter((r) => !manual || manual.has(r.id))
    .filter((r) => matches(selection.categoryIds, r.category_id, UNCATEGORIZED_KEY))
    .filter((r) => matches(selection.brandIds, r.brand_id, UNBRANDED_KEY))
    .map((r) => normalizeProduct(r, identity.storeSlug, source.galleryByProduct[r.id], source.variantsByProduct[r.id]));

  const sorted = sortProducts(products, sort);
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    storeId: source.storeId,
    identity,
    selection,
    sort,
    products: sorted,
    categories,
    brands,
    sections: buildSections(sorted, presentation.grouping, categories, brands),
    presentation,
    output: { quality: "standard", ...opts.output },
    meta: { generatedAt: (opts.now ?? new Date()).toISOString(), productCount: sorted.length, source: "catalog-v2" },
  };
};
