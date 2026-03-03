import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MerchantPlan, getPlanFromPlanId, getPlanLimits, PlanLimits, isWithinLimit } from '@/lib/planLimits';

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

  const limits = getPlanLimits(plan);

  return {
    plan,
    limits,
    loading: loading || authLoading,
    productCount,
    customerCount,
    canAddProduct: isWithinLimit(productCount, limits.maxProducts),
    canAddCustomer: isWithinLimit(customerCount, limits.maxCustomers),
    refetch: fetchPlanAndCounts,
  };
};
