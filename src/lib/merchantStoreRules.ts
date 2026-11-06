export const isStoreUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Only these migrated merchant screens may mount under delegated administration. */
export const delegatedMerchantRouteAllowed = (path: string) => [
  "/lojista", "/lojista/products", "/lojista/orders", "/lojista/customers", "/lojista/store",
  "/lojista/customize", "/lojista/payment-methods", "/lojista/financeiro", "/lojista/minha-rede",
].includes(path);

export interface ManagedStore {
  storeId: string;
  storeName: string;
  storeSlug: string;
  publicUrl: string;
  status: string;
  storeRole: string | null;
  plan: string;
  paidUntil: string | null;
}

export function parseManagedStore(value: unknown): ManagedStore {
  if (!value || typeof value !== "object") throw new Error("store_context_invalid");
  const row = value as Record<string, unknown>;
  if (!isStoreUuid(row.storeId) || typeof row.storeName !== "string" || typeof row.storeSlug !== "string" || typeof row.publicUrl !== "string" || typeof row.plan !== "string") throw new Error("store_context_invalid");
  const url = new URL(row.publicUrl);
  if (url.protocol !== "https:") throw new Error("store_context_invalid");
  return {
    storeId: row.storeId, storeName: row.storeName, storeSlug: row.storeSlug, publicUrl: row.publicUrl,
    status: typeof row.status === "string" ? row.status : "active",
    storeRole: typeof row.storeRole === "string" ? row.storeRole : null,
    plan: row.plan, paidUntil: typeof row.paidUntil === "string" ? row.paidUntil : null,
  };
}