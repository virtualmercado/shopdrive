export type MerchantPlan = 'free' | 'pro' | 'premium';

export interface PlanLimits {
  maxProducts: number | null; // null = unlimited
  maxCustomers: number | null;
  canCustomizeLogo: boolean;
  canCustomizeColors: boolean;
  canUseCustomDomain: boolean;
  canUseImageEditor: boolean;
  canUseMarketing: boolean;
  canUseCoupons: boolean;
  canUseWhatsAppSupport: boolean;
  canUseReviews: boolean;
}

export const PLAN_LIMITS: Record<MerchantPlan, PlanLimits> = {
  free: {
    maxProducts: 20,
    maxCustomers: 40,
    canCustomizeLogo: false,
    canCustomizeColors: false,
    canUseCustomDomain: false,
    canUseImageEditor: false,
    canUseMarketing: false,
    canUseCoupons: false,
    canUseWhatsAppSupport: false,
    canUseReviews: false,
  },
  pro: {
    maxProducts: 150,
    maxCustomers: 300,
    canCustomizeLogo: true,
    canCustomizeColors: true,
    canUseCustomDomain: false,
    canUseImageEditor: false,
    canUseMarketing: true,
    canUseCoupons: true,
    canUseWhatsAppSupport: false,
    canUseReviews: true,
  },
  premium: {
    maxProducts: null,
    maxCustomers: null,
    canCustomizeLogo: true,
    canCustomizeColors: true,
    canUseCustomDomain: true,
    canUseImageEditor: true,
    canUseMarketing: true,
    canUseCoupons: true,
    canUseWhatsAppSupport: true,
    canUseReviews: true,
  },
};

export const PLAN_DISPLAY_NAMES: Record<MerchantPlan, string> = {
  free: 'Grátis',
  pro: 'Pro',
  premium: 'Premium',
};

export function getPlanFromPlanId(planId: string | null | undefined): MerchantPlan {
  if (!planId) return 'free';
  const normalized = planId.toLowerCase().trim();
  if (normalized === 'premium') return 'premium';
  if (normalized === 'pro') return 'pro';
  return 'free';
}

export function getPlanLimits(plan: MerchantPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function isWithinLimit(current: number, limit: number | null): boolean {
  if (limit === null) return true;
  return current < limit;
}
