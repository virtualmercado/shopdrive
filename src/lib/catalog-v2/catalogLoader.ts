import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogSource, CatalogVariant, RawProductRow, RawStoreProfile } from "./types";

const PAGE = 1000;
const IN_CHUNK = 200;

const PRODUCT_COLUMNS =
  "id, user_id, name, description, price, promotional_price, image_url, images, category_id, brand_id, inventory_mode, is_active, is_featured, is_new, weight, shipping_weight, height, width, length, created_at";
const PROFILE_COLUMNS =
  "id, store_name, store_slug, store_logo_url, primary_color, secondary_color, button_bg_color, button_text_color, price_color, whatsapp_number, email, instagram_url, facebook_url, youtube_url, x_url, about_us_title, about_us_text, address, address_number, address_neighborhood, address_city, address_state";

type AnyClient = SupabaseClient<any, any, any>;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const chunks = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/**
 * Carrega os dados da loja autorizada. Todas as consultas filtram pelo dono
 * (RLS também protege). Somente leitura; imagens ficam como referência.
 */
export async function loadCatalogSource(client: AnyClient, storeId: string): Promise<CatalogSource> {
  const { data: auth } = await client.auth.getUser();
  if (!auth?.user || auth.user.id !== storeId) throw new Error("Loja não autorizada para este usuário");

  const [profileRes, products, categories, brands] = await Promise.all([
    client.from("profiles").select(PROFILE_COLUMNS).eq("id", storeId).single(),
    fetchAll<RawProductRow>((a, b) =>
      client.from("products").select(PRODUCT_COLUMNS).eq("user_id", storeId).eq("is_active", true).order("id").range(a, b),
    ),
    fetchAll<any>((a, b) => client.from("product_categories").select("id, user_id, name, icon_url").eq("user_id", storeId).order("id").range(a, b)),
    fetchAll<any>((a, b) => client.from("product_brands").select("id, user_id, name, logo_url").eq("user_id", storeId).order("id").range(a, b)),
  ]);
  if (profileRes.error) throw profileRes.error;

  const ids = products.map((p) => p.id);
  const variantIds = products.filter((p) => p.inventory_mode === "variant").map((p) => p.id);
  const galleryByProduct: CatalogSource["galleryByProduct"] = {};
  const variantsByProduct: Record<string, CatalogVariant[]> = {};

  for (const part of chunks(ids, IN_CHUNK)) {
    const rows = await fetchAll<any>((a, b) =>
      client.from("product_images").select("product_id, image_url, display_order").in("product_id", part).order("id").range(a, b),
    );
    rows.forEach((r) => (galleryByProduct[r.product_id] ??= []).push({ image_url: r.image_url, display_order: r.display_order }));
  }

  for (const part of chunks(variantIds, IN_CHUNK)) {
    const [groups, values, variants] = await Promise.all([
      fetchAll<any>((a, b) => client.from("product_option_groups").select("id, name").in("product_id", part).is("archived_at", null).order("id").range(a, b)),
      fetchAll<any>((a, b) => client.from("product_option_values").select("id, option_group_id, value").in("product_id", part).is("archived_at", null).order("id").range(a, b)),
      fetchAll<any>((a, b) => client.from("product_variants").select("id, product_id, sku, option_value_ids, active, seq").eq("store_id", storeId).in("product_id", part).is("archived_at", null).order("seq").range(a, b)),
    ]);
    const groupName = new Map(groups.map((g) => [g.id, g.name as string]));
    const valueMap = new Map(values.map((v) => [v.id, { group: groupName.get(v.option_group_id) ?? "", value: v.value as string }]));
    variants.forEach((v) =>
      (variantsByProduct[v.product_id] ??= []).push({
        id: v.id,
        sku: v.sku,
        active: !!v.active,
        options: (v.option_value_ids as string[]).map((id) => valueMap.get(id)).filter(Boolean) as CatalogVariant["options"],
      }),
    );
  }

  return {
    storeId,
    profile: profileRes.data as unknown as RawStoreProfile,
    products,
    categories,
    brands,
    galleryByProduct,
    variantsByProduct,
  };
}
