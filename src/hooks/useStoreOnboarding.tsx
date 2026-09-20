import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["store-onboarding", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<StoreOnboardingState | null> => {
      const { data, error } = await supabase
        .from("store_onboarding_state")
        .select("*")
        .eq("store_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as StoreOnboardingState) ?? null;
    },
  });

  const recompute = useMutation({
    mutationFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("recompute_store_onboarding_state", {
        p_store_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-onboarding", user?.id] });
    },
  });

  const logEvent = async (eventType: string, step?: string) => {
    if (!user?.id) return;
    await supabase.from("store_onboarding_events").insert({
      store_id: user.id,
      user_id: user.id,
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
