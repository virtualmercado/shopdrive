import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical, short, public catalog links.
 *
 * The physical PDF stays in storage; the shareable address is a ShopDrive
 * route (/catalogo/:shareCode) that resolves share code -> store -> current
 * catalog. The share code is permanent per store, so links stay valid when a
 * new catalog is generated or the store slug changes.
 */

export const CATALOG_SHARE_CODE_PATTERN = /^[A-Za-z0-9]{11}$/;

const CANONICAL_HOST = "shopdrive.com.br";

export const isValidShareCode = (code: string | undefined | null): boolean =>
  !!code && CATALOG_SHARE_CODE_PATTERN.test(code);

/**
 * Public origin used in shared links. On the production domain (and any
 * environment served from it) we use the canonical ShopDrive domain; anywhere
 * else (preview/dev) we keep the current origin so links remain testable.
 */
export const getPublicOrigin = (): string => {
  if (typeof window === "undefined") return `https://${CANONICAL_HOST}`;
  const host = window.location.hostname;
  if (host === CANONICAL_HOST || host.endsWith(`.${CANONICAL_HOST}`)) {
    return `https://${CANONICAL_HOST}`;
  }
  return window.location.origin;
};

export const buildCanonicalCatalogUrl = (shareCode: string): string =>
  `${getPublicOrigin()}/catalogo/${shareCode}`;

export const buildStoreUrl = (storeSlug: string | null | undefined): string =>
  storeSlug ? `${getPublicOrigin()}/${storeSlug}` : "";

/** Returns the caller's own permanent share code, creating it on first use. */
export const ensureCatalogShareCode = async (): Promise<string | null> => {
  const { data, error } = await supabase.rpc("ensure_catalog_share_code");
  if (error || !data || !isValidShareCode(data as string)) {
    if (import.meta.env.DEV) console.error("ensure_catalog_share_code failed", error);
    return null;
  }
  return data as string;
};

/** Records the newly generated catalog as the store's current catalog. */
export const setCurrentCatalog = async (path: string, url: string): Promise<boolean> => {
  const { error } = await supabase.rpc("set_current_catalog", { _path: path, _url: url });
  if (error && import.meta.env.DEV) console.error("set_current_catalog failed", error);
  return !error;
};

export interface ResolvedCatalog {
  store_slug: string | null;
  store_name: string | null;
  catalog_url: string | null;
  catalog_updated_at: string | null;
}

/** Public resolution used by the /catalogo/:shareCode route. */
export const resolveCatalogShareCode = async (code: string): Promise<ResolvedCatalog | null> => {
  if (!isValidShareCode(code)) return null;
  const { data, error } = await supabase.rpc("resolve_catalog_share_code", { _code: code });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as ResolvedCatalog;
};

export interface CampaignMessageParts {
  editableText: string;
  catalogUrl: string;
  storeUrl: string;
  whatsappDisplay: string;
  closingText?: string;
}

export const DEFAULT_CAMPAIGN_TEXT =
  "Olá! 😊\n\nPreparamos nosso catálogo atualizado com vários produtos disponíveis.";

export const DEFAULT_CAMPAIGN_CLOSING = "Esperamos seu pedido!";

/**
 * Single source of truth for the shared message. Structural blocks (catalog
 * link, store link, WhatsApp) are always rebuilt from platform data — they are
 * never taken from merchant-typed text.
 */
export const composeCampaignMessage = ({
  editableText,
  catalogUrl,
  storeUrl,
  whatsappDisplay,
  closingText = DEFAULT_CAMPAIGN_CLOSING,
}: CampaignMessageParts): string => {
  let msg = editableText.trim();
  if (catalogUrl) msg += `\n\n📄 Veja o catálogo completo:\n${catalogUrl}`;
  if (storeUrl) msg += `\n\n🛒 Visite nossa loja:\n${storeUrl}`;
  if (whatsappDisplay) msg += `\n\n📲 Fale conosco no WhatsApp:\n${whatsappDisplay}`;
  if (closingText) msg += `\n\n${closingText}`;
  return msg;
};
