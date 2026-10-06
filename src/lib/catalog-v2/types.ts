/**
 * Catálogo PDF 2.0 — contratos de dados (Fase 2).
 * Modelo puro e serializável: sem DOM, React ou jsPDF.
 */

export const CATALOG_SCHEMA_VERSION = 1 as const;

export const UNBRANDED_KEY = "__sem_marca__";
export const UNCATEGORIZED_KEY = "__sem_categoria__";

export interface CatalogMoney {
  /** Valor numérico em BRL, nunca formatado. */
  amount: number;
  currency: "BRL";
}

export interface CatalogPrice {
  regular: CatalogMoney;
  /** Só presente quando promocional > 0 e < preço regular. */
  promotional: CatalogMoney | null;
  /** Preço a exibir (promocional válido ou regular). */
  effective: CatalogMoney;
  discountPercent: number | null;
}

export interface CatalogImageRef {
  /** URL de origem (sem download/base64 nesta fase). */
  url: string;
  order: number;
}

export interface CatalogVariant {
  id: string;
  sku: string;
  /** Ex.: [{ group: "Tamanho", value: "M" }] */
  options: { group: string; value: string }[];
  active: boolean;
}

export interface CatalogDimensions {
  /** Unidades preservadas como cadastradas no painel (sem conversão). */
  weight: number | null;
  shippingWeight: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
}

export interface CatalogProductDescription {
  /** HTML original armazenado (nunca executado). */
  originalHtml: string | null;
  /** Texto legível derivado com a limpeza da Fase 1. */
  plainText: string;
  /** Resumo derivado: primeiro parágrafo do texto. Marcado como derivado. */
  summary: { text: string; derived: true } | null;
  /** Não existe campo estruturado; nunca inventado. */
  benefits: string[] | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: CatalogPrice;
  primaryImage: CatalogImageRef | null;
  additionalImages: CatalogImageRef[];
  description: CatalogProductDescription;
  categoryId: string | null;
  brandId: string | null;
  /** Produtos simples não têm SKU no schema atual; variações sim. */
  sku: string | null;
  dimensions: CatalogDimensions;
  inventoryMode: "simple" | "variant";
  variants: CatalogVariant[];
  publicUrl: string | null;
  isActive: true;
  isFeatured: boolean;
  isNew: boolean;
  createdAt: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface CatalogBrand {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface CatalogSocialLinks {
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  x: string | null;
}

export interface CatalogIdentity {
  storeName: string;
  logoUrl: string | null;
  colors: {
    primary: string | null;
    secondary: string | null;
    buttonBg: string | null;
    buttonText: string | null;
    price: string | null;
  };
  publicUrl: string | null;
  storeSlug: string | null;
  whatsapp: string | null;
  email: string | null;
  social: CatalogSocialLinks;
  about: { title: string | null; text: string } | null;
  address: string | null;
}

export type CatalogGrouping = "none" | "category" | "brand";

export interface CatalogSection {
  id: string;
  title: string;
  subtitle: string | null;
  kind: "all" | "category" | "brand";
  /** ID real da categoria/marca; null para "sem categoria/marca" ou "all". */
  refId: string | null;
  productIds: string[];
  featuredImage: CatalogImageRef | null;
}

export type CatalogSort = "name_asc" | "name_desc" | "price_asc" | "price_desc" | "newest" | "oldest";

export interface CatalogSelection {
  /** Vazio/indefinido = todas. Use UNCATEGORIZED_KEY para "sem categoria". */
  categoryIds?: string[];
  /** Vazio/indefinido = todas. Use UNBRANDED_KEY para "sem marca". */
  brandIds?: string[];
  /** Quando definido, só esses produtos (seleção manual). */
  productIds?: string[];
}

export interface CatalogPresentationConfig {
  templateId: string | null;
  style: string | null;
  colorOverrides: Partial<CatalogIdentity["colors"]> | null;
  density: number | null;
  showPrices: boolean;
  grouping: CatalogGrouping;
  institutionalPages: boolean;
  featuredPages: boolean;
  backCover: boolean;
}

export interface CatalogOutputConfig {
  quality: "screen" | "standard" | "print";
}

export interface CatalogDocument {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  storeId: string;
  identity: CatalogIdentity;
  selection: CatalogSelection;
  sort: CatalogSort;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  sections: CatalogSection[];
  presentation: CatalogPresentationConfig;
  output: CatalogOutputConfig;
  meta: { generatedAt: string; productCount: number; source: "catalog-v2" };
}

/** Linhas cruas do banco usadas pelo normalizador (subconjunto do schema real). */
export interface RawProductRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: unknown;
  category_id: string | null;
  brand_id: string | null;
  inventory_mode: string;
  is_active: boolean;
  is_featured: boolean | null;
  is_new: boolean | null;
  weight: number | null;
  shipping_weight: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
  created_at: string;
}

export interface RawStoreProfile {
  id: string;
  store_name: string | null;
  store_slug: string | null;
  store_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  button_bg_color: string | null;
  button_text_color: string | null;
  price_color: string | null;
  whatsapp_number: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  about_us_title: string | null;
  about_us_text: string | null;
  address: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
}

export interface CatalogSource {
  storeId: string;
  profile: RawStoreProfile;
  products: RawProductRow[];
  categories: { id: string; user_id: string; name: string; icon_url: string | null }[];
  brands: { id: string; user_id: string; name: string; logo_url: string | null }[];
  galleryByProduct: Record<string, { image_url: string; display_order: number | null }[]>;
  variantsByProduct: Record<string, CatalogVariant[]>;
}
