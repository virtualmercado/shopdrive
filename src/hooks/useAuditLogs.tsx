import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuditLogs = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async (filters?: {
    userId?: string;
    entityType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.action) {
        query = query.ilike('action', `%${filters.action}%`);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching audit logs:', error);
      }
      toast({
        title: 'Erro ao carregar logs',
        description: 'Não foi possível carregar os logs de auditoria.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: any
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error logging action:', error);
      }
      return false;
    }
  };

  return {
    loading,
    fetchLogs,
    logAction,
  };
};
