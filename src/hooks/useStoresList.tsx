import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StoresFilters {
  search?: string;
  status?: string;
  plan?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface StoresPagination {
  page: number;
  pageSize: number;
}

export const useStoresList = (
  filters: StoresFilters,
  pagination: StoresPagination
) => {
  return useQuery({
    queryKey: ["stores-list", filters, pagination],
    queryFn: async () => {
      const start = pagination.page * pagination.pageSize;
      const end = start + pagination.pageSize - 1;

      // Get user emails from auth
      const { data: authData } = await supabase.auth.admin.listUsers();
      const emailMap = new Map<string, string>();
      if (authData?.users) {
        authData.users.forEach((u: any) => {
          if (u.id && u.email) {
            emailMap.set(u.id, u.email);
          }
        });
      }

      // Fetch master_subscriptions for all users to derive status
      const { data: allSubscriptions } = await supabase
        .from("master_subscriptions")
        .select("user_id, status, plan_id, billing_cycle, downgrade_reason")
        .order("created_at", { ascending: false });

      // Build a map: user_id -> latest subscription
      const subscriptionMap = new Map<string, any>();
      allSubscriptions?.forEach((sub) => {
        if (!subscriptionMap.has(sub.user_id)) {
          subscriptionMap.set(sub.user_id, sub);
        }
      });

      let query = supabase
        .from("profiles")
        .select(
          `*`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `store_name.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,cpf_cnpj.ilike.%${filters.search}%`
        );
      }

      // Apply date range filter
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }

      // Apply pagination
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;

      // Add emails and subscription data to stores
      const storesWithData = (data || []).map(store => {
        const sub = subscriptionMap.get(store.id);
        return {
          ...store,
          email: emailMap.get(store.id) || null,
          master_subscription: sub || null,
        };
      });

      // Apply status filter on the client side (since it depends on master_subscriptions)
      let filteredStores = storesWithData;
      if (filters.status && filters.status !== "all") {
        filteredStores = storesWithData.filter(store => {
          const derivedStatus = deriveSubscriberStatus(store.master_subscription);
          if (filters.status === "active") return derivedStatus === "Ativo";
          if (filters.status === "inactive") return derivedStatus === "Inativo";
          if (filters.status === "past_due") return derivedStatus === "Inadimplente";
          if (filters.status === "free") return derivedStatus === "Grátis";
          return true;
        });
      }

      // Apply plan filter
      if (filters.plan && filters.plan !== "all") {
        filteredStores = filteredStores.filter(store => {
          const planId = store.master_subscription?.plan_id || "gratis";
          return planId === filters.plan;
        });
      }

      return {
        stores: filteredStores,
        totalCount: filters.status !== "all" || filters.plan !== "all" 
          ? filteredStores.length 
          : count || 0,
      };
    },
  });
};

export function deriveSubscriberStatus(subscription: any): string {
  if (!subscription) return "Grátis";

  const { status, plan_id, downgrade_reason } = subscription;

  // Automatic downgrade = still "Grátis"
  if (plan_id === "gratis") return "Grátis";
  if (status === "cancelled" && downgrade_reason === "payment_failed") return "Grátis";

  if (status === "active") return "Ativo";
  if (status === "past_due") return "Inadimplente";
  if (status === "cancelled" || status === "expired") return "Inativo";
  if (status === "pending") return "Pendente";

  return "Grátis";
}
