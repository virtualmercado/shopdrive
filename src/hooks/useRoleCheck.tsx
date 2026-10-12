import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { createUserScopedLoader } from '@/lib/authIdentity';

type AppRole = 'admin' | 'user' | 'financeiro' | 'suporte' | 'tecnico';

export const useRoleCheck = () => {
  const { user, loading: authLoading } = useAuthContext();
  const userId = user?.id ?? null;
  // Roles are always stored together with the identity they belong to.
  const [resolved, setResolved] = useState<{ userId: string; roles: AppRole[] } | null>(null);

  const loaderRef = useRef(
    createUserScopedLoader<AppRole[]>(
      (uid, r) => setResolved({ userId: uid, roles: r }),
      (uid, error) => {
        if (import.meta.env.DEV) console.error('Error fetching roles:', error);
        setResolved({ userId: uid, roles: [] });
      },
    ),
  );

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      loaderRef.current.invalidate(null);
      setResolved(null);
      return;
    }
    if (loaderRef.current.currentUserId() === userId) return;
    void loaderRef.current.load(userId, async () => {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    });
  }, [userId, authLoading]);

  // Roles of any other identity are never exposed, not even for one render.
  const roles = useMemo<AppRole[]>(
    () => (resolved && resolved.userId === userId ? resolved.roles : []),
    [resolved, userId],
  );
  const loading = authLoading || (!!userId && resolved?.userId !== userId);

  const hasRole = useCallback((role: AppRole): boolean => {
    return roles.includes(role);
  }, [roles]);

  const hasAnyRole = useCallback((requiredRoles: AppRole[]): boolean => {
    return requiredRoles.some(role => roles.includes(role));
  }, [roles]);

  const canAccess = useCallback((path: string): boolean => {
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
  }, [hasAnyRole]);

  const canPerformAction = useCallback((action: string): boolean => {
    const actionPermissions: Record<string, AppRole[]> = {
      'view_subscribers': ['admin', 'financeiro', 'suporte'],
      'edit_subscribers': ['admin'],
      'block_subscribers': ['admin', 'financeiro'],
      'manage_invoices': ['admin', 'financeiro'],
      'manage_payments': ['admin', 'financeiro'],
      'manage_tickets': ['admin', 'suporte'],
      'view_tickets': ['admin', 'suporte'],
      'manage_integrations': ['admin', 'tecnico'],
      'view_reports': ['admin', 'financeiro'],
      'manage_plans': ['admin'],
      'view_audit_logs': ['admin'],
      'impersonate_user': ['admin'],
    };

    const requiredRoles = actionPermissions[action];
    if (!requiredRoles) return false;
    return hasAnyRole(requiredRoles);
  }, [hasAnyRole]);

  return { user, authLoading, roles, hasRole, hasAnyRole, canAccess, canPerformAction, loading };
};
