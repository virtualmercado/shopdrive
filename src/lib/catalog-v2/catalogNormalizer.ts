import { htmlToCatalogText, buildCatalogProductUrl, buildCatalogStoreUrl } from "@/lib/catalogPdfClassic";
import { getPromotionDiscountPercent, hasValidPromotionalPrice } from "@/lib/promotionCountdown";
import type {
  CatalogIdentity,
  CatalogImageRef,
  CatalogPrice,
  CatalogProduct,
  CatalogVariant,
  RawProductRow,
  RawStoreProfile,
} from "./types";

const money = (amount: number) => ({ amount: Number(amount) || 0, currency: "BRL" as const });
const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const num = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);

export const normalizePrice = (price: number, promotional: number | null): CatalogPrice => {
  const valid = hasValidPromotionalPrice(price, promotional);
  return {
    regular: money(price),
    promotional: valid ? money(promotional as number) : null,
    effective: money(valid ? (promotional as number) : price),
    discountPercent: valid ? getPromotionDiscountPercent(price, promotional) : null,
  };
};

/** Junta imagem principal + galeria, sem duplicar URLs. */
export const normalizeImages = (
  imageUrl: string | null,
  legacyImages: unknown,
  gallery: { image_url: string; display_order: number | null }[] = [],
): { primary: CatalogImageRef | null; additional: CatalogImageRef[] } => {
  const urls: string[] = [];
  const push = (u: unknown) => {
    if (typeof u === "string" && u.trim() && !urls.includes(u.trim())) urls.push(u.trim());
  };
  push(imageUrl);
  [...gallery]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .forEach((g) => push(g.image_url));
  if (Array.isArray(legacyImages)) legacyImages.forEach(push);
  const refs = urls.map((url, order) => ({ url, order }));
  return { primary: refs[0] ?? null, additional: refs.slice(1) };
};

export const deriveSummary = (plain: string) => {
  const first = plain.split(/\n{2,}/)[0]?.trim();
  return first ? { text: first.length > 280 ? `${first.slice(0, 277).trimEnd()}…` : first, derived: true as const } : null;
};

export const normalizeProduct = (
  raw: RawProductRow,
  storeSlug: string | null,
  gallery: { image_url: string; display_order: number | null }[] = [],
  variants: CatalogVariant[] = [],
): CatalogProduct => {
  const plain = htmlToCatalogText(raw.description);
  const images = normalizeImages(raw.image_url, raw.images, gallery);
  const isVariant = raw.inventory_mode === "variant";
  return {
    id: raw.id,
    name: (raw.name || "").trim(),
    price: normalizePrice(raw.price, raw.promotional_price),
    primaryImage: images.primary,
    additionalImages: images.additional,
    description: {
      originalHtml: clean(raw.description),
      plainText: plain,
      summary: deriveSummary(plain),
      benefits: null,
    },
    categoryId: raw.category_id ?? null,
    brandId: raw.brand_id ?? null,
    sku: null,
    dimensions: {
      weight: num(raw.weight),
      shippingWeight: num(raw.shipping_weight),
      height: num(raw.height),
      width: num(raw.width),
      length: num(raw.length),
    },
    inventoryMode: isVariant ? "variant" : "simple",
    variants: isVariant ? variants : [],
    publicUrl: storeSlug ? buildCatalogProductUrl(storeSlug, raw.id) : null,
    isActive: true,
    isFeatured: !!raw.is_featured,
    isNew: !!raw.is_new,
    createdAt: raw.created_at,
  };
};

export const normalizeIdentity = (p: RawStoreProfile): CatalogIdentity => {
  const street = [clean(p.address), clean(p.address_number)].filter(Boolean).join(", ");
  const city = [clean(p.address_city), clean(p.address_state)].filter(Boolean).join(" - ");
  const address = [street, clean(p.address_neighborhood), city].filter(Boolean).join(" · ") || null;
  const aboutText = htmlToCatalogText(p.about_us_text);
  const slug = clean(p.store_slug);
  return {
    storeName: clean(p.store_name) ?? "Minha loja",
    logoUrl: clean(p.store_logo_url),
    colors: {
      primary: clean(p.primary_color),
      secondary: clean(p.secondary_color),
      buttonBg: clean(p.button_bg_color),
      buttonText: clean(p.button_text_color),
      price: clean(p.price_color),
    },
    publicUrl: slug ? buildCatalogStoreUrl(slug) : null,
    storeSlug: slug,
    whatsapp: clean(p.whatsapp_number),
    email: clean(p.email),
    social: {
      instagram: clean(p.instagram_url),
      facebook: clean(p.facebook_url),
      youtube: clean(p.youtube_url),
      x: clean(p.x_url),
    },
    about: aboutText ? { title: clean(p.about_us_title), text: aboutText } : null,
    address,
  };
};
