export type MerchantPlan = 'unknown' | 'free' | 'pro' | 'premium' | 'marca';

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
  /** MARCA-only capabilities (declarative in this phase — nothing consumes them yet). */
  brandNetworkAccess: boolean;
  brandReports: boolean;
  brandTemplatesLimit: number; // 0 = none
  ownedStoreLimit: number; // stores owned by the account (1 = current behavior)
}

const NO_BRAND = {
  brandNetworkAccess: false,
  brandReports: false,
  brandTemplatesLimit: 0,
  ownedStoreLimit: 1,
} as const;

const PREMIUM_LIMITS: PlanLimits = {
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
  ...NO_BRAND,
};

export const PLAN_LIMITS: Record<MerchantPlan, PlanLimits> = {
  unknown: {
    maxProducts: null,
    maxCustomers: null,
    canCustomizeLogo: false,
    canCustomizeColors: false,
    canUseCustomDomain: false,
    canUseImageEditor: false,
    canUseMarketing: false,
    canUseCoupons: false,
    canUseWhatsAppSupport: false,
    canUseReviews: false,
    ...NO_BRAND,
  },
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
    ...NO_BRAND,
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
    ...NO_BRAND,
  },
  premium: PREMIUM_LIMITS,
  // MARCA = everything Premium has + brand capabilities.
  marca: {
    ...PREMIUM_LIMITS,
    brandNetworkAccess: true,
    brandReports: true,
    brandTemplatesLimit: 2,
    ownedStoreLimit: 2,
  },
};

export const PLAN_DISPLAY_NAMES: Record<MerchantPlan, string> = {
  unknown: 'Carregando',
  free: 'Grátis',
  pro: 'Pro',
  premium: 'Premium',
  marca: 'MARCA',
};

const KNOWN_FREE_ALIASES = new Set(['free', 'gratis', 'grátis']);

export function getPlanFromPlanId(planId: string | null | undefined): MerchantPlan {
  if (!planId) return 'unknown';
  const normalized = planId.toLowerCase().trim();
  if (normalized === 'marca') return 'marca';
  if (normalized === 'premium') return 'premium';
  if (normalized === 'pro') return 'pro';
  if (!KNOWN_FREE_ALIASES.has(normalized)) {
    // Legacy-compatible fallback to free, but never silently.
    console.warn('UNKNOWN_PLAN_CODE', { value: planId, at: new Date().toISOString() });
  }
  return 'free';
}

export function getPlanLimits(plan: MerchantPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export type PlanSource = 'direct' | 'brand_inherited' | 'free_fallback';
export type OwnedStoreRole = 'primary' | 'secondary' | null;

/**
 * Entitlements por contexto. A loja adicional (secondary) herda os recursos
 * operacionais do MARCA, mas nunca a autoridade empresarial (Minha Rede,
 * templates, relatórios, gestão das lojas próprias). O backend futuro de
 * Minha Rede deve validar auth.uid() = brand_accounts.owner_profile_id.
 */
export function resolveStoreEntitlements(
  plan: MerchantPlan,
  planSource?: PlanSource | string | null,
  ownedStoreRole?: OwnedStoreRole | string | null,
): PlanLimits {
  const base = PLAN_LIMITS[plan];
  if (planSource === 'brand_inherited' || ownedStoreRole === 'secondary') {
    return { ...base, ...NO_BRAND, ownedStoreLimit: 0 };
  }
  return base;
}

export function isWithinLimit(current: number, limit: number | null): boolean {
  if (limit === null) return true;
  return current < limit;
}
