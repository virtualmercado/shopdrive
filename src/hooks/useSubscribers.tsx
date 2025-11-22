import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSubscribers = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSubscribers = async (filters?: {
    search?: string;
    status?: string;
    planId?: string;
    lastActivityStart?: string;
    lastActivityEnd?: string;
  }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*, subscriptions(status, plan_id, current_period_end, subscription_plans(name))')
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,store_name.ilike.%${filters.search}%`);
      }
      if (filters?.lastActivityStart) {
        query = query.gte('last_activity', filters.lastActivityStart);
      }
      if (filters?.lastActivityEnd) {
        query = query.lte('last_activity', filters.lastActivityEnd);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by subscription status and plan on the client side
      let filtered = data || [];
      if (filters?.status) {
        filtered = filtered.filter(sub => 
          sub.subscriptions?.[0]?.status === filters.status
        );
      }
      if (filters?.planId) {
        filtered = filtered.filter(sub => 
          sub.subscriptions?.[0]?.plan_id === filters.planId
        );
      }

      return filtered;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching subscribers:', error);
      }
      toast({
        title: 'Erro ao carregar assinantes',
        description: 'Não foi possível carregar os assinantes.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getSubscriberDetails = async (id: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*, subscriptions(*, subscription_plans(*)), invoices(*), user_roles(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching subscriber details:', error);
      }
      toast({
        title: 'Erro ao carregar detalhes',
        description: 'Não foi possível carregar os detalhes do assinante.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateSubscriber = async (id: string, data: any) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Assinante atualizado',
        description: 'Dados atualizados com sucesso.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating subscriber:', error);
      }
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar os dados.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchSubscribers,
    getSubscriberDetails,
    updateSubscriber,
  };
};
