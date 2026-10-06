import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoleCheck } from "@/hooks/useRoleCheck";
import { useAuthContext } from "@/contexts/AuthContext";

/** Flag global na tabela existente. Só libera com enabled=true explícito; ausente/desligada/erro = oculto. */
export const EDITORIAL_KILL_SWITCH_KEY = "ENABLE_CATALOG_EDITORIAL_V2";

/**
 * Liberação controlada da Fase 5A (homologação):
 * - somente contas com papel admin no banco (user_roles, protegido por RLS);
 * - E flag global explicitamente ligada; desligar oculta sem afetar o Clássico.
 * - A loja carregada é sempre a da sessão (loader recusa outro storeId).
 * Não lê URL nem armazenamento local. Os dados continuam protegidos pelo RLS.
 */
export const useEditorialCatalogAccess = () => {
  const { hasRole, loading } = useRoleCheck();
  const { storeSlug } = useAuthContext();
  // Admin sem loja própria (sem store_slug) nunca vê o Editorial.
  const isAdmin = !loading && hasRole("admin") && !!storeSlug;
  const { data: enabled, isLoading } = useQuery({
    queryKey: ["catalog-editorial-flag"],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_feature_flags")
        .select("enabled")
        .eq("flag_key", EDITORIAL_KILL_SWITCH_KEY)
        .maybeSingle();
      if (error || !data) return false; // erro ou flag ausente: fail-safe, oculta.
      return data.enabled === true;
    },
  });
  return { allowed: isAdmin && !isLoading && enabled === true, loading: loading || (isAdmin && isLoading) };
};
