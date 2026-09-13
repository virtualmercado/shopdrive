import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { resolveCatalogShareCode, isValidShareCode } from "@/lib/catalogShareLink";

type State = "loading" | "unavailable" | "not_found";

/**
 * Public route /catalogo/:shareCode.
 *
 * Resolves the permanent share code to the owning store's current catalog and
 * redirects to the stored file. The destination always comes from backend
 * records — never from a query parameter — so there is no open redirect.
 */
const CatalogShareRedirect = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [state, setState] = useState<State>("loading");
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isValidShareCode(shareCode)) {
        setState("not_found");
        return;
      }

      const resolved = await resolveCatalogShareCode(shareCode as string);
      if (cancelled) return;

      if (!resolved) {
        setState("not_found");
        return;
      }

      setStoreName(resolved.store_name ?? null);
      setStoreSlug(resolved.store_slug ?? null);

      if (!resolved.catalog_url) {
        setState("unavailable");
        return;
      }

      // Temporary redirect semantics: the current catalog can change.
      window.location.replace(resolved.catalog_url);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [shareCode]);

  if (state === "loading") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Abrindo catálogo...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-foreground">
        {state === "unavailable" ? "Este catálogo ainda não está disponível." : "Catálogo indisponível"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {state === "unavailable"
          ? `${storeName ? `${storeName} ainda não publicou` : "Esta loja ainda não publicou"} um catálogo. Tente novamente mais tarde.`
          : "O link que você abriu não corresponde a nenhum catálogo."}
      </p>
      {storeSlug && (
        <Link to={`/${storeSlug}`} className="text-sm font-medium underline text-primary">
          Visitar a loja
        </Link>
      )}
    </main>
  );
};

export default CatalogShareRedirect;
