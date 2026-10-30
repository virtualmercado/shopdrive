import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isValidCustomStoreHostname, preferredStoreUrl } from "@/lib/preferredStoreUrl";

/**
 * Resolves the store's preferred public URL through the server-side
 * resolve_store_preferred_hostname RPC (fail-closed: errors and inactive
 * domains fall back to the traditional ShopDrive URL).
 */
export function usePreferredStoreUrl(storeSlug?: string | null) {
  const slug = storeSlug?.trim() || null;
  const query = useQuery({
    queryKey: ["preferred-store-hostname", slug],
    enabled: !!slug,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_store_preferred_hostname", { p_store_slug: slug! });
      if (error) return null; // fail-closed: keep the ShopDrive URL
      return typeof data === "string" && isValidCustomStoreHostname(data) ? data : null;
    },
  });

  const customHostname = query.data ?? null;
  return {
    url: slug ? preferredStoreUrl(window.location.origin, slug, customHostname) : "",
    customHostname,
    isCustomDomain: !!customHostname,
    isLoading: !!slug && query.isLoading,
  };
}
