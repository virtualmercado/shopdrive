import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
  monthlySales: number;
  totalOrders: number;
  totalProducts: number;
  conversionRate: number;
}

export interface RecentOrder {
  id: string;
  order_number: string | null;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      // Get current month boundaries
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Fetch monthly orders (paid/delivered status for sales calculation)
      const { data: monthlyOrders, error: ordersError } = await supabase
        .from("orders")
        .select("total_amount, status")
        .eq("store_owner_id", user.id)
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());

      if (ordersError) throw ordersError;

      // Calculate monthly sales (only paid/delivered orders)
      const paidStatuses = ["paid", "delivered", "shipped", "confirmed"];
      const monthlySales = monthlyOrders
        ?.filter(order => paidStatuses.includes(order.status))
        .reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

      // Total orders for the month
      const totalOrders = monthlyOrders?.length || 0;

      // Fetch total products count
      const { count: productsCount, error: productsError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (productsError) throw productsError;

      // Calculate conversion rate (completed orders / total orders)
      const completedOrders = monthlyOrders?.filter(order => 
        paidStatuses.includes(order.status)
      ).length || 0;
      
      const conversionRate = totalOrders > 0 
        ? (completedOrders / totalOrders) * 100 
        : 0;

      return {
        monthlySales,
        totalOrders,
        totalProducts: productsCount || 0,
        conversionRate: Math.round(conversionRate * 10) / 10,
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds for near real-time updates
  });
};

export const useRecentOrders = (limit: number = 5) => {
  return useQuery({
    queryKey: ["recent-orders", limit],
    queryFn: async (): Promise<RecentOrder[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, total_amount, status, created_at")
        .eq("store_owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as RecentOrder[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
