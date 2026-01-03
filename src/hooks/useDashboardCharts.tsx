import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SalesByState {
  state: string;
  count: number;
  percentage: number;
}

export interface SalesByGender {
  gender: string;
  count: number;
  percentage: number;
}

export interface SalesByAgeRange {
  range: string;
  count: number;
  percentage: number;
}

export interface RevenueStats {
  totalRevenue: number;
  averageDailyRevenue: number;
}

// Helper function to extract state from address
const extractStateFromAddress = (address: string | null): string => {
  if (!address) return "Não informado";
  
  // Brazilian states abbreviations
  const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  
  const upperAddress = address.toUpperCase();
  
  for (const state of states) {
    if (upperAddress.endsWith(` ${state}`) || 
        upperAddress.endsWith(`-${state}`) || 
        upperAddress.endsWith(`, ${state}`) ||
        upperAddress.includes(` ${state},`) ||
        upperAddress.includes(`-${state},`) ||
        upperAddress.includes(` ${state} `) ||
        upperAddress.includes(`, ${state} `) ||
        upperAddress.includes(` ${state}-`)) {
      return state;
    }
  }
  
  return "Outros";
};

// Helper to calculate age from birth date
const calculateAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Helper to get age range
const getAgeRange = (age: number | null): string => {
  if (age === null) return "Não informado";
  if (age <= 15) return "Até 15";
  if (age <= 18) return "16-18";
  if (age <= 25) return "19-25";
  if (age <= 30) return "26-30";
  if (age <= 35) return "31-35";
  if (age <= 45) return "36-45";
  if (age <= 60) return "46-60";
  return "60+";
};

export const useSalesByState = () => {
  return useQuery({
    queryKey: ["sales-by-state"],
    queryFn: async (): Promise<SalesByState[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all orders from the last 30 days (all statuses to have data)
      const { data: orders, error } = await supabase
        .from("orders")
        .select("customer_address")
        .eq("store_owner_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      if (!orders || orders.length === 0) {
        return [{ state: "Sem dados", count: 0, percentage: 100 }];
      }

      // Group by state
      const stateCount: Record<string, number> = {};
      orders.forEach(order => {
        const state = extractStateFromAddress(order.customer_address);
        stateCount[state] = (stateCount[state] || 0) + 1;
      });

      const total = orders.length;
      
      // Sort by count descending and get top 5 + Others
      const sortedStates = Object.entries(stateCount)
        .sort((a, b) => b[1] - a[1]);

      const topStates = sortedStates.slice(0, 5);
      const othersCount = sortedStates.slice(5).reduce((sum, [, count]) => sum + count, 0);

      const result: SalesByState[] = topStates.map(([state, count]) => ({
        state,
        count,
        percentage: Math.round((count / total) * 100)
      }));

      if (othersCount > 0) {
        result.push({
          state: "Outros",
          count: othersCount,
          percentage: Math.round((othersCount / total) * 100)
        });
      }

      return result;
    },
    refetchInterval: 30000,
  });
};

export const useSalesByGender = () => {
  return useQuery({
    queryKey: ["sales-by-gender"],
    queryFn: async (): Promise<SalesByGender[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get ALL orders from last 30 days (any status) to have data for demographics
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("customer_id, customer_email")
        .eq("store_owner_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return [{ gender: "Sem dados", count: 0, percentage: 100 }];
      }

      // Get customer IDs that are not null
      const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];

      // If no customer_ids linked, try to get profiles by email
      let genderCount: Record<string, number> = {};
      
      if (customerIds.length > 0) {
        // Get customer profiles with gender
        const { data: profiles } = await supabase
          .from("customer_profiles")
          .select("id, gender")
          .in("id", customerIds);

        if (profiles && profiles.length > 0) {
          const customerGenderMap: Record<string, string> = {};
          profiles.forEach(p => {
            const normalizedGender = 
              p.gender === "F" || p.gender === "Feminino" || p.gender === "female" ? "Feminino" :
              p.gender === "M" || p.gender === "Masculino" || p.gender === "male" ? "Masculino" :
              "Não informado";
            customerGenderMap[p.id] = normalizedGender;
          });

          orders.forEach(order => {
            if (order.customer_id && customerGenderMap[order.customer_id]) {
              const gender = customerGenderMap[order.customer_id];
              genderCount[gender] = (genderCount[gender] || 0) + 1;
            }
          });
        }
      }

      // If no gender data from customer_id, show "Não informado" for all orders
      if (Object.keys(genderCount).length === 0) {
        genderCount["Não informado"] = orders.length;
      }

      const total = Object.values(genderCount).reduce((sum, count) => sum + count, 0);

      const result: SalesByGender[] = Object.entries(genderCount)
        .sort((a, b) => b[1] - a[1])
        .map(([gender, count]) => ({
          gender,
          count,
          percentage: Math.round((count / total) * 100)
        }));

      return result.length > 0 ? result : [{ gender: "Sem dados", count: 0, percentage: 100 }];
    },
    refetchInterval: 30000,
  });
};

export const useSalesByAgeRange = () => {
  return useQuery({
    queryKey: ["sales-by-age-range"],
    queryFn: async (): Promise<SalesByAgeRange[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get ALL orders from last 30 days (any status) to have data for demographics
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("customer_id")
        .eq("store_owner_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return [{ range: "Sem dados", count: 0, percentage: 100 }];
      }

      // Get unique customer IDs that are not null
      const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];

      let ageRangeCount: Record<string, number> = {};

      if (customerIds.length > 0) {
        // Get customer profiles with birth_date
        const { data: profiles } = await supabase
          .from("customer_profiles")
          .select("id, birth_date")
          .in("id", customerIds);

        if (profiles && profiles.length > 0) {
          const customerAgeMap: Record<string, string> = {};
          profiles.forEach(p => {
            const age = calculateAge(p.birth_date);
            customerAgeMap[p.id] = getAgeRange(age);
          });

          orders.forEach(order => {
            if (order.customer_id && customerAgeMap[order.customer_id]) {
              const ageRange = customerAgeMap[order.customer_id];
              ageRangeCount[ageRange] = (ageRangeCount[ageRange] || 0) + 1;
            }
          });
        }
      }

      // If no age data from customer_id, show "Não informado" for all orders
      if (Object.keys(ageRangeCount).length === 0) {
        ageRangeCount["Não informado"] = orders.length;
      }

      const total = Object.values(ageRangeCount).reduce((sum, count) => sum + count, 0);

      // Order the ranges properly
      const rangeOrder = ["Até 15", "16-18", "19-25", "26-30", "31-35", "36-45", "46-60", "60+", "Não informado"];
      
      const result: SalesByAgeRange[] = rangeOrder
        .filter(range => ageRangeCount[range] > 0)
        .map(range => ({
          range,
          count: ageRangeCount[range],
          percentage: Math.round((ageRangeCount[range] / total) * 100)
        }));

      return result.length > 0 ? result : [{ range: "Sem dados", count: 0, percentage: 100 }];
    },
    refetchInterval: 30000,
  });
};

export const useRevenueStats = () => {
  return useQuery({
    queryKey: ["revenue-stats-30-days"],
    queryFn: async (): Promise<RevenueStats> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // For revenue, only count paid orders
      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("store_owner_id", user.id)
        .in("status", ["paid", "delivered", "shipped", "confirmed"])
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const averageDailyRevenue = totalRevenue / 30;

      return {
        totalRevenue,
        averageDailyRevenue
      };
    },
    refetchInterval: 30000,
  });
};
