import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { adaptStoreInternalLink, buildStorePath, effectiveStoreSlug, initialStoreRuntime, resolveStoreRuntime, type PublicStoreIdentity } from "@/lib/publicStoreRuntime";

const PublicStoreContext = createContext<PublicStoreIdentity | undefined>(undefined);

export function PublicStoreRuntime({ children }: { children: ReactNode }) {
  const hostname = window.location.hostname;
  const [resolved, setResolved] = useState(() => initialStoreRuntime(hostname));
  // A changed host never renders a previous host's tenant, even before effects.
  const initial = initialStoreRuntime(hostname);
  const identity = resolved.hostname === initial.hostname ? resolved : initial;

  useEffect(() => {
    let active = true;
    if (initialStoreRuntime(hostname).mode === "platform") return;
    void resolveStoreRuntime(hostname, async (normalized) => {
      const { data, error } = await supabase.rpc("resolve_public_store_by_domain", { p_hostname: normalized });
      return { data, error };
    }).then((result) => { if (active) setResolved(result); });
    return () => { active = false; };
  }, [hostname]);

  if (identity.mode !== "platform" && identity.mode !== "custom-domain") {
    return <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      {identity.mode === "custom-domain-loading"
        ? <p role="status" className="text-muted-foreground">Carregando loja…</p>
        : <h1 className="text-xl text-center">Esta loja não está disponível neste domínio.</h1>}
    </main>;
  }
  return <PublicStoreContext.Provider key={identity.hostname} value={identity}>{children}</PublicStoreContext.Provider>;
}

export function usePublicStoreIdentity() {
  const runtime = useContext(PublicStoreContext) ?? initialStoreRuntime(window.location.hostname);
  const params = useParams<{ storeSlug?: string }>();
  const location = useLocation();
  let legacySearchSlug: string | undefined;
  if (runtime.mode === "platform" && location.pathname === "/buscar") {
    try { legacySearchSlug = (location.state as { storeSlug?: string } | null)?.storeSlug || sessionStorage.getItem("vm_active_store_slug") || undefined; } catch { /* storage unavailable */ }
  }
  return {
    ...runtime,
    storeSlug: effectiveStoreSlug(runtime, params.storeSlug, legacySearchSlug),
    isLoading: runtime.mode === "custom-domain-loading",
    isCustomDomain: runtime.mode === "custom-domain",
  };
}

export function useStorePath(platformStoreSlug?: string) {
  const identity = usePublicStoreIdentity();
  const effective = { ...identity, storeSlug: identity.isCustomDomain ? identity.storeSlug : platformStoreSlug || identity.storeSlug };
  return (path = "/") => buildStorePath(effective, path);
}

export function useStoreInternalLink() {
  const identity = usePublicStoreIdentity();
  return (url: string) => adaptStoreInternalLink(identity, url);
}