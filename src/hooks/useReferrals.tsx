import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useReferralStats = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['referral-stats', storeId],
    queryFn: async () => {
      if (!storeId) return { total_referrals: 0, active_referrals: 0 };
      const { data, error } = await supabase.rpc('get_referral_stats', { p_store_id: storeId });
      if (error) throw error;
      if (data && Array.isArray(data) && data.length > 0) return data[0];
      if (data && !Array.isArray(data)) return data;
      return { total_referrals: 0, active_referrals: 0 };
    },
    enabled: !!storeId,
  });
};
