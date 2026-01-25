import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'user' | 'financeiro' | 'suporte' | 'tecnico';

export const useRoleCheck = () => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

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
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading before fetching roles
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    fetchRoles(user.id);
  }, [user, authLoading, fetchRoles]);

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

  // Expose user/authLoading so route guards can avoid instantiating a second
  // useAuth() instance (which can cause a brief mismatch on cold loads/new tabs).
  return { user, authLoading, roles, hasRole, hasAnyRole, canAccess, canPerformAction, loading };
};
