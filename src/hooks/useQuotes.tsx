import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";


export interface QuoteItem {
  id?: string;
  quote_id?: string;
  product_id: string | null;
  name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Quote {
  id: string;
  store_owner_id: string;
  quote_number: string | null;
  status: string;
  issued_at: string;
  valid_until: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  payment_method_hint: string | null;
  converted_order_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  quote_items?: QuoteItem[];
}

export const useQuotes = () => {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("store_owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Auto-expire past-due quotes
      const now = new Date();
      const toExpire = (data || []).filter(
        (q: any) => ["draft", "open", "approved"].includes(q.status) && new Date(q.valid_until) < now
      );
      if (toExpire.length > 0) {
        await supabase
          .from("quotes")
          .update({ status: "expired" })
          .in("id", toExpire.map((q: any) => q.id));
        // Return updated data
        return (data || []).map((q: any) =>
          toExpire.find((e: any) => e.id === q.id) ? { ...q, status: "expired" } : q
        ) as Quote[];
      }

      return (data || []) as Quote[];
    },
  });
};

export const useQuoteDetails = (quoteId: string | null) => {
  return useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();
      if (quoteError) throw quoteError;

      const { data: itemsData, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId);
      if (itemsError) throw itemsError;

      return { ...quoteData, quote_items: itemsData || [] } as Quote;
    },
    enabled: !!quoteId,
  });
};

export const useSaveQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quote,
      items,
      editId,
    }: {
      quote: Partial<Quote>;
      items: QuoteItem[];
      editId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editId) {
        const { error } = await supabase
          .from("quotes")
          .update({
            customer_id: quote.customer_id || null,
            customer_name: quote.customer_name!,
            customer_phone: quote.customer_phone || null,
            customer_email: quote.customer_email || null,
            delivery_address: quote.delivery_address || null,
            notes: quote.notes || null,
            valid_until: quote.valid_until!,
            subtotal: quote.subtotal!,
            discount: quote.discount || 0,
            shipping_fee: quote.shipping_fee || 0,
            total: quote.total!,
            payment_method_hint: quote.payment_method_hint || null,
            status: quote.status || "open",
          })
          .eq("id", editId);
        if (error) throw error;

        await supabase.from("quote_items").delete().eq("quote_id", editId);

        if (items.length > 0) {
          const { error: itemsError } = await supabase.from("quote_items").insert(
            items.map((item) => ({
              quote_id: editId,
              product_id: item.product_id || null,
              name: item.name,
              sku: item.sku || null,
              unit_price: item.unit_price,
              quantity: item.quantity,
              line_total: item.line_total,
            }))
          );
          if (itemsError) throw itemsError;
        }
        return editId;
      } else {
        const { data, error } = await supabase
          .from("quotes")
          .insert({
            store_owner_id: user.id,
            customer_name: quote.customer_name!,
            customer_id: quote.customer_id || null,
            customer_phone: quote.customer_phone || null,
            customer_email: quote.customer_email || null,
            delivery_address: quote.delivery_address || null,
            notes: quote.notes || null,
            valid_until: quote.valid_until!,
            subtotal: quote.subtotal!,
            discount: quote.discount || 0,
            shipping_fee: quote.shipping_fee || 0,
            total: quote.total!,
            payment_method_hint: quote.payment_method_hint || null,
            status: quote.status || "open",
          })
          .select()
          .single();
        if (error) throw error;

        if (items.length > 0) {
          const { error: itemsError } = await supabase.from("quote_items").insert(
            items.map((item) => ({
              quote_id: data.id,
              product_id: item.product_id || null,
              name: item.name,
              sku: item.sku || null,
              unit_price: item.unit_price,
              quantity: item.quantity,
              line_total: item.line_total,
            }))
          );
          if (itemsError) throw itemsError;
        }

        // Auto-create public link
        await supabase.from("quote_public_links").insert({ quote_id: data.id });

        return data.id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Sucesso", description: "Orçamento salvo com sucesso!" });
    },
    onError: (err: any) => {
      console.error("QUOTE_SAVE_ERROR", { message: err?.message, details: err?.details, hint: err?.hint, code: err?.code });
      toast({ title: "Erro ao salvar orçamento", description: err?.message || "Erro desconhecido. Tente novamente.", variant: "destructive" });
    },
  });
};

export const useUpdateQuoteStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: string }) => {
      const { error } = await supabase.from("quotes").update({ status }).eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Status atualizado", description: "O status do orçamento foi atualizado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao atualizar status.", variant: "destructive" });
    },
  });
};

export const useDeleteQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Sucesso", description: "Orçamento excluído." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao excluir orçamento.", variant: "destructive" });
    },
  });
};

export const useConvertQuoteToOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quoteId,
      paymentMethod,
      useCurrentPrices,
    }: {
      quoteId: string;
      paymentMethod: string;
      useCurrentPrices: boolean;
    }) => {
      // Server-side, atomic: creates the order, reserves stock and marks the quote converted.
      const { data: order, error } = await supabase.rpc("convert_quote_to_order", {
        p_quote_id: quoteId,
        p_payment_method: paymentMethod,
        p_use_current_prices: useCurrentPrices,
      });
      if (error) throw error;
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
      toast({ title: "Convertido!", description: "Orçamento convertido em pedido com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao converter orçamento.", variant: "destructive" });
    },
  });
};

export const useQuotePublicLink = (quoteId: string | null) => {
  return useQuery({
    queryKey: ["quote-public-link", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const { data, error } = await supabase
        .from("quote_public_links")
        .select("*")
        .eq("quote_id", quoteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });
};
