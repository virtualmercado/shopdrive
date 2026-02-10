import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface ThermalReceipt80mmProps {
  orderId: string;
}

const separator = "--------------------------------";

const formatCurrency = (value: number) =>
  `R$ ${value.toFixed(2).replace(".", ",")}`;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    paid: "Pago",
    processing: "Em preparo",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };
  return labels[status] || status;
};

const getPaymentLabel = (method: string | null) => {
  if (!method) return null;
  const labels: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    credito: "Cartão de Crédito",
    debito: "Cartão de Débito",
    credit: "Cartão de Crédito",
    debit: "Cartão de Débito",
    whatsapp: "WhatsApp",
  };
  return labels[method] || method;
};

const ThermalReceipt80mm = ({ orderId }: ThermalReceipt80mmProps) => {
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Wait for Supabase session to be restored (critical for new tab/window)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Listen for session restoration (localStorage may take a moment)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            if (newSession) {
              subscription.unsubscribe();
              await loadOrder();
            }
          }
        );
        // Timeout: if no session after 3s, show auth error
        setTimeout(() => {
          subscription.unsubscribe();
          setAuthError(true);
          setLoading(false);
        }, 3000);
        return;
      }

      await loadOrder();
    };

    const loadOrder = async () => {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !orderData) {
        console.error("THERMAL_RECEIPT_ORDER_FETCH", { orderError, orderId });
        setLoading(false);
        return;
      }

      setOrder(orderData);

      // Fetch items
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      setItems(itemsData || []);

      // Fetch store
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

    fetchData();
  }, [orderId]);

  useEffect(() => {
    if (!loading && order) {
      // Auto-print after render
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, order]);

  if (loading) {
    return (
      <div className="thermal-receipt">
        <p>Carregando pedido...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="thermal-receipt">
        <p>Sessão expirada. Faça login novamente e tente imprimir.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="thermal-receipt">
        <p>Pedido não encontrado. Verifique se você está logado como o lojista dono deste pedido.</p>
      </div>
    );
  }

  const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
  const productsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <>
      <style>{`
        @media screen {
          body { background: #f0f0f0; display: flex; justify-content: center; padding: 20px; }
          .thermal-receipt { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          .no-print { display: block !important; }
        }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .thermal-receipt { box-shadow: none; }
        }
        .thermal-receipt {
          width: 80mm;
          padding: 2mm;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #000;
          line-height: 1.4;
        }
        .thermal-receipt .center { text-align: center; }
        .thermal-receipt .bold { font-weight: bold; }
        .thermal-receipt .separator { text-align: center; letter-spacing: -0.5px; overflow: hidden; }
        .thermal-receipt .total-line { font-size: 14px; font-weight: bold; }
        .thermal-receipt .item-name { word-break: break-word; }
        .thermal-receipt .item-values { display: flex; justify-content: space-between; }
        .thermal-receipt .footer-line { border-bottom: 1px solid #000; display: inline-block; min-width: 60%; }
      `}</style>

      <div className="no-print" style={{ width: "80mm", marginBottom: 10, textAlign: "center", display: "none" }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 24px",
            fontSize: 14,
            cursor: "pointer",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            marginRight: 8,
          }}
        >
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: "8px 24px",
            fontSize: 14,
            cursor: "pointer",
            background: "#eee",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: 4,
          }}
        >
          Fechar
        </button>
      </div>

      <div className="thermal-receipt">
        {/* HEADER - Store info */}
        <div className="center">
          {store?.store_name && <div className="bold" style={{ fontSize: 14 }}>{store.store_name}</div>}
          {store?.cnpj && <div>CNPJ: {store.cnpj}</div>}
          {store?.address && <div>{store.address}</div>}
          {(store?.address_city && store?.address_state) && (
            <div>{store.address_city} / {store.address_state}</div>
          )}
          {(store?.phone || store?.whatsapp_number) && (
            <div>Tel: {[store.phone, store.whatsapp_number].filter(Boolean).join(" | ")}</div>
          )}
          {store?.email && <div>{store.email}</div>}
        </div>
        <div className="separator">{separator}</div>

        {/* ORDER ID */}
        <div className="center bold">Pedido {orderNumber}</div>
        <div className="center">Emissão: {formatDate(order.created_at)}</div>
        {order.status && <div className="center">Status: {getStatusLabel(order.status)}</div>}
        <div className="separator">{separator}</div>

        {/* CUSTOMER */}
        <div>Cliente: {order.customer_name}</div>
        {order.customer_phone && <div>Tel: {order.customer_phone}</div>}
        {order.customer_address && <div>End: {order.customer_address}</div>}
        {order.notes && <div>Obs: {order.notes}</div>}
        <div className="separator">{separator}</div>

        {/* ITEMS */}
        {items.map((item, index) => (
          <div key={index} style={{ marginBottom: 4 }}>
            <div className="item-name">
              {String(index + 1).padStart(2, "0")} {item.product_name}
            </div>
            <div className="item-values">
              <span>{item.quantity} x {formatCurrency(item.product_price)}</span>
              <span>{formatCurrency(item.subtotal)}</span>
            </div>
          </div>
        ))}
        <div className="separator">{separator}</div>

        {/* TOTALS */}
        <div className="item-values">
          <span>Subtotal:</span>
          <span>{formatCurrency(productsTotal)}</span>
        </div>
        {order.discount_amount && order.discount_amount > 0 && (
          <div className="item-values">
            <span>Desconto:</span>
            <span>-{formatCurrency(order.discount_amount)}</span>
          </div>
        )}
        {order.delivery_fee && order.delivery_fee > 0 && (
          <div className="item-values">
            <span>Frete:</span>
            <span>{formatCurrency(order.delivery_fee)}</span>
          </div>
        )}
        <div className="item-values total-line" style={{ marginTop: 4 }}>
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total_amount)}</span>
        </div>
        {order.payment_method && (
          <div>Pagamento: {getPaymentLabel(order.payment_method)}</div>
        )}
        <div className="separator">{separator}</div>

        {/* FOOTER */}
        <div className="center" style={{ marginTop: 4 }}>Obrigado pela compra!</div>
        <div style={{ marginTop: 8 }}>Recebi em: ____/____/_____</div>
        <div style={{ marginTop: 8 }}>
          Assinatura: <span className="footer-line">&nbsp;</span>
        </div>
        <div style={{ marginTop: 12 }} />
      </div>
    </>
  );
};

export default ThermalReceipt80mm;
