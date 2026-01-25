import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoleCheck } from '@/hooks/useRoleCheck';
import { toast } from 'sonner';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  // IMPORTANT: useRoleCheck already tracks auth state internally.
  // Avoid instantiating a second useAuth() here to prevent transient mismatches
  // on cold loads/new tabs (which could redirect admins to the landing page).
  const { user, authLoading, hasAnyRole, loading: roleLoading } = useRoleCheck();
  const navigate = useNavigate();
  const [hasChecked, setHasChecked] = useState(false);

  const loading = authLoading || roleLoading;
  const isAdmin = hasAnyRole(['admin', 'financeiro', 'suporte', 'tecnico']);

  useEffect(() => {
    // CRITICAL: Only perform access check after BOTH auth and roles are fully loaded
    // This prevents premature redirects when opening preview in new tabs
    if (!authLoading && !roleLoading && !hasChecked) {
      setHasChecked(true);
      
      if (!user) {
        navigate('/gestor/login', { replace: true });
      } else if (!isAdmin) {
        toast.error('Acesso não autorizado. Esta área é exclusiva para administradores.');
        navigate('/', { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate, hasChecked]);

  // Show loading spinner while EITHER auth or roles are loading
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render children until we've completed the access check
  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
};
