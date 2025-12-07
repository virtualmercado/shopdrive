import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useMerchantCheck = () => {
  const { user, loading: authLoading } = useAuth();
  const [isMerchant, setIsMerchant] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMerchant = async () => {
      if (!user) {
        setIsMerchant(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('store_slug')
          .eq('id', user.id)
          .single();

        // Usuário é lojista se tem store_slug definido
        setIsMerchant(!error && data?.store_slug !== null);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error checking merchant status:', error);
        }
        setIsMerchant(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkMerchant();
    }
  }, [user, authLoading]);

  return { isMerchant, loading: loading || authLoading, user };
};
