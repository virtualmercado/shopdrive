import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoleCheck } from "@/hooks/useRoleCheck";

/** Chave opcional na tabela de flags existente; enabled=false oculta o Editorial imediatamente. */
export const EDITORIAL_KILL_SWITCH_KEY = "ENABLE_CATALOG_EDITORIAL_V2";

/**
 * Liberação controlada da Fase 5A (homologação):
 * - somente contas com papel admin no banco (user_roles, protegido por RLS);
 * - desligável pela flag existente sem afetar o Clássico.
 * Não lê URL nem armazenamento local. Os dados continuam protegidos pelo RLS.
 */
export const useEditorialCatalogAccess = () => {
  const { hasRole, loading } = useRoleCheck();
  const isAdmin = !loading && hasRole("admin");
  const { data: killed, isLoading } = useQuery({
    queryKey: ["catalog-editorial-flag"],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_feature_flags")
        .select("enabled")
        .eq("flag_key", EDITORIAL_KILL_SWITCH_KEY)
        .maybeSingle();
      if (error) return true; // falha ao consultar: fail-safe, oculta.
      return data ? !data.enabled : false;
    },
  });
  return { allowed: isAdmin && !isLoading && killed === false, loading: loading || (isAdmin && isLoading) };
};
