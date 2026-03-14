import { useAuthContext } from '@/contexts/AuthContext';

export const useMerchantCheck = () => {
  const { user, loading, isMerchant, isTemplateProfile } = useAuthContext();
  return { isMerchant, isTemplateProfile, loading, user };
};
