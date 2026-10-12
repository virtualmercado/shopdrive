import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { ProfileLoadError } from '@/components/ProfileLoadError';

interface MerchantRouteProps {
  children: React.ReactNode;
}

export const MerchantRoute = ({ children }: MerchantRouteProps) => {
  const { user, isMerchant, loading, profileStatus, refreshProfile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isTemplateEditorMode = searchParams.get('mode') === 'template-editor';

  useEffect(() => {
    if (loading) return;
    if (isTemplateEditorMode) return;

    if (!user) {
      navigate('/login', { replace: true });
    } else if (profileStatus === 'incomplete') {
      // Only a completed lookup proving "no store" leads to onboarding — never an error.
      navigate('/onboarding', { replace: true });
    }
  }, [user, loading, profileStatus, navigate, isTemplateEditorMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isTemplateEditorMode && user && profileStatus === 'error') {
    return <ProfileLoadError onRetry={refreshProfile} />;
  }

  if (isTemplateEditorMode) {
    return <>{children}</>;
  }

  if (!user || !isMerchant) {
    return null;
  }

  return <>{children}</>;
};
