import { isReservedSlug } from "@/lib/reservedSlugs";

// Published/local hosts stay exact; preview infrastructure is classified separately.
export const PLATFORM_HOSTS = [
  "shopdrive.com.br", "www.shopdrive.com.br", "virtualmercado.lovable.app",
  "localhost", "127.0.0.1", "[::1]",
] as const;

// This is the verified project identity, not an ephemeral shared-preview identifier.
const PROJECT_RUNTIME_PREVIEW_HOST = "9f6c1d8d-8e82-428c-a496-b3fa1dba56be.lovableproject.com";
const LOVABLE_SHARED_PREVIEW_HOST = /^id-preview--[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.lovable\.app$/;

export type PublicStoreMode = "platform" | "custom-domain-loading" | "custom-domain" | "custom-domain-not-found" | "custom-domain-error";
export interface PublicStoreIdentity {
  mode: PublicStoreMode;
  hostname: string;
  storeId?: string;
  storeSlug?: string;
}

export function normalizeRuntimeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export function isTrustedLovablePreviewHost(hostname: string): boolean {
  const normalized = normalizeRuntimeHostname(hostname);
  // Do not trust arbitrary Lovable subdomains, other project origins or visitor flags.
  return normalized === PROJECT_RUNTIME_PREVIEW_HOST || LOVABLE_SHARED_PREVIEW_HOST.test(normalized);
}

export function isPlatformHost(hostname: string): boolean {
  return (PLATFORM_HOSTS as readonly string[]).includes(normalizeRuntimeHostname(hostname)) || isTrustedLovablePreviewHost(hostname);
}

export function initialStoreRuntime(hostname: string): PublicStoreIdentity {
  const normalized = normalizeRuntimeHostname(hostname);
  return { hostname: normalized, mode: isPlatformHost(normalized) ? "platform" : "custom-domain-loading" };
}

export async function resolveStoreRuntime(
  hostname: string,
  resolve: (hostname: string) => Promise<{ data: unknown; error: unknown }>,
): Promise<PublicStoreIdentity> {
  const initial = initialStoreRuntime(hostname);
  if (initial.mode === "platform") return initial;
  // Browser hostname only, never a URL, port, path or user-provided upstream.
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(initial.hostname)) {
    return { ...initial, mode: "custom-domain-not-found" };
  }
  try {
    const { data, error } = await resolve(initial.hostname);
    if (error) return { ...initial, mode: "custom-domain-error" };
    if (Array.isArray(data) && data.length === 0) return { ...initial, mode: "custom-domain-not-found" };
    if (!Array.isArray(data) || data.length !== 1) return { ...initial, mode: "custom-domain-error" };
    const row = data[0];
    if (!row || typeof row !== "object" ||
        typeof row.store_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.store_id) ||
        typeof row.store_slug !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(row.store_slug) || isReservedSlug(row.store_slug)) {
      return { ...initial, mode: "custom-domain-error" };
    }
    return { ...initial, mode: "custom-domain", storeId: row.store_id, storeSlug: row.store_slug };
  } catch {
    return { ...initial, mode: "custom-domain-error" };
  }
}

export function effectiveStoreSlug(identity: PublicStoreIdentity, routeSlug?: string, legacySearchSlug?: string): string | undefined {
  return identity.mode === "platform" ? routeSlug || legacySearchSlug : identity.mode === "custom-domain" ? identity.storeSlug : undefined;
}

export function buildStorePath(identity: Pick<PublicStoreIdentity, "mode" | "storeSlug">, path = "/"): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) return path;
  if (identity.mode !== "platform" && identity.mode !== "custom-domain") return "#";
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (identity.mode === "custom-domain") return suffix;
  if (!identity.storeSlug) return "#";
  // Legacy search is platform-rooted, not /:slug/buscar.
  if (/^\/buscar(?:[?#]|$)/.test(suffix)) return suffix;
  return `/${identity.storeSlug}${suffix === "/" ? "" : suffix}`;
}

// Only known storefront routes are valid authentication navigation intents.
export function isCustomStorePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u0020]/.test(path)) return false;
  const pathname = path.split(/[?#]/)[0];
  if (/^\/$/.test(pathname) || /^\/(?:produtos|promocoes|checkout|buscar|auth|conta|sobre-nos|trocas-e-devolucoes)\/?$/.test(pathname)) return true;
  const match = /^\/(?:produto|categoria|marca|pedido-confirmado)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return false;
  try {
    const segment = decodeURIComponent(match[1]);
    return !!segment && segment !== "." && segment !== ".." && !/[/%\\\u0000-\u0020]/.test(segment);
  } catch { return false; }
}

export function storeContentPath(identity: Pick<PublicStoreIdentity, "mode" | "storeSlug">, target: string): string {
  // Preserve configured legacy destinations on platform; custom hosts expose only existing store pages.
  const platformPages: Record<string, string> = { sobre: "/sobre", trocas: "/trocas", contato: "/contato", termos: "/termos", privacidade: "/privacidade" };
  const customPages: Record<string, string> = { sobre: "/sobre-nos", trocas: "/trocas-e-devolucoes" };
  return buildStorePath(identity, (identity.mode === "custom-domain" ? customPages : platformPages)[target] || "/");
}

export function storeAuthRedirect(identity: Pick<PublicStoreIdentity, "mode" | "storeSlug">, requested: string | null): string {
  const fallback = buildStorePath(identity, "/conta");
  if (!requested) return fallback;
  if (identity.mode === "custom-domain") return isCustomStorePath(requested) ? requested : fallback;
  return identity.storeSlug && requested.startsWith(`/${identity.storeSlug}/`) ? requested : fallback;
}

export function adaptStoreInternalLink(identity: Pick<PublicStoreIdentity, "mode" | "storeSlug">, url: string): string {
  if (identity.mode !== "custom-domain" || !url.startsWith("/") || url.startsWith("//")) return url;
  const prefix = `/${identity.storeSlug}`;
  // Relative own-store legacy CTA only; deliberately external URLs are untouched.
  if (url === prefix) return "/";
  if (url.startsWith(`${prefix}?`) || url.startsWith(`${prefix}#`)) return `/${url.slice(prefix.length)}`;
  if (url.startsWith(`${prefix}/`)) {
    const stripped = url.slice(prefix.length);
    return isCustomStorePath(stripped) ? stripped : url;
  }
  return url;
}