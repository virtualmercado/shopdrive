// Preferred public store URL: single frontend authority, backed by the
// server-side resolve_store_preferred_hostname RPC (migration 0062).
// The custom hostname always comes from the store's own authorized V2 binding;
// visitor-supplied slugs, query params or storage never choose a domain.

const CUSTOM_HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/;

export function isValidCustomStoreHostname(hostname: unknown): hostname is string {
  return typeof hostname === "string" && CUSTOM_HOSTNAME_RE.test(hostname);
}

/**
 * Public URL shown in the merchant panel and sharing surfaces.
 * Falls back to the traditional ShopDrive URL whenever no active V2 domain exists.
 */
export function preferredStoreUrl(origin: string, storeSlug: string, customHostname?: string | null): string {
  if (isValidCustomStoreHostname(customHostname)) return `https://${customHostname}`;
  return `${origin}/${storeSlug}`;
}

/**
 * Temporary/reversible redirect target for visits to the traditional
 * ShopDrive store URL while a custom V2 domain is active.
 * Preserves the sub-path after the slug plus query string and hash:
 *   /minha-loja/produto/123?x=1 -> https://www.dominio.com.br/produto/123?x=1
 * Returns null (fail-closed) on any ambiguity: invalid hostname, path outside
 * the store slug, protocol-relative remnants or control characters.
 */
export function customDomainRedirectUrl(
  customHostname: unknown,
  storeSlug: string,
  pathname: string,
  search = "",
  hash = "",
): string | null {
  if (!isValidCustomStoreHostname(customHostname)) return null;
  if (!storeSlug || !pathname.startsWith("/")) return null;
  const prefix = `/${storeSlug}`;
  let rest: string;
  if (pathname === prefix) rest = "/";
  else if (pathname.startsWith(`${prefix}/`)) rest = pathname.slice(prefix.length);
  else return null;
  if (!rest.startsWith("/") || rest.startsWith("//") || /[\\\u0000-\u0020]/.test(rest)) return null;
  const safeSearch = search.startsWith("?") && !/[\\\u0000-\u0020]/.test(search) ? search : "";
  const safeHash = hash.startsWith("#") && !/[\\\u0000-\u0020]/.test(hash) ? hash : "";
  return `https://${customHostname}${rest}${safeSearch}${safeHash}`;
}
