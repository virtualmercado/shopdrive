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

      let query = supabase
        .from("profiles")
        .select(
          `
          *,
          subscriptions(status, plan_id, subscription_plans(name))
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `store_name.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,cpf_cnpj.ilike.%${filters.search}%`
        );
      }

      // Apply status filter
      if (filters.status && filters.status !== "all") {
        if (filters.status === "active") {
          query = query.not("store_slug", "is", null);
        } else if (filters.status === "inactive") {
          query = query.is("store_slug", null);
        }
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

      return {
        stores: data || [],
        totalCount: count || 0,
      };
    },
  });
};
