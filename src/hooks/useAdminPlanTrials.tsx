import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlanTrial } from "@/hooks/usePlanTrial";

export interface AdminTrialInfo {
  active: PlanTrial | null;
  history: PlanTrial[];
}

/**
 * Admin view of plan trials for the listed stores.
 * Timestamp is the source of truth: rows past ends_at are not treated as active.
 */
export const useAdminPlanTrials = (storeIds: string[]) => {
  const key = [...storeIds].sort().join(",");

  return useQuery<Record<string, AdminTrialInfo>>({
    queryKey: ["admin-plan-trials", key],
    enabled: storeIds.length > 0,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_trials")
        .select("*")
        .in("store_id", storeIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const map: Record<string, AdminTrialInfo> = {};
      (data as PlanTrial[] | null)?.forEach((trial) => {
        const entry = (map[trial.store_id] ??= { active: null, history: [] });
        entry.history.push(trial);
        const valid = trial.status === "active" && new Date(trial.ends_at).getTime() > Date.now();
        if (valid && !entry.active) entry.active = trial;
      });

      return map;
    },
  });
};

export const trialDaysLeft = (endsAt: string): number => {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
