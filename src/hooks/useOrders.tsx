import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
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
  order_source: 'manual' | 'online';
  order_items?: OrderItem[];
}

export const useOrders = () => {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
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
        .eq("store_owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });
};

export const useOrderDetails = (orderId: string) => {
  return useQuery({
    queryKey: ["order", orderId],
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
    enabled: !!orderId,
  });
};

export const useOrderStats = () => {
  return useQuery({
    queryKey: ["order-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("orders")
        .select("status, total_amount")
        .eq("store_owner_id", user.id);

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status, previousStatus }: { orderId: string; status: string; previousStatus?: string }) => {
      // If changing to "delivered", debit stock
      if (status === "delivered" && previousStatus !== "delivered") {
        // Get order items to debit stock
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", orderId);

        if (itemsError) throw itemsError;

        // Debit stock for each item
        for (const item of orderItems || []) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();

          if (product) {
            const newStock = Math.max(0, product.stock - item.quantity);
            await supabase
              .from("products")
              .update({ stock: newStock })
              .eq("id", item.product_id);
          }
        }
      }

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Status atualizado",
        description: "O status do pedido foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    },
  });
};
