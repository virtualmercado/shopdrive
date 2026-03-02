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

      // Total subscribers (with active stores)
      const { count: totalSubscribers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('store_slug', 'is', null);

      // ===== MRR REAL: from master_subscriptions =====
      // Only active, exclude gratis, exclude pending/cancelled
      const { data: activeSubscriptions } = await supabase
        .from('master_subscriptions')
        .select('plan_id, billing_cycle, monthly_price, total_amount')
        .eq('status', 'active')
        .neq('plan_id', 'gratis');

      const mrr = activeSubscriptions?.reduce((sum, sub) => {
        // For annual billing, convert to monthly (total_amount / 12)
        if (sub.billing_cycle === 'annual' || sub.billing_cycle === 'anual') {
          return sum + ((sub.total_amount || 0) / 12);
        }
        // Monthly: use monthly_price
        return sum + (sub.monthly_price || 0);
      }, 0) || 0;

      console.log('[AdminStats] Assinantes ativos (excl. grátis):', activeSubscriptions?.length || 0);
      console.log('[AdminStats] MRR calculado:', mrr.toFixed(2));

      // ===== CHURN REAL: cancelamentos no mês atual =====
      // Only real cancellations, exclude automatic downgrades
      const { data: cancelledThisMonthData } = await supabase
        .from('master_subscriptions')
        .select('id, downgrade_reason')
        .eq('status', 'cancelled')
        .neq('plan_id', 'gratis')
        .gte('cancelled_at', `${monthStart}T00:00:00`)
        .lte('cancelled_at', `${monthEnd}T23:59:59`);

      // Filter out automatic downgrades
      const realCancellations = cancelledThisMonthData?.filter(
        sub => !sub.downgrade_reason || sub.downgrade_reason !== 'payment_failed'
      ) || [];

      // Also count those cancelled via updated_at if cancelled_at is null
      const { data: cancelledByUpdatedAt } = await supabase
        .from('master_subscriptions')
        .select('id, downgrade_reason, cancelled_at')
        .eq('status', 'cancelled')
        .neq('plan_id', 'gratis')
        .is('cancelled_at', null)
        .gte('updated_at', `${monthStart}T00:00:00`)
        .lte('updated_at', `${monthEnd}T23:59:59`);

      const extraCancellations = cancelledByUpdatedAt?.filter(
        sub => !sub.downgrade_reason || sub.downgrade_reason !== 'payment_failed'
      ) || [];

      const totalRealCancellations = realCancellations.length + extraCancellations.length;

      console.log('[AdminStats] Cancelamentos reais no mês:', totalRealCancellations);

      // Churn rate = cancellations / (active at start of month ~ active now + cancelled this month)
      const activeCount = activeSubscriptions?.length || 0;
      const baseForChurn = activeCount + totalRealCancellations;
      const churnRate = baseForChurn > 0 ? (totalRealCancellations / baseForChurn) * 100 : 0;

      // ===== LTV REAL: from master_subscription_payments =====
      const { data: paidPayments } = await supabase
        .from('master_subscription_payments')
        .select('user_id, amount')
        .eq('status', 'paid');

      // Group by user_id and calculate average revenue per subscriber
      const revenueByUser: Record<string, number> = {};
      paidPayments?.forEach(p => {
        revenueByUser[p.user_id] = (revenueByUser[p.user_id] || 0) + (p.amount || 0);
      });
      const userIds = Object.keys(revenueByUser);
      const totalRevenue = Object.values(revenueByUser).reduce((a, b) => a + b, 0);
      const avgLTV = userIds.length > 0 ? totalRevenue / userIds.length : 0;

      console.log('[AdminStats] Receita total (pagamentos pagos):', totalRevenue.toFixed(2));
      console.log('[AdminStats] Assinantes pagantes únicos:', userIds.length);
      console.log('[AdminStats] LTV médio:', avgLTV.toFixed(2));

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

      // Inadimplência
      const totalInvoicesCount = (paidInvoices || 0) + (overdueInvoices || 0) + (pendingInvoices || 0);
      const inadimplenciaRate = totalInvoicesCount > 0 
        ? ((overdueInvoices || 0) / totalInvoicesCount) * 100 
        : 0;

      // Integration errors
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
        activeSubscribersCount: activeCount,
        paidInvoices: paidInvoices || 0,
        overdueInvoices: overdueInvoices || 0,
        pendingInvoices: pendingInvoices || 0,
        cancelledThisMonth: totalRealCancellations,
        churnRate: Math.round(churnRate * 10) / 10,
        avgLTV,
        totalRevenue,
        inadimplenciaRate: inadimplenciaRate.toFixed(1),
        integrationErrors: integrationErrors || [],
      };
    },
    refetchInterval: 30000,
  });
};

export const useAdminAlerts = () => {
  return useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      const today = new Date();
      const last24h = format(subDays(today, 1), 'yyyy-MM-dd');

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
