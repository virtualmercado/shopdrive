import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

/** Flag global na tabela existente. Só libera com enabled=true explícito; ausente/desligada/erro = oculto. */
export const EDITORIAL_KILL_SWITCH_KEY = "ENABLE_CATALOG_EDITORIAL_V2";

/**
 * Fase 5C.2: a decisão é do servidor (get_my_catalog_editorial_access):
 * flag global ligada + loja liberada individualmente pelo Master + loja própria ativa.
 * Não depende de papel admin. Erro ou resposta inesperada = oculto (Clássico intacto).
 * A publicação revalida a mesma regra no servidor.
 */
export const useEditorialCatalogAccess = () => {
  const { user, storeSlug } = useAuthContext();
  const canAsk = !!user && !!storeSlug;
  const { data, isLoading } = useQuery({
    queryKey: ["catalog-editorial-access", user?.id],
    enabled: canAsk,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_catalog_editorial_access");
      if (error) return false;
      return data === true;
    },
  });
  return { allowed: canAsk && !isLoading && data === true, loading: canAsk && isLoading };
};
