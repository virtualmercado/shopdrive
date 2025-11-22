import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Invoice {
  id: string;
  subscriber_id: string;
  subscription_id: string | null;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  reference_period_start: string;
  reference_period_end: string;
  notes: string | null;
  payment_link: string | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  subscriberId?: string;
}

export const useInvoices = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchInvoices = async (filters?: InvoiceFilters) => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, profiles!invoices_subscriber_id_fkey(full_name, store_name)')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.subscriberId) {
        query = query.eq('subscriber_id', filters.subscriberId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      toast({
        title: "Erro ao buscar faturas",
        description: "Não foi possível carregar as faturas.",
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Fatura atualizada",
        description: "Fatura atualizada com sucesso."
      });
      return true;
    } catch (error) {
      toast({
        title: "Erro ao atualizar fatura",
        description: "Não foi possível atualizar a fatura.",
        variant: "destructive"
      });
      return false;
    }
  };

  const cancelInvoice = async (id: string) => {
    return updateInvoice(id, { status: 'cancelled' });
  };

  const generatePaymentLink = async (id: string) => {
    // Aqui você implementaria a lógica real de gerar link de pagamento
    const link = `${window.location.origin}/payment/${id}`;
    return updateInvoice(id, { payment_link: link });
  };

  return {
    loading,
    fetchInvoices,
    updateInvoice,
    cancelInvoice,
    generatePaymentLink
  };
};