import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useGestorStats = () => {
  return useQuery({
    queryKey: ["gestor-stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Total de lojistas
      const { count: totalStores } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Lojistas ativos (com store_slug)
      const { count: activeStores } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("store_slug", "is", null);

      // Lojistas inadimplentes
      const { count: delinquentStores } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "past_due");

      // Novos lojistas no mês
      const { count: newStoresThisMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString());

      // Novos lojistas no mês passado
      const { count: newStoresLastMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfLastMonth.toISOString())
        .lte("created_at", endOfLastMonth.toISOString());

      // Faturamento mensal
      const { data: monthlyPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gte("created_at", startOfMonth.toISOString());

      const monthlyRevenue = monthlyPayments?.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      ) || 0;

      // Faturas pendentes
      const { count: pendingInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Ticket médio
      const avgTicket = activeStores && activeStores > 0 
        ? monthlyRevenue / activeStores 
        : 0;

      // Calcular variação percentual de novos lojistas
      const newStoresTrend =
        newStoresLastMonth && newStoresLastMonth > 0
          ? ((newStoresThisMonth || 0) - newStoresLastMonth) / newStoresLastMonth * 100
          : 0;

      return {
        totalStores: totalStores || 0,
        activeStores: activeStores || 0,
        delinquentStores: delinquentStores || 0,
        newStoresThisMonth: newStoresThisMonth || 0,
        newStoresTrend,
        monthlyRevenue,
        pendingInvoices: pendingInvoices || 0,
        avgTicket,
      };
    },
  });
};
