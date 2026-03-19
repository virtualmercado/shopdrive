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

export const useMerchantPlan = (): UseMerchantPlanReturn => {
  const { user, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<MerchantPlan>('free');
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  const templateMode = isInTemplateEditorMode();

  const fetchPlanAndCounts = async () => {
    if (!user) {
      setPlan('free');
      setProductCount(0);
      setCustomerCount(0);
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription, product count, and customer count in parallel
      const [subResult, productResult, customerResult] = await Promise.all([
        supabase
          .from('master_subscriptions')
          .select('plan_id, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('store_customers')
          .select('id', { count: 'exact', head: true })
          .eq('store_owner_id', user.id),
      ]);

      // Determine plan
      const sub = subResult.data;
      if (sub && (sub.status === 'active' || sub.status === 'past_due')) {
        setPlan(getPlanFromPlanId(sub.plan_id));
      } else {
        setPlan('free');
      }

      setProductCount(productResult.count ?? 0);
      setCustomerCount(customerResult.count ?? 0);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching merchant plan:', error);
      setPlan('free');
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
    canAddProduct: isWithinLimit(productCount, limits.maxProducts),
    canAddCustomer: isWithinLimit(customerCount, limits.maxCustomers),
    refetch: fetchPlanAndCounts,
  };
};
