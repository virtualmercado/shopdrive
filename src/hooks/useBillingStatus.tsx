import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type BillingStatus = 
  | "active" 
  | "past_due" 
  | "in_grace_period" 
  | "processing" 
  | "downgraded" 
  | "suspended"
  | "cancelled";

export interface BillingAlertContent {
  alert_key: string;
  title: string;
  message: string;
  cta_text: string;
  cta_url: string;
}

export interface BillingInfo {
  status: BillingStatus;
  billingCycle: "monthly" | "annual";
  planId: string;
  planName: string;
  gracePeriodEndsAt: string | null;
  daysRemaining: number;
  previousPlanId: string | null;
  downgradeReason: string | null;
  requiresCardUpdate: boolean;
  noCharge: boolean;
}

export interface BillingSettings {
  enabled: boolean;
  gracePeriodDaysMonthly: number;
  gracePeriodDaysAnnual: number;
  maxCompensationHours: number;
}

const calculateDaysRemaining = (gracePeriodEndsAt: string | null): number => {
  if (!gracePeriodEndsAt) return 0;
  const endDate = new Date(gracePeriodEndsAt);
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const mapStatusToBillingStatus = (status: string, gracePeriodEndsAt: string | null, previousPlanId: string | null): BillingStatus => {
  // Check if downgraded
  if (status === "active" && previousPlanId) {
    return "downgraded";
  }
  
  // Check if in grace period
  if (status === "past_due" && gracePeriodEndsAt) {
    const daysRemaining = calculateDaysRemaining(gracePeriodEndsAt);
    if (daysRemaining > 0) {
      return "in_grace_period";
    }
  }
  
  // Check if processing (pending payment)
  if (status === "pending" || status === "payment_pending") {
    return "processing";
  }
  
  // Map direct statuses
  if (status === "past_due" || status === "payment_failed") {
    return "past_due";
  }
  
  if (status === "suspended") {
    return "suspended";
  }
  
  if (status === "cancelled") {
    return "cancelled";
  }
  
  return "active";
};

const getPlanName = (planId: string): string => {
  const planNames: Record<string, string> = {
    gratis: "Grátis",
    pro: "PRO",
    premium: "Premium",
    free: "Grátis",
  };
  return planNames[planId?.toLowerCase()] || planId;
};

export const useBillingStatus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["billing-status", user?.id],
    queryFn: async (): Promise<BillingInfo | null> => {
      if (!user) return null;

      // Fetch subscription data
      const { data: subscription, error } = await supabase
        .from("master_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching billing status:", error);
        return null;
      }

      if (!subscription) {
        return null;
      }

      // Skip alert for no_charge accounts
      if (subscription.no_charge) {
        return {
          status: "active",
          billingCycle: subscription.billing_cycle as "monthly" | "annual",
          planId: subscription.plan_id,
          planName: getPlanName(subscription.plan_id),
          gracePeriodEndsAt: null,
          daysRemaining: 0,
          previousPlanId: null,
          downgradeReason: null,
          requiresCardUpdate: false,
          noCharge: true,
        };
      }

      const gracePeriodEndsAt = subscription.grace_period_ends_at;
      const daysRemaining = calculateDaysRemaining(gracePeriodEndsAt);
      const billingStatus = mapStatusToBillingStatus(
        subscription.status, 
        gracePeriodEndsAt,
        subscription.previous_plan_id
      );

      return {
        status: billingStatus,
        billingCycle: subscription.billing_cycle as "monthly" | "annual",
        planId: subscription.plan_id,
        planName: getPlanName(subscription.plan_id),
        gracePeriodEndsAt,
        daysRemaining,
        previousPlanId: subscription.previous_plan_id || null,
        downgradeReason: subscription.downgrade_reason || null,
        requiresCardUpdate: subscription.requires_card_update || false,
        noCharge: subscription.no_charge || false,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
};

export const useBillingAlertContent = () => {
  return useQuery({
    queryKey: ["billing-alert-content"],
    queryFn: async (): Promise<Record<string, BillingAlertContent>> => {
      const { data, error } = await supabase
        .from("cms_billing_alerts")
        .select("*")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching billing alert content:", error);
        return {};
      }

      const contentMap: Record<string, BillingAlertContent> = {};
      data?.forEach((item: any) => {
        contentMap[item.alert_key] = {
          alert_key: item.alert_key,
          title: item.title,
          message: item.message,
          cta_text: item.cta_text,
          cta_url: item.cta_url,
        };
      });

      return contentMap;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useBillingSettings = () => {
  return useQuery({
    queryKey: ["billing-alert-settings"],
    queryFn: async (): Promise<BillingSettings> => {
      const { data, error } = await supabase
        .from("billing_alert_settings")
        .select("*");

      if (error) {
        console.error("Error fetching billing settings:", error);
        return {
          enabled: true,
          gracePeriodDaysMonthly: 7,
          gracePeriodDaysAnnual: 14,
          maxCompensationHours: 48,
        };
      }

      const settings: Record<string, string> = {};
      data?.forEach((item: any) => {
        settings[item.setting_key] = item.setting_value;
      });

      return {
        enabled: settings.enabled !== "false",
        gracePeriodDaysMonthly: parseInt(settings.grace_period_days_monthly || "7", 10),
        gracePeriodDaysAnnual: parseInt(settings.grace_period_days_annual || "14", 10),
        maxCompensationHours: parseInt(settings.max_compensation_hours || "48", 10),
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};
