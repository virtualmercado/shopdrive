import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useMerchantCheck = () => {
  const { user, loading: authLoading } = useAuth();
  const [isMerchant, setIsMerchant] = useState<boolean>(false);
  const [isTemplateProfile, setIsTemplateProfile] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  // Track the user ID we last checked so we know when a re-check is needed
  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    // Still waiting for auth to initialise
    if (authLoading) return;

    const checkMerchant = async () => {
      if (!user) {
        setIsMerchant(false);
        setIsTemplateProfile(false);
        lastCheckedUserId.current = null;
        setLoading(false);
        return;
      }

      // If the user changed (e.g. fresh login), mark loading = true so
      // downstream consumers wait for the new result.
      if (lastCheckedUserId.current !== user.id) {
        setLoading(true);
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('store_slug, is_template_profile')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[MerchantCheck] Error querying profile:', error.message);
          setIsMerchant(false);
          setIsTemplateProfile(false);
        } else if (!data) {
          // Profile doesn't exist yet (trigger might still be running)
          console.warn('[MerchantCheck] No profile found for user', user.id);
          setIsMerchant(false);
          setIsTemplateProfile(false);
        } else {
          const isTemplate = data.is_template_profile === true;
          setIsTemplateProfile(isTemplate);
          setIsMerchant(!!data.store_slug || isTemplate);
        }

        lastCheckedUserId.current = user.id;
      } catch (error) {
        console.error('[MerchantCheck] Unexpected error:', error);
        setIsMerchant(false);
        setIsTemplateProfile(false);
      } finally {
        setLoading(false);
      }
    };

    checkMerchant();
  }, [user, authLoading]);

  return { isMerchant, isTemplateProfile, loading: loading || authLoading, user };
};
