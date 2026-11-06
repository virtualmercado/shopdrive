import { fetchAllRows } from "@/lib/adminPagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMerchantStore } from "@/hooks/useMerchantStore";
import { toast } from "@/hooks/use-toast";

export interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  variations?: any;
}

export interface Order {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  total_amount: number;
  subtotal: number | null;
  delivery_fee: number | null;
  delivery_method: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_source: 'manual' | 'store' | 'catalog';
  order_items?: OrderItem[];
}

export const useOrders = () => {
  const { storeId, client: supabase } = useMerchantStore();
  return useQuery({
    queryKey: ["orders", storeId],
    queryFn: async () => {
      
      if (!storeId) throw new Error("Usuário não autenticado");

      const data = await fetchAllRows(() => supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_id,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          total_amount,
          subtotal,
          delivery_fee,
          delivery_method,
          status,
          payment_method,
          notes,
          created_at,
          updated_at,
          order_source
        `)
        .eq("store_owner_id", storeId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }));
      return data as Order[];
    },
  });
};

export const useOrderDetails = (orderId: string) => {
  const { storeId, client: supabase } = useMerchantStore();
  return useQuery({
    queryKey: ["order", orderId, storeId],
    queryFn: async () => {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      return {
        ...orderData,
        order_items: itemsData,
      } as Order;
    },
    enabled: !!orderId && !!storeId,
  });
};

export const useOrderStats = () => {
  const { storeId, client: supabase } = useMerchantStore();
  return useQuery({
    queryKey: ["order-stats", storeId],
    queryFn: async () => {
      
      if (!storeId) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("orders")
        .select("status, total_amount")
        .eq("store_owner_id", storeId);

      if (error) throw error;

      const totalOrders = data.length;
      const paidOrders = data.filter(o => o.status === "paid").length;
      const processingOrders = data.filter(o => o.status === "processing").length;

      return {
        totalOrders,
        paidOrders,
        processingOrders,
      };
    },
  });
};

export const useUpdateOrderStatus = () => {
  const { storeId, client: supabase } = useMerchantStore();
  const queryClient = useQueryClient();

  return useMutation({
    // Stock is reserved server-side when the order is created and returned
    // server-side on cancel/delete. Status changes here never move stock.
    mutationFn: async ({ orderId, status }: { orderId: string; status: string; previousStatus?: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["order-stats", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      // Invalidate dashboard chart queries so they reflect the new order status
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats", storeId] });
      queryClient.invalidateQueries({ queryKey: ["top-products-30-days", storeId] });
      queryClient.invalidateQueries({ queryKey: ["top-customers-6-months", storeId] });
      queryClient.invalidateQueries({ queryKey: ["revenue-stats-30-days", storeId] });
      queryClient.invalidateQueries({ queryKey: ["recent-orders", storeId] });
      toast({
        title: "Status atualizado",
        description: "O status do pedido foi atualizado com sucesso.",
      });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      toast({
        title: "Erro",
        description: msg.includes("cancelado") ? msg : "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    },
  });
};
