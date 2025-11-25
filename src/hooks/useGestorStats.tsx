import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GestorStats {
  totalStores: number;
  activeStores: number;
  delinquentStores: number;
  newStoresThisMonth: number;
  newStoresLastMonth: number;
  newStoresTrend: number;
  monthlyRevenue: number;
  avgTicket: number;
  pendingInvoices: number;
  currentPeriodData: Array<{ date: string; value: number }>;
  previousPeriodData: Array<{ date: string; value: number }>;
  revenueChange: number;
}

export const useGestorStats = () => {
  return useQuery({
    queryKey: ["gestor-stats"],
    queryFn: async (): Promise<GestorStats> => {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Total stores
      const { count: totalStores } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Active stores (with store_slug)
      const { count: activeStores } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("store_slug", "is", null);

      // Delinquent stores (subscriptions with status 'past_due' or 'unpaid')
      const { count: delinquentStores } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .in("status", ["past_due", "unpaid"]);

      // New stores this month
      const { count: newStoresThisMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfThisMonth.toISOString());

      // New stores last month
      const { count: newStoresLastMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfLastMonth.toISOString())
        .lte("created_at", endOfLastMonth.toISOString());

      // Calculate trend
      const newStoresTrend =
        newStoresLastMonth && newStoresLastMonth > 0
          ? ((newStoresThisMonth! - newStoresLastMonth) / newStoresLastMonth) * 100
          : 0;

      // Monthly revenue (sum of paid invoices this month)
      const { data: paidInvoices } = await supabase
        .from("invoices")
        .select("amount")
        .eq("status", "paid")
        .gte("paid_at", startOfThisMonth.toISOString());

      const monthlyRevenue = paidInvoices?.reduce(
        (sum, invoice) => sum + invoice.amount,
        0
      ) || 0;

      // Previous month revenue for comparison
      const { data: previousMonthInvoices } = await supabase
        .from("invoices")
        .select("amount")
        .eq("status", "paid")
        .gte("paid_at", startOfLastMonth.toISOString())
        .lt("paid_at", startOfThisMonth.toISOString());

      const previousMonthRevenue = previousMonthInvoices?.reduce(
        (sum, invoice) => sum + invoice.amount,
        0
      ) || 0;

      // Calculate revenue change percentage
      const revenueChange =
        previousMonthRevenue > 0
          ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
          : 0;

      // Average ticket
      const avgTicket =
        paidInvoices && paidInvoices.length > 0
          ? monthlyRevenue / paidInvoices.length
          : 0;

      // Pending invoices
      const { count: pendingInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Generate chart data (mock data for last 30 days)
      const currentPeriodData = [];
      const previousPeriodData = [];
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        
        // Mock data with some variation
        const baseValue = monthlyRevenue / 30;
        const variation = Math.random() * 0.4 - 0.2; // -20% to +20%
        currentPeriodData.push({
          date: dateStr,
          value: baseValue * (1 + variation),
        });
        
        const prevBaseValue = previousMonthRevenue / 30;
        const prevVariation = Math.random() * 0.4 - 0.2;
        previousPeriodData.push({
          date: dateStr,
          value: prevBaseValue * (1 + prevVariation),
        });
      }

      return {
        totalStores: totalStores || 0,
        activeStores: activeStores || 0,
        delinquentStores: delinquentStores || 0,
        newStoresThisMonth: newStoresThisMonth || 0,
        newStoresLastMonth: newStoresLastMonth || 0,
        newStoresTrend,
        monthlyRevenue,
        avgTicket,
        pendingInvoices: pendingInvoices || 0,
        currentPeriodData,
        previousPeriodData,
        revenueChange,
      };
    },
  });
};
