import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoleCheck } from '@/hooks/useRoleCheck';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasAnyRole, loading: roleLoading } = useRoleCheck();
  const navigate = useNavigate();

  const loading = authLoading || roleLoading;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/gestor/login', { replace: true });
      } else if (!hasAnyRole(['admin', 'financeiro', 'suporte', 'tecnico'])) {
        toast.error('Acesso não autorizado. Esta área é exclusiva para administradores.');
        navigate('/', { replace: true });
      }
    }
  }, [user, hasAnyRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !hasAnyRole(['admin', 'financeiro', 'suporte', 'tecnico'])) {
    return null;
  }

  return <>{children}</>;
};
