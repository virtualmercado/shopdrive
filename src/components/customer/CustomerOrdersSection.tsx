import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Package, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  customer_address: string | null;
  delivery_method: string | null;
  payment_method: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface CustomerOrdersSectionProps {
  storeProfile: any;
  userId: string;
}

const CustomerOrdersSection = ({ storeProfile, userId }: CustomerOrdersSectionProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [userId, storeProfile?.id]);

  const fetchOrders = async () => {
    if (!userId || !storeProfile?.id) return;

    const { data } = await supabase
      .from('orders')
      .select('id, order_number, created_at, status, total_amount, customer_address, delivery_method, payment_method')
      .eq('customer_id', userId)
      .eq('store_owner_id', storeProfile.id)
      .order('created_at', { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingItems(true);

    const { data } = await supabase
      .from('order_items')
      .select('id, product_name, quantity, product_price, subtotal')
      .eq('order_id', order.id);

    if (data) setOrderItems(data);
    setLoadingItems(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pedido recebido",
      confirmed: "Confirmado",
      processing: "Em preparo",
      shipped: "Enviado",
      delivered: "Entregue",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-purple-100 text-purple-800",
      shipped: "bg-indigo-100 text-indigo-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return '-';
    const labels: Record<string, string> = {
      'credit': 'Cartão de Crédito',
      'debit': 'Cartão de Débito',
      'pix': 'PIX',
      'whatsapp': 'WhatsApp',
    };
    return labels[method] || method;
  };

  const getDeliveryMethodLabel = (method: string | null) => {
    if (!method) return '-';
    const labels: Record<string, string> = {
      'delivery': 'Entrega',
      'pickup': 'Retirada no local',
      'correios': 'Correios',
      'melhor_envio': 'Melhor Envio',
      'free': 'Frete Grátis',
    };
    return labels[method] || method;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando...</div>;
  }

  const lastOrder = orders[0];
  const previousOrders = orders.slice(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meus Pedidos</h1>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">Nenhum pedido realizado</h3>
          <p className="text-muted-foreground">
            Você ainda não fez nenhum pedido nesta loja.
          </p>
        </div>
      ) : (
        <>
          {/* Last Order */}
          {lastOrder && (
            <section className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Último Pedido
              </h2>
              
              <div 
                className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleViewOrder(lastOrder)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-lg">{lastOrder.order_number || `#${lastOrder.id.slice(0, 8)}`}</p>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(lastOrder.status)}`}>
                        {getStatusLabel(lastOrder.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(lastOrder.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-lg">
                      {formatCurrency(lastOrder.total_amount)}
                    </p>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Previous Orders */}
          {previousOrders.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Pedidos Anteriores</h2>
              
              <div className="space-y-3">
                {previousOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleViewOrder(order)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-semibold">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">
                          {formatCurrency(order.total_amount)}
                        </p>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes do Pedido {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          
          {loadingItems ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedOrder && formatDate(selectedOrder.created_at)}
                </span>
                {selectedOrder && (
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Itens do pedido</h4>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {item.quantity} x {formatCurrency(item.product_price)}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(item.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder?.customer_address && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Endereço de entrega</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_address}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Forma de pagamento</span>
                  <span>{getPaymentMethodLabel(selectedOrder?.payment_method || null)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Método de entrega</span>
                  <span>{getDeliveryMethodLabel(selectedOrder?.delivery_method || null)}</span>
                </div>
              </div>
              
              {selectedOrder && (
                <div className="flex justify-between pt-4 border-t font-bold text-lg">
                  <span>Total</span>
                  <span style={{ color: buttonBgColor }}>{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerOrdersSection;
