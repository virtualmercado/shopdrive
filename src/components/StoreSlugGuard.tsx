import { useEffect } from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { isReservedSlug } from "@/lib/reservedSlugs";
import { normalizeRuntimeHostname } from "@/lib/publicStoreRuntime";
import { customDomainRedirectUrl } from "@/lib/preferredStoreUrl";
import { fetchPreferredStoreHostname, preferredStoreHostnameQueryKey } from "@/hooks/usePreferredStoreUrl";
import NotFound from "@/pages/NotFound";
import { PublicStoreErrorBoundary } from "@/components/store/PublicStoreErrorBoundary";

interface StoreSlugGuardProps {
  children: React.ReactNode;
}

// Only the exact published platform hosts redirect visitors to the store's
// active custom domain. Preview/local hosts never redirect, so storefront
// testing on the traditional URL keeps working there.
const REDIRECT_PLATFORM_HOSTS = ["shopdrive.com.br", "www.shopdrive.com.br"];

/**
 * Temporary/reversible redirect (window.location.replace, never 301) from the
 * traditional ShopDrive store URL to the store's active custom V2 domain,
 * preserving sub-path, query string and hash. Fail-closed: while resolving,
 * on error, or without an active domain, the traditional URL renders normally.
 * Never mounts on custom-domain hosts (HostRoutes renders CustomDomainRoutes
 * there), so redirect loops are impossible.
 */
const CustomDomainPreferredRedirect = ({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) => {
  const location = useLocation();
  const shouldCheck = REDIRECT_PLATFORM_HOSTS.includes(normalizeRuntimeHostname(window.location.hostname));
  const query = useQuery({
    queryKey: preferredStoreHostnameQueryKey(storeSlug),
    enabled: shouldCheck,
    staleTime: 60_000,
    queryFn: () => fetchPreferredStoreHostname(storeSlug),
  });

  const target = query.data
    ? customDomainRedirectUrl(query.data, storeSlug, location.pathname, location.search, location.hash)
    : null;

  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);

  if (shouldCheck && (query.isLoading || target)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Redirecionando para o domínio da loja" />
      </main>
    );
  }
  return <>{children}</>;
};

/**
 * Guards short store URLs (/:storeSlug, /:storeSlug/...) against
 * collisions with reserved platform paths. If the slug matches a
 * reserved keyword, render NotFound instead of trying to load a store.
 *
 * Also wraps the public store content in an error boundary so an
 * unexpected render exception shows a controlled page instead of a
 * completely blank document.
 */
export const StoreSlugGuard = ({ children }: StoreSlugGuardProps) => {
  const { storeSlug } = useParams<{ storeSlug: string }>();

  if (isReservedSlug(storeSlug)) {
    return <NotFound />;
  }

  return (
    <PublicStoreErrorBoundary storeSlug={storeSlug}>
      {storeSlug ? (
        <CustomDomainPreferredRedirect storeSlug={storeSlug}>{children}</CustomDomainPreferredRedirect>
      ) : (
        children
      )}
    </PublicStoreErrorBoundary>
  );
};


/**
 * Permanent redirect from the legacy /loja/:storeSlug/* prefix to the
 * short URL /:storeSlug/*, preserving sub-paths and query strings.
 */
export const LegacyStoreRedirect = () => {
  const location = useLocation();
  const stripped = location.pathname.replace(/^\/loja\/?/, "/");
  const target = `${stripped}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
};
