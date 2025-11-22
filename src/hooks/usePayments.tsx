import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePayments = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchPayments = async (filters?: {
    gateway?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('payments')
        .select('*, invoices(*, profiles(full_name, store_name))')
        .order('created_at', { ascending: false });

      if (filters?.gateway) {
        query = query.eq('gateway', filters.gateway);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.minAmount) {
        query = query.gte('amount', filters.minAmount);
      }
      if (filters?.maxAmount) {
        query = query.lte('amount', filters.maxAmount);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching payments:', error);
      }
      toast({
        title: 'Erro ao carregar pagamentos',
        description: 'Não foi possível carregar os pagamentos.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createManualPayment = async (data: {
    invoice_id: string;
    amount: number;
    gateway: string;
    transaction_id?: string;
    notes?: string;
  }) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('payments').insert({
        invoice_id: data.invoice_id,
        amount: data.amount,
        net_amount: data.amount,
        gateway: data.gateway,
        gateway_fee: 0,
        status: 'paid',
        transaction_id: data.transaction_id || `manual_${Date.now()}`,
        paid_at: new Date().toISOString(),
        metadata: { notes: data.notes, manual: true },
      });

      if (error) throw error;

      // Update invoice status
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', data.invoice_id);

      toast({
        title: 'Pagamento registrado',
        description: 'Pagamento manual registrado com sucesso.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating manual payment:', error);
      }
      toast({
        title: 'Erro ao registrar pagamento',
        description: 'Não foi possível registrar o pagamento manual.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refundPayment = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Pagamento estornado',
        description: 'Pagamento estornado com sucesso.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error refunding payment:', error);
      }
      toast({
        title: 'Erro ao estornar',
        description: 'Não foi possível estornar o pagamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async (id: string) => {
    try {
      setLoading(true);
      // This would typically trigger a webhook reprocessing
      // For now, we'll just update the status
      const { error } = await supabase
        .from('payments')
        .update({ status: 'pending' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Pagamento reenviado',
        description: 'Solicitação de reprocessamento enviada.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error retrying payment:', error);
      }
      toast({
        title: 'Erro ao reprocessar',
        description: 'Não foi possível reprocessar o pagamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchPayments,
    createManualPayment,
    refundPayment,
    retryPayment,
  };
};
