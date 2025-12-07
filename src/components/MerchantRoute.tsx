import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantCheck } from '@/hooks/useMerchantCheck';
import { toast } from 'sonner';

interface MerchantRouteProps {
  children: React.ReactNode;
}

export const MerchantRoute = ({ children }: MerchantRouteProps) => {
  const { user, isMerchant, loading } = useMerchantCheck();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Usuário não autenticado - redirecionar para login
        navigate('/login', { replace: true });
      } else if (!isMerchant) {
        // Usuário é cliente, não lojista - redirecionar para home
        toast.error('Acesso não autorizado. Esta área é exclusiva para lojistas.');
        navigate('/', { replace: true });
      }
    }
  }, [user, isMerchant, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isMerchant) {
    return null;
  }

  return <>{children}</>;
};
