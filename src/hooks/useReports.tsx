import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ReportType = 'subscribers' | 'revenue' | 'invoices' | 'payments' | 'churn' | 'mrr' | 'logs';
type ReportFormat = 'csv' | 'excel' | 'pdf';

export const useReports = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateReport = async (
    type: ReportType,
    filters: {
      startDate?: string;
      endDate?: string;
      status?: string;
      [key: string]: any;
    },
    format: ReportFormat
  ) => {
    try {
      setLoading(true);

      let data: any[] = [];
      let filename = '';

      switch (type) {
        case 'subscribers':
          const { data: subscribers, error: subsError } = await supabase
            .from('profiles')
            .select('*, subscriptions(status, plan_id, subscription_plans(name))')
            .gte('created_at', filters.startDate || '2000-01-01')
            .lte('created_at', filters.endDate || '2099-12-31');
          
          if (subsError) throw subsError;
          data = subscribers || [];
          filename = `assinantes_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'revenue':
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('status', 'paid')
            .gte('paid_at', filters.startDate || '2000-01-01')
            .lte('paid_at', filters.endDate || '2099-12-31');
          
          if (paymentsError) throw paymentsError;
          data = payments || [];
          filename = `receitas_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'invoices':
          const { data: invoices, error: invError } = await supabase
            .from('invoices')
            .select('*, profiles(full_name, store_name)')
            .gte('created_at', filters.startDate || '2000-01-01')
            .lte('created_at', filters.endDate || '2099-12-31');
          
          if (invError) throw invError;
          data = invoices || [];
          filename = `faturas_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'churn':
          const { data: cancelled, error: churnError } = await supabase
            .from('subscriptions')
            .select('*, profiles(full_name, store_name)')
            .eq('status', 'cancelled')
            .gte('updated_at', filters.startDate || '2000-01-01')
            .lte('updated_at', filters.endDate || '2099-12-31');
          
          if (churnError) throw churnError;
          data = cancelled || [];
          filename = `churn_${new Date().toISOString().split('T')[0]}`;
          break;

        default:
          throw new Error('Tipo de relatório não suportado');
      }

      // Convert to CSV (simple implementation)
      if (format === 'csv') {
        const csv = convertToCSV(data);
        downloadFile(csv, `${filename}.csv`, 'text/csv');
      }

      toast({
        title: 'Relatório gerado',
        description: `Relatório de ${type} baixado com sucesso.`,
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error generating report:', error);
      }
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'object' ? JSON.stringify(value) : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    loading,
    generateReport,
  };
};
