import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'user' | 'financeiro' | 'suporte' | 'tecnico';

export const useRoleCheck = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;
        setRoles(data?.map(r => r.role as AppRole) || []);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching roles:', error);
        }
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const hasAnyRole = (requiredRoles: AppRole[]): boolean => {
    return requiredRoles.some(role => roles.includes(role));
  };

  const canAccess = (path: string): boolean => {
    const routePermissions: Record<string, AppRole[]> = {
      '/admin': ['admin', 'financeiro', 'suporte', 'tecnico'],
      '/admin/subscribers': ['admin', 'financeiro', 'suporte'],
      '/admin/invoices': ['admin', 'financeiro'],
      '/admin/reports': ['admin', 'financeiro'],
      '/admin/integrations': ['admin', 'tecnico'],
      '/admin/support': ['admin', 'suporte'],
      '/admin/plans': ['admin'],
    };

    const requiredRoles = routePermissions[path];
    if (!requiredRoles) return false;
    
    return hasAnyRole(requiredRoles);
  };

  return { roles, hasRole, hasAnyRole, canAccess, loading };
};
