import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { ProfileLoadError } from '@/components/ProfileLoadError';
import { DashboardErrorBoundary } from '@/components/DashboardErrorBoundary';
import { useMerchantStore } from '@/hooks/useMerchantStore';
import { delegatedMerchantRouteAllowed } from '@/lib/merchantStoreRules';
import { Button } from '@/components/ui/button';

interface MerchantRouteProps {
  children: React.ReactNode;
}

export const MerchantRoute = ({ children }: MerchantRouteProps) => {
  const { user, isMerchant, loading, profileStatus, refreshProfile } = useAuthContext();
  const store = useMerchantStore();
  const navigate = useNavigate();
  const location = useLocation();
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

  if (loading || store.loading || store.switching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isTemplateEditorMode && user && profileStatus === 'error') {
    return <ProfileLoadError onRetry={refreshProfile} />;
  }

  if (store.error) return <ProfileLoadError onRetry={async () => store.retry()} />;
  if (store.delegated && !delegatedMerchantRouteAllowed(location.pathname)) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><p>Esta área pertence à conta principal.</p><Button onClick={() => navigate('/lojista', { replace: true })}>Voltar ao Dashboard</Button></div>;
  }

  if (isTemplateEditorMode) {
    return <DashboardErrorBoundary key={location.pathname}>{children}</DashboardErrorBoundary>;
  }

  if (!user || !isMerchant) {
    return null;
  }

  return <DashboardErrorBoundary key={`${user.id}:${store.storeId}:${location.pathname}`}>{children}</DashboardErrorBoundary>;
};
