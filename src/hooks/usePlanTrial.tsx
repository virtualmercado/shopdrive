import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PlanTrial {
  id: string;
  store_id: string;
  base_plan: string;
  trial_plan: string;
  started_at: string;
  ends_at: string;
  status: "active" | "expired" | "cancelled" | "converted";
  reason: string | null;
  ended_at: string | null;
  end_reason: string | null;
  converted_plan: string | null;
  granted_by: string | null;
}

export interface PlanTrialState {
  trial: PlanTrial | null;
  /** Timestamp is the source of truth: an active row past ends_at is NOT valid. */
  isActive: boolean;
  /** Trial finished (expired/cancelled/converted, or active row already past ends_at). */
  justEnded: boolean;
}

const RECENTLY_ENDED_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export const resolveTrialState = (trial: PlanTrial | null): PlanTrialState => {
  if (!trial) return { trial: null, isActive: false, justEnded: false };

  const endsAt = new Date(trial.ends_at).getTime();
  const isActive = trial.status === "active" && endsAt > Date.now();

  const endedAt = trial.ended_at ? new Date(trial.ended_at).getTime() : endsAt;
  const justEnded =
    !isActive &&
    trial.status !== "converted" &&
    Date.now() - endedAt < RECENTLY_ENDED_WINDOW_MS;

  return { trial, isActive, justEnded };
};

/** Latest plan trial for the signed-in merchant (read-only). */
export const usePlanTrial = () => {
  const { user } = useAuth();

  return useQuery<PlanTrialState>({
    queryKey: ["plan-trial", user?.id],
    enabled: !!user,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user) return { trial: null, isActive: false, justEnded: false };

      const { data, error } = await supabase
        .from("plan_trials")
        .select("*")
        .eq("store_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) console.error("Error fetching plan trial:", error);
        return { trial: null, isActive: false, justEnded: false };
      }

      return resolveTrialState((data as PlanTrial | null) ?? null);
    },
  });
};
