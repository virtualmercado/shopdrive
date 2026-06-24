// Builds a complete itemized WhatsApp message for an order.
// Works for any store and any product (with or without variations).

export interface WhatsAppOrderItemInput {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
  variations?: Record<string, string> | null;
}

export interface WhatsAppOrderInput {
  order_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at?: string | Date | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  total_amount: number;
  delivery_method?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

const fmtBRL = (v: number) =>
  `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;

const fmtDate = (d?: string | Date | null): string => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const paymentLabel = (method?: string | null): string => {
  if (!method) return "A combinar";
  const labels: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    credito: "Cartão de Crédito",
    debito: "Cartão de Débito",
    cartao_credito: "Cartão de Crédito",
    boleto: "Boleto",
    whatsapp: "Combinar via WhatsApp",
  };
  return labels[method] || method;
};

const deliveryLabel = (method?: string | null): string => {
  if (!method) return "";
  const labels: Record<string, string> = {
    retirada: "Retirada na loja",
    motoboy: "Motoboy",
    sedex: "Sedex",
    pac: "PAC",
    mini_envios: "Mini Envios",
    entrega: "Entrega",
  };
  return labels[method] || method;
};

export const buildItemizedWhatsAppMessage = (
  order: WhatsAppOrderInput,
  items: WhatsAppOrderItemInput[],
  storeName: string = "Nossa Loja"
): string => {
  const lines: string[] = [];
  lines.push(`*Novo Pedido - ${storeName}*`);
  lines.push("");
  if (order.order_number) lines.push(`Pedido: ${order.order_number}`);
  if (order.customer_name) lines.push(`Cliente: ${order.customer_name}`);
  if (order.customer_phone) lines.push(`Contato: ${order.customer_phone}`);
  const dateStr = fmtDate(order.created_at);
  if (dateStr) lines.push(`Data: ${dateStr}`);
  lines.push("");
  lines.push("*Itens:*");

  items.forEach((it, idx) => {
    lines.push(`${idx + 1}. ${it.product_name}`);
    if (it.variations && Object.keys(it.variations).length > 0) {
      Object.entries(it.variations).forEach(([k, v]) => {
        lines.push(`   - ${k}: ${v}`);
      });
    }
    lines.push(
      `   Qtd: ${it.quantity}  |  Unit.: ${fmtBRL(it.product_price)}  |  Subtotal: ${fmtBRL(it.subtotal)}`
    );
  });

  lines.push("");
  if (order.subtotal != null) lines.push(`Subtotal: ${fmtBRL(order.subtotal)}`);
  if (order.delivery_fee != null && order.delivery_fee > 0) {
    lines.push(`Frete: ${fmtBRL(order.delivery_fee)}`);
  }
  lines.push(`*Total: ${fmtBRL(order.total_amount)}*`);

  const dl = deliveryLabel(order.delivery_method);
  if (dl) lines.push(`Entrega: ${dl}`);
  lines.push(`Pagamento: ${paymentLabel(order.payment_method)}`);

  if (order.notes) {
    lines.push("");
    lines.push(`Obs: ${order.notes}`);
  }

  lines.push("");
  lines.push("Olá! Gostaria de confirmar este pedido e combinar o pagamento.");

  return lines.join("\n");
};
