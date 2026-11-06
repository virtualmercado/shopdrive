import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useMerchantStore } from "@/hooks/useMerchantStore";

export const ONBOARDING_STEPS = [
  { key: "company", label: "Empresa" },
  { key: "visual", label: "Identidade visual" },
  { key: "contacts", label: "Contatos" },
  { key: "banner", label: "Banner principal" },
  { key: "categories", label: "Categorias" },
  { key: "products", label: "Produtos" },
] as const;

export interface StoreOnboardingState {
  store_id: string;
  classification: string;
  current_step: string | null;
  last_completed_step: string | null;
  progress_percent: number;
  onboarding_required: boolean;
  onboarding_completed: boolean;
  onboarding_source: string | null;
  steps_status: Record<string, { done?: boolean; weight?: number; score?: number }> | null;
  completion_snapshot: Record<string, unknown> | null;
  business_context?: string | null;
  brand_profile?: Record<string, unknown> | null;
  context_hash?: string | null;
  brand_status?: string | null;
  recommended_palette_id?: string | null;
  recommended_layout_id?: string | null;
  applied_palette_id?: string | null;
  applied_layout_id?: string | null;
  identity_applications_count?: number | null;
}

/** Estado de onboarding da loja do usuário logado (isolado por auth.uid via RLS). */
export const useStoreOnboarding = () => {
  const { storeId, actorId, delegated, client: supabase } = useMerchantStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["store-onboarding", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<StoreOnboardingState | null> => {
      if (!storeId) return null;
      const { data, error } = await supabase
        .from("store_onboarding_state")
        .select("*")
        .eq("store_id", storeId ?? "")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as StoreOnboardingState) ?? null;
    },
  });

  const recompute = useMutation({
    mutationFn: async () => {
      if (!storeId) return null;
      const { data, error } = await supabase.rpc("recompute_store_onboarding_state", {
        p_store_id: storeId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-onboarding", storeId] });
    },
  });

  const logEvent = async (eventType: string, step?: string) => {
    if (!storeId || delegated) return;
    await supabase.from("store_onboarding_events").insert({
      store_id: storeId,
      user_id: actorId,
      event_type: eventType,
      step: step ?? null,
    });
  };

  return {
    state: query.data ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
    recompute: recompute.mutateAsync,
    recomputing: recompute.isPending,
    logEvent,
  };
};
