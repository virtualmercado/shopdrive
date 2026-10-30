import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isValidCustomStoreHostname, preferredStoreUrl } from "@/lib/preferredStoreUrl";

/**
 * Server-side resolution of the store's active custom V2 hostname.
 * Fail-closed: any error or inactive state returns null (ShopDrive URL fallback).
 * The hostname always comes from the store's own authorized V2 binding.
 */
export async function fetchPreferredStoreHostname(storeSlug: string): Promise<string | null> {
  // RPC created by migration 0062; the generated types entry lands when the
  // migration workflow regenerates types.ts, so the call is typed loosely here.
  // Must stay bound to the client: a detached `supabase.rpc` throws and silently disables the feature.
  const { data, error } = await supabase.rpc("resolve_store_preferred_hostname", { p_store_slug: storeSlug });
  if (error) return null;
  return typeof data === "string" && isValidCustomStoreHostname(data) ? data : null;
}

export const preferredStoreHostnameQueryKey = (storeSlug: string) => ["preferred-store-hostname", storeSlug] as const;

/**
 * Resolves the store's preferred public URL for panel display and sharing.
 */
export function usePreferredStoreUrl(storeSlug?: string | null) {
  const slug = storeSlug?.trim() || null;
  const query = useQuery({
    queryKey: preferredStoreHostnameQueryKey(slug ?? ""),
    enabled: !!slug,
    staleTime: 60_000,
    queryFn: () => fetchPreferredStoreHostname(slug!),
  });

  const customHostname = query.data ?? null;
  return {
    url: slug ? preferredStoreUrl(window.location.origin, slug, customHostname) : "",
    customHostname,
    isCustomDomain: !!customHostname,
    isLoading: !!slug && query.isLoading,
  };
}
