import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantCheck } from '@/hooks/useMerchantCheck';
import { toast } from 'sonner';

interface MerchantRouteProps {
  children: React.ReactNode;
}

export const MerchantRoute = ({ children }: MerchantRouteProps) => {
  const { user, isMerchant, loading } = useMerchantCheck();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!loading && !hasRedirected) {
      if (!user) {
        // Usuário não autenticado - redirecionar para login
        setHasRedirected(true);
        navigate('/login', { replace: true });
      } else if (!isMerchant) {
        // Usuário é cliente, não lojista - redirecionar para home
        setHasRedirected(true);
        toast.error('Acesso não autorizado. Esta área é exclusiva para lojistas.');
        navigate('/', { replace: true });
      }
    }
  }, [user, isMerchant, loading, navigate, hasRedirected]);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não tem usuário ou não é lojista, mostrar loading enquanto redireciona
  if (!user || !isMerchant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};
