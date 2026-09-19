import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OnboardingFlagKey =
  | "ENABLE_STORE_ONBOARDING"
  | "ENABLE_ONBOARDING_BLOCKING"
  | "ENABLE_AI_IMAGE_GENERATION"
  | "ENABLE_RECOVERY_FOR_EXISTING_INCOMPLETE";

export type OnboardingFlags = Record<OnboardingFlagKey, boolean>;

const DEFAULTS: OnboardingFlags = {
  ENABLE_STORE_ONBOARDING: false,
  ENABLE_ONBOARDING_BLOCKING: false,
  ENABLE_AI_IMAGE_GENERATION: false,
  ENABLE_RECOVERY_FOR_EXISTING_INCOMPLETE: false,
};

export const useOnboardingFlags = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-feature-flags"],
    staleTime: 60_000,
    queryFn: async (): Promise<OnboardingFlags> => {
      const { data, error } = await supabase
        .from("onboarding_feature_flags")
        .select("flag_key, enabled");
      if (error) return DEFAULTS;
      const flags = { ...DEFAULTS };
      (data ?? []).forEach((row) => {
        if (row.flag_key in flags) {
          flags[row.flag_key as OnboardingFlagKey] = !!row.enabled;
        }
      });
      return flags;
    },
  });

  return { flags: data ?? DEFAULTS, loading: isLoading };
};
