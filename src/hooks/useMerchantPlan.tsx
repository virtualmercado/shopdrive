import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MerchantPlan, getPlanFromPlanId, getPlanLimits, PlanLimits, isWithinLimit } from '@/lib/planLimits';

/** 
 * Template editor mode: all features unlocked but product/customer limits
 * match the FREE plan, since activated templates become free accounts.
 */
const TEMPLATE_OVERRIDE_LIMITS: PlanLimits = {
  maxProducts: 20,
  maxCustomers: 40,
  canCustomizeLogo: true,
  canCustomizeColors: true,
  canUseCustomDomain: true,
  canUseImageEditor: true,
  canUseMarketing: true,
  canUseCoupons: true,
  canUseWhatsAppSupport: true,
  canUseReviews: true,
};

/** Detect template-editor mode from URL + localStorage (same logic as useTemplateEditorMode) */
function isInTemplateEditorMode(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'template-editor' && params.get('templateId')) return true;
    const stored = localStorage.getItem('templateEditorContext');
    if (stored) {
      const ctx = JSON.parse(stored);
      if (ctx?.mode === 'template-editor' && ctx?.templateId) return true;
    }
  } catch { /* ignore */ }
  return false;
}

interface UseMerchantPlanReturn {
  plan: MerchantPlan;
  limits: PlanLimits;
  loading: boolean;
  productCount: number;
  customerCount: number;
  canAddProduct: boolean;
  canAddCustomer: boolean;
  refetch: () => Promise<void>;
}

interface ProductPlanUsageResponse {
  plan?: string;
  productLimit?: number | null;
  unlimited?: boolean;
  totalProducts?: number;
  activeProducts?: number;
  remainingActivations?: number | null;
  canActivateMore?: boolean;
}

export const useMerchantPlan = (): UseMerchantPlanReturn => {
  const { user, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<MerchantPlan>('unknown');
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  const templateMode = isInTemplateEditorMode();

  const fetchPlanAndCounts = async () => {
    if (!user) {
      setPlan('unknown');
      setProductCount(0);
      setCustomerCount(0);
      setLoading(false);
      return;
    }

    try {
      const [usageResult, customerResult] = await Promise.all([
        (supabase.rpc as any)('get_product_plan_usage', { p_store_id: user.id }),
        supabase
          .from('store_customers')
          .select('id', { count: 'exact', head: true })
          .eq('store_owner_id', user.id),
      ]);

      if (usageResult.error) throw usageResult.error;

      const usage = usageResult.data as ProductPlanUsageResponse | null;
      if (usage?.plan) {
        setPlan(getPlanFromPlanId(usage.plan));
        setProductCount(Number(usage.activeProducts ?? 0));
      } else {
        setPlan('unknown');
        setProductCount(0);
      }
      setCustomerCount(customerResult.count ?? 0);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching merchant plan:', error);
      setPlan('unknown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchPlanAndCounts();
    }
  }, [user, authLoading]);

  // In template editor mode, override ALL limits to fully unlocked
  const limits = templateMode ? TEMPLATE_OVERRIDE_LIMITS : getPlanLimits(plan);

  return {
    plan: templateMode ? 'free' : plan,
    limits,
    loading: loading || authLoading,
    productCount,
    customerCount,
    canAddProduct: (loading || authLoading) ? true : isWithinLimit(productCount, limits.maxProducts),
    canAddCustomer: isWithinLimit(customerCount, limits.maxCustomers),
    refetch: fetchPlanAndCounts,
  };
};
