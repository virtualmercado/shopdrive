import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface ThermalReceiptPrintDialogProps {
  orderId: string;
  onClose: () => void;
}

const formatCurrency = (value: number) =>
  `R$ ${value.toFixed(2).replace(".", ",")}`;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Pendente", confirmed: "Confirmado", paid: "Pago",
    processing: "Em preparo", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado",
  };
  return labels[status] || status;
};

const getPaymentLabel = (method: string | null) => {
  if (!method) return null;
  const labels: Record<string, string> = {
    pix: "PIX", dinheiro: "Dinheiro", credito: "Cartão de Crédito",
    debito: "Cartão de Débito", credit: "Cartão de Crédito",
    debit: "Cartão de Débito", whatsapp: "WhatsApp",
  };
  return labels[method] || method;
};

const separator = "--------------------------------";

const ThermalReceiptPrintDialog = ({ orderId, onClose }: ThermalReceiptPrintDialogProps) => {
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !orderData) {
        setError("Pedido não encontrado.");
        setLoading(false);
        return;
      }

      setOrder(orderData);

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      setItems(itemsData || []);

      if (orderData.store_owner_id) {
        const { data: storeData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", orderData.store_owner_id)
          .maybeSingle();
        setStore(storeData);
      }

      setLoading(false);
    };
    load();
  }, [orderId]);

  useEffect(() => {
    if (!loading && order && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;

      const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
      const productsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

      const itemsHtml = items.map((item, i) => `
        <div style="margin-bottom:4px">
          <div class="item-name">${String(i + 1).padStart(2, "0")} ${item.product_name}</div>
          <div class="item-values">
            <span>${item.quantity} x ${formatCurrency(item.product_price)}</span>
            <span>${formatCurrency(item.subtotal)}</span>
          </div>
        </div>
      `).join("");

      const html = `<!DOCTYPE html>
<html><head><style>
  @page { size: 80mm auto; margin: 0; }
  body { margin: 0; padding: 0; }
  .thermal-receipt {
    width: 80mm; padding: 2mm; font-family: 'Courier New', monospace;
    font-size: 11px; color: #000; line-height: 1.4;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .separator { text-align: center; letter-spacing: -0.5px; overflow: hidden; }
  .total-line { font-size: 14px; font-weight: bold; }
  .item-name { word-break: break-word; }
  .item-values { display: flex; justify-content: space-between; }
  .footer-line { border-bottom: 1px solid #000; display: inline-block; min-width: 60%; }
</style></head><body>
<div class="thermal-receipt">
  <div class="center">
    ${store?.store_name ? `<div class="bold" style="font-size:14px">${store.store_name}</div>` : ""}
    ${store?.cnpj ? `<div>CNPJ: ${store.cnpj}</div>` : ""}
    ${store?.address ? `<div>${store.address}</div>` : ""}
    ${store?.address_city && store?.address_state ? `<div>${store.address_city} / ${store.address_state}</div>` : ""}
    ${store?.phone || store?.whatsapp_number ? `<div>Tel: ${[store.phone, store.whatsapp_number].filter(Boolean).join(" | ")}</div>` : ""}
    ${store?.email ? `<div>${store.email}</div>` : ""}
  </div>
  <div class="separator">${separator}</div>
  <div class="center bold">Pedido ${orderNumber}</div>
  <div class="center">Emissão: ${formatDate(order.created_at)}</div>
  ${order.status ? `<div class="center">Status: ${getStatusLabel(order.status)}</div>` : ""}
  <div class="separator">${separator}</div>
  <div>Cliente: ${order.customer_name}</div>
  ${order.customer_phone ? `<div>Tel: ${order.customer_phone}</div>` : ""}
  ${order.customer_address ? `<div>End: ${order.customer_address}</div>` : ""}
  ${order.notes ? `<div>Obs: ${order.notes}</div>` : ""}
  <div class="separator">${separator}</div>
  ${itemsHtml}
  <div class="separator">${separator}</div>
  <div class="item-values"><span>Subtotal:</span><span>${formatCurrency(productsTotal)}</span></div>
  ${order.discount_amount && order.discount_amount > 0 ? `<div class="item-values"><span>Desconto:</span><span>-${formatCurrency(order.discount_amount)}</span></div>` : ""}
  ${order.delivery_fee && order.delivery_fee > 0 ? `<div class="item-values"><span>Frete:</span><span>${formatCurrency(order.delivery_fee)}</span></div>` : ""}
  <div class="item-values total-line" style="margin-top:4px"><span>TOTAL:</span><span>${formatCurrency(order.total_amount)}</span></div>
  ${order.payment_method ? `<div>Pagamento: ${getPaymentLabel(order.payment_method)}</div>` : ""}
  <div class="separator">${separator}</div>
  <div class="center" style="margin-top:4px">Obrigado pela compra!</div>
  <div style="margin-top:8px">Recebi em: ____/____/_____</div>
  <div style="margin-top:8px">Assinatura: <span class="footer-line">&nbsp;</span></div>
  <div style="margin-top:12px"></div>
</div>
</body></html>`;

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframeRef.current?.contentWindow?.print();
        setTimeout(() => onClose(), 500);
      }, 300);
    }
  }, [loading, order, items, store, onClose]);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, fontFamily: "sans-serif" }}>
          Carregando cupom...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, fontFamily: "sans-serif", textAlign: "center" }}>
          <p>{error}</p>
          <button onClick={onClose} style={{ marginTop: 12, padding: "6px 20px", cursor: "pointer" }}>Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      style={{ position: "fixed", left: "-9999px", top: 0, width: "80mm", height: "auto" }}
      title="thermal-receipt-print"
    />
  );
};

export default ThermalReceiptPrintDialog;
