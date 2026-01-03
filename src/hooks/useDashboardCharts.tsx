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
  
  // Try to find state at the end of address (common format: "..., City - UF" or "..., UF")
  const upperAddress = address.toUpperCase();
  
  for (const state of states) {
    // Check for patterns like "- SP", ", SP", " SP" at the end
    if (upperAddress.endsWith(` ${state}`) || 
        upperAddress.endsWith(`-${state}`) || 
        upperAddress.endsWith(`, ${state}`) ||
        upperAddress.includes(` ${state},`) ||
        upperAddress.includes(`-${state},`) ||
        upperAddress.includes(` ${state} `)) {
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

      const { data: orders, error } = await supabase
        .from("orders")
        .select("customer_address")
        .eq("store_owner_id", user.id)
        .in("status", ["paid", "delivered", "shipped", "confirmed"])
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Group by state
      const stateCount: Record<string, number> = {};
      orders?.forEach(order => {
        const state = extractStateFromAddress(order.customer_address);
        stateCount[state] = (stateCount[state] || 0) + 1;
      });

      const total = orders?.length || 1;
      
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

      return result.length > 0 ? result : [{ state: "Sem dados", count: 0, percentage: 100 }];
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

      // Get orders from last 30 days with customer_id
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("customer_id")
        .eq("store_owner_id", user.id)
        .in("status", ["paid", "delivered", "shipped", "confirmed"])
        .gte("created_at", thirtyDaysAgo.toISOString())
        .not("customer_id", "is", null);

      if (ordersError) throw ordersError;

      // Get unique customer IDs
      const customerIds = [...new Set(orders?.map(o => o.customer_id).filter(Boolean))];

      if (customerIds.length === 0) {
        return [{ gender: "Sem dados", count: 0, percentage: 100 }];
      }

      // Get customer profiles with gender
      const { data: profiles, error: profilesError } = await supabase
        .from("customer_profiles")
        .select("id, gender")
        .in("id", customerIds);

      if (profilesError) throw profilesError;

      // Create a map of customer_id to gender
      const customerGenderMap: Record<string, string> = {};
      profiles?.forEach(p => {
        customerGenderMap[p.id] = p.gender || "Não informado";
      });

      // Count genders from orders
      const genderCount: Record<string, number> = {};
      orders?.forEach(order => {
        if (order.customer_id) {
          const gender = customerGenderMap[order.customer_id] || "Não informado";
          const normalizedGender = gender === "F" || gender === "Feminino" || gender === "female" ? "Feminino" :
                                   gender === "M" || gender === "Masculino" || gender === "male" ? "Masculino" :
                                   "Não informado";
          genderCount[normalizedGender] = (genderCount[normalizedGender] || 0) + 1;
        }
      });

      const total = orders?.length || 1;

      const result: SalesByGender[] = Object.entries(genderCount)
        .filter(([gender]) => gender !== "Não informado" || genderCount["Não informado"] > 0)
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

      // Get orders from last 30 days with customer_id
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("customer_id")
        .eq("store_owner_id", user.id)
        .in("status", ["paid", "delivered", "shipped", "confirmed"])
        .gte("created_at", thirtyDaysAgo.toISOString())
        .not("customer_id", "is", null);

      if (ordersError) throw ordersError;

      // Get unique customer IDs
      const customerIds = [...new Set(orders?.map(o => o.customer_id).filter(Boolean))];

      if (customerIds.length === 0) {
        return [{ range: "Sem dados", count: 0, percentage: 100 }];
      }

      // Get customer profiles with birth_date
      const { data: profiles, error: profilesError } = await supabase
        .from("customer_profiles")
        .select("id, birth_date")
        .in("id", customerIds);

      if (profilesError) throw profilesError;

      // Create a map of customer_id to age range
      const customerAgeMap: Record<string, string> = {};
      profiles?.forEach(p => {
        const age = calculateAge(p.birth_date);
        customerAgeMap[p.id] = getAgeRange(age);
      });

      // Count age ranges from orders
      const ageRangeCount: Record<string, number> = {};
      orders?.forEach(order => {
        if (order.customer_id) {
          const ageRange = customerAgeMap[order.customer_id] || "Não informado";
          ageRangeCount[ageRange] = (ageRangeCount[ageRange] || 0) + 1;
        }
      });

      const total = orders?.length || 1;

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
