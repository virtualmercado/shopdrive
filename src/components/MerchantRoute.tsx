import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMerchantCheck } from '@/hooks/useMerchantCheck';
import { toast } from 'sonner';

interface MerchantRouteProps {
  children: React.ReactNode;
}

export const MerchantRoute = ({ children }: MerchantRouteProps) => {
  const { user, isMerchant, loading } = useMerchantCheck();
  const navigate = useNavigate();
  const [hasChecked, setHasChecked] = useState(false);
  const [searchParams] = useSearchParams();

  // Check if we're in template editor mode (session switch in progress)
  const isTemplateEditorMode = searchParams.get('mode') === 'template-editor';

  useEffect(() => {
    if (!loading && !hasChecked) {
      setHasChecked(true);
      
      if (!user) {
        // Template editor mode - wait for login to complete
        if (isTemplateEditorMode) {
          return;
        }
        // Usuário não autenticado - redirecionar para login
        navigate('/login', { replace: true });
      } else if (!isMerchant) {
        // Template editor mode - may still be switching sessions
        if (isTemplateEditorMode) {
          return;
        }
        // Usuário é cliente, não lojista - redirecionar para home
        toast.error('Acesso não autorizado. Esta área é exclusiva para lojistas.');
        navigate('/', { replace: true });
      }
    }
  }, [user, isMerchant, loading, navigate, hasChecked, isTemplateEditorMode]);

  // IMPORTANT: In template editor mode, we must not block rendering.
  // The session switch (signOut/signIn) happens inside DashboardLayout.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Allow access in template editor mode even before the new session is established.
  // (User can be null momentarily during the signOut/signIn process.)
  if (isTemplateEditorMode) {
    return <>{children}</>;
  }

  if (!user || !isMerchant) {
    return null;
  }

  return <>{children}</>;
};
