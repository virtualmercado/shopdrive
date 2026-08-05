import { useParams, Navigate, useLocation } from "react-router-dom";
import { isReservedSlug } from "@/lib/reservedSlugs";
import NotFound from "@/pages/NotFound";
import { PublicStoreErrorBoundary } from "@/components/store/PublicStoreErrorBoundary";

interface StoreSlugGuardProps {
  children: React.ReactNode;
}

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
      {children}
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
