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
  
  // Check localStorage for template context with credentials (means login is pending)
  const hasTemplateContext = (() => {
    try {
      const stored = localStorage.getItem('templateEditorContext');
      if (stored) {
        const context = JSON.parse(stored);
        return context?.mode === 'template-editor' && !!context?.credentials;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  })();

  useEffect(() => {
    // If we're in template editor mode with pending credentials, don't redirect yet
    if (isTemplateEditorMode && hasTemplateContext) {
      return;
    }
    
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
  }, [user, isMerchant, loading, navigate, hasChecked, isTemplateEditorMode, hasTemplateContext]);

  // Show loading during template editor session switch
  if (loading || (isTemplateEditorMode && hasTemplateContext)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Allow access in template editor mode even without traditional merchant status
  if (isTemplateEditorMode && user) {
    return <>{children}</>;
  }

  if (!user || !isMerchant) {
    return null;
  }

  return <>{children}</>;
};
