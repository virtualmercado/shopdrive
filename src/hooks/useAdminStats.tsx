import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";

export const useAdminStats = () => {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = format(today, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // New subscribers today
      const { count: newSubscribersToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${startOfDay}T00:00:00`)
        .lte('created_at', `${startOfDay}T23:59:59`);

      // Total subscribers
      const { count: totalSubscribers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('store_slug', 'is', null);

      // MRR from subscriptions
      const { data: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select(`
          id,
          plan_id,
          subscription_plans (price)
        `)
        .eq('status', 'active');

      const mrr = activeSubscriptions?.reduce((sum, sub) => {
        const price = (sub.subscription_plans as any)?.price || 0;
        return sum + price;
      }, 0) || 0;

      // Invoices stats
      const { count: paidInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const { count: overdueInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue');

      const { count: pendingInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Calculate churn rate (cancelamentos do mês)
      const { count: cancelledThisMonth } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('updated_at', monthStart)
        .lte('updated_at', monthEnd);

      // Calculate inadimplência
      const totalInvoicesCount = (paidInvoices || 0) + (overdueInvoices || 0) + (pendingInvoices || 0);
      const inadimplenciaRate = totalInvoicesCount > 0 
        ? ((overdueInvoices || 0) / totalInvoicesCount) * 100 
        : 0;

      // Integration status (check for errors in platform_events)
      const { data: integrationErrors } = await supabase
        .from('platform_events')
        .select('*')
        .eq('event_type', 'integration_error')
        .gte('created_at', format(subDays(today, 1), 'yyyy-MM-dd'))
        .limit(5);

      return {
        newSubscribersToday: newSubscribersToday || 0,
        totalSubscribers: totalSubscribers || 0,
        mrr,
        paidInvoices: paidInvoices || 0,
        overdueInvoices: overdueInvoices || 0,
        pendingInvoices: pendingInvoices || 0,
        cancelledThisMonth: cancelledThisMonth || 0,
        inadimplenciaRate: inadimplenciaRate.toFixed(1),
        integrationErrors: integrationErrors || [],
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useAdminAlerts = () => {
  return useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      const today = new Date();
      const last24h = format(subDays(today, 1), 'yyyy-MM-dd');

      // Get recent critical events
      const { data: criticalEvents } = await supabase
        .from('platform_events')
        .select('*')
        .in('severity', ['error', 'critical'])
        .gte('created_at', last24h)
        .order('created_at', { ascending: false })
        .limit(10);

      return criticalEvents || [];
    },
    refetchInterval: 60000,
  });
};
