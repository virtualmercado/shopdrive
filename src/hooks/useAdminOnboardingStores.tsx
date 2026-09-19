import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OnboardingAdminFilter =
  | "all"
  | "ready"
  | "incomplete"
  | "in_progress"
  | "never_started"
  | "recovery_pending";

export interface AdminOnboardingRow {
  store_id: string;
  store_name: string | null;
  store_slug: string | null;
  email: string | null;
  created_at: string | null;
  last_activity: string | null;
  account_status: string | null;
  classification: string;
  progress_percent: number;
  current_step: string | null;
  onboarding_required: boolean;
  onboarding_completed: boolean;
  onboarding_source: string | null;
  manual_exempt: boolean;
  activation_readiness: "READY" | "NOT_READY";
  ai_image_enabled: boolean;
  ai_generations_24h: number;
  ai_last_generation_at: string | null;
  ai_last_error: string | null;
  metrics: {
    active_products?: number;
    categories?: number;
    has_logo?: boolean;
    has_banner?: boolean;
    orders?: number;
  };
}

export const useAdminOnboardingStores = (filter: OnboardingAdminFilter, search: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-onboarding-stores", filter, search],
    queryFn: async (): Promise<AdminOnboardingRow[]> => {
      const { data: states, error } = await supabase
        .from("store_onboarding_state")
        .select("*")
        .order("progress_percent", { ascending: true })
        .limit(1000);
      if (error) throw error;

      const ids = (states ?? []).map((s) => s.store_id);
      const profileMap = new Map<string, any>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, store_name, store_slug, email, created_at, last_activity, account_status")
          .in("id", ids);
        (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
      }

      // Métricas reais de IA nas últimas 24h (logs, nunca estimativas)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const aiMap = new Map<string, { count: number; last: string | null; error: string | null }>();
      if (ids.length) {
        const { data: logs } = await supabase
          .from("ai_media_generation_logs")
          .select("store_id, status, error_message, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1000);
        (logs ?? []).forEach((l: any) => {
          const entry = aiMap.get(l.store_id) ?? { count: 0, last: null, error: null };
          entry.count += 1;
          if (!entry.last) entry.last = l.created_at;
          if (!entry.error && l.status === "error") entry.error = l.error_message ?? "erro";
          aiMap.set(l.store_id, entry);
        });
      }

      let rows: AdminOnboardingRow[] = (states ?? []).map((s: any) => {
        const p = profileMap.get(s.store_id) ?? {};
        const ai = aiMap.get(s.store_id);
        return {
          store_id: s.store_id,
          store_name: p.store_name ?? null,
          store_slug: p.store_slug ?? null,
          email: p.email ?? null,
          created_at: p.created_at ?? null,
          last_activity: p.last_activity ?? null,
          account_status: p.account_status ?? null,
          classification: s.classification,
          progress_percent: s.progress_percent ?? 0,
          current_step: s.current_step,
          onboarding_required: !!s.onboarding_required,
          onboarding_completed: !!s.onboarding_completed,
          onboarding_source: s.onboarding_source,
          manual_exempt: !!s.manual_exempt,
          metrics: (s.completion_snapshot?.metrics ?? {}) as AdminOnboardingRow["metrics"],
        };
      });

      rows = rows.filter((r) => {
        switch (filter) {
          case "ready":
            return r.classification === "STORE_READY";
          case "incomplete":
            return !r.onboarding_completed;
          case "in_progress":
            return !r.onboarding_completed && r.progress_percent > 0;
          case "never_started":
            return r.progress_percent === 0;
          case "recovery_pending":
            return r.classification === "STORE_RECOVERY_REQUIRED";
          default:
            return true;
        }
      });

      const term = search.trim().toLowerCase();
      if (term) {
        rows = rows.filter(
          (r) =>
            (r.store_name ?? "").toLowerCase().includes(term) ||
            (r.store_slug ?? "").toLowerCase().includes(term) ||
            (r.email ?? "").toLowerCase().includes(term)
        );
      }

      return rows;
    },
  });

  const recompute = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase.rpc("recompute_store_onboarding_state", { p_store_id: storeId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-onboarding-stores"] }),
  });

  const setExempt = useMutation({
    mutationFn: async ({ storeId, exempt }: { storeId: string; exempt: boolean }) => {
      const { error } = await supabase.rpc("admin_set_onboarding_exempt", {
        p_store_id: storeId,
        p_exempt: exempt,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-onboarding-stores"] }),
  });

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
    recompute: recompute.mutateAsync,
    setExempt: setExempt.mutateAsync,
  };
};
