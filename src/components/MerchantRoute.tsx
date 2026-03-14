import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

interface MerchantRouteProps {
  children: React.ReactNode;
}

export const MerchantRoute = ({ children }: MerchantRouteProps) => {
  const { user, isMerchant, loading } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isTemplateEditorMode = searchParams.get('mode') === 'template-editor';

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (isTemplateEditorMode) return;
      console.log('[MerchantRoute] No user — redirecting to /login');
      navigate('/login', { replace: true });
    } else if (!isMerchant) {
      if (isTemplateEditorMode) return;
      console.log('[MerchantRoute] User has no store — redirecting to /onboarding');
      navigate('/onboarding', { replace: true });
    } else {
      console.log('[MerchantRoute] Merchant confirmed — rendering dashboard');
    }
  }, [user, isMerchant, loading, navigate, isTemplateEditorMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isTemplateEditorMode) {
    return <>{children}</>;
  }

  if (!user || !isMerchant) {
    return null;
  }

  return <>{children}</>;
};
