import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  NETWORK_PAGE_SIZE,
  type NetworkActivation,
  type NetworkActivationsPage,
  type NetworkDashboard,
  type PeriodRange,
} from '@/lib/brandNetwork';

const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);
const STALE = 5 * 60_000;

/** Leitura da flag existente ENABLE_PLAN_MARCA (fail-safe false). */
export const usePlanMarcaFlag = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['plan-marca-flag', user?.id],
    enabled: !!user,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await rpc('is_plan_marca_enabled');
      if (error) return false;
      return data === true;
    },
  });
};

/** Menu: só aparece com flag ligada e fora de loja secondary. */
export const useMinhaRedeMenuVisible = () => {
  const { user } = useAuth();
  const flag = usePlanMarcaFlag();
  const ctx = useQuery({
    queryKey: ['minha-rede-menu-ctx', user?.id],
    enabled: !!user && flag.data === true,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await rpc('get_product_plan_usage', { p_store_id: user!.id });
      if (error) throw error;
      return data as { planSource?: string | null; ownedStoreRole?: string | null } | null;
    },
  });
  if (flag.data !== true || !ctx.data) return false;
  return !(ctx.data.ownedStoreRole === 'secondary' || ctx.data.planSource === 'brand_inherited');
};

interface Scope { enabled: boolean; brandAccountId?: string | null }

export const useBrandNetworkDashboard = (range: PeriodRange | null, templateId: string | null, scope: Scope) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['brand-network-dashboard', user?.id, scope.brandAccountId ?? null, range?.from, range?.to, range?.bucket, templateId],
    enabled: scope.enabled && !!user && !!range,
    staleTime: STALE,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const args: Record<string, unknown> = {
        p_from: range!.from, p_to: range!.to, p_bucket: range!.bucket, p_template_id: templateId,
      };
      if (scope.brandAccountId) args.p_brand_account_id = scope.brandAccountId;
      const { data, error } = await rpc('get_my_brand_network_dashboard', args);
      if (error) throw error;
      return data as NetworkDashboard;
    },
  });
};

export interface ActivationFilters {
  page: number;
  templateId: string | null;
  status: 'all' | 'operational' | 'configuring';
  plan: string | null;
  search: string;
}

export const useBrandNetworkActivations = (filters: ActivationFilters, scope: Scope) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['brand-network-activations', user?.id, scope.brandAccountId ?? null, filters],
    enabled: scope.enabled && !!user,
    staleTime: STALE,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const args: Record<string, unknown> = {
        p_page: filters.page,
        p_page_size: NETWORK_PAGE_SIZE,
        p_template_id: filters.templateId,
        p_status: filters.status,
        p_plan: filters.plan,
        p_search: filters.search.trim() || null,
      };
      if (scope.brandAccountId) args.p_brand_account_id = scope.brandAccountId;
      const { data, error } = await rpc('get_my_brand_network_activations', args);
      if (error) throw error;
      return data as NetworkActivationsPage;
    },
  });
};

/** Detalhe: só é chamado quando o usuário abre o painel lateral. */
export const useBrandNetworkActivationDetail = (storeKey: string | null, scope: Scope) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['brand-network-activation-detail', user?.id, scope.brandAccountId ?? null, storeKey],
    enabled: scope.enabled && !!user && !!storeKey,
    staleTime: STALE,
    retry: false,
    queryFn: async () => {
      const args: Record<string, unknown> = { p_store_key: storeKey };
      if (scope.brandAccountId) args.p_brand_account_id = scope.brandAccountId;
      const { data, error } = await rpc('get_my_brand_network_activation_detail', args);
      if (error) throw error;
      return data as NetworkActivation;
    },
  });
};
