import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useMerchantCheck = () => {
  const { user, loading: authLoading } = useAuth();
  const [isMerchant, setIsMerchant] = useState<boolean>(false);
  const [isTemplateProfile, setIsTemplateProfile] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMerchant = async () => {
      if (!user) {
        setIsMerchant(false);
        setIsTemplateProfile(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('store_slug, is_template_profile')
          .eq('id', user.id)
          .single();

        if (error) {
          setIsMerchant(false);
          setIsTemplateProfile(false);
        } else {
          // Usuário é lojista se tem store_slug definido OU se é um perfil de template
          const isTemplate = data?.is_template_profile === true;
          setIsTemplateProfile(isTemplate);
          setIsMerchant(data?.store_slug !== null || isTemplate);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error checking merchant status:', error);
        }
        setIsMerchant(false);
        setIsTemplateProfile(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkMerchant();
    }
  }, [user, authLoading]);

  return { isMerchant, isTemplateProfile, loading: loading || authLoading, user };
};
