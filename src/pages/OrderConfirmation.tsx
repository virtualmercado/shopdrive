import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, ExternalLink, FileText, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface OrderData {
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_method: string;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  notes: string | null;
  boleto_barcode: string | null;
  boleto_digitable_line: string | null;
  boleto_url: string | null;
  boleto_expires_at: string | null;
  boleto_payment_status: string | null;
  store_owner_id: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface StoreData {
  primary_color: string | null;
  address: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
}

const OrderConfirmation = () => {
  const { storeSlug, orderId } = useParams<{ storeSlug: string; orderId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [storeData, setStoreData] = useState<StoreData | null>(null);

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) return;

      try {
        // Fetch order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (orderError || !order) {
          throw new Error("Pedido não encontrado");
        }

        setOrderData(order);

        // Fetch store data for primary color and address
        const { data: store } = await supabase
          .from("profiles")
          .select("primary_color, address, address_number, address_neighborhood, address_city, address_state, address_zip_code")
          .eq("id", order.store_owner_id)
          .single();

        if (store) {
          setStoreData(store);
        }

        // Fetch order items
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId);

        if (itemsError) {
          throw new Error("Erro ao carregar itens do pedido");
        }

        setOrderItems(items || []);
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

  const primaryColor = storeData?.primary_color || null;

  const getGoogleMapsUrl = () => {
    if (!storeData) return null;
    
    const parts = [
      storeData.address,
      storeData.address_number,
      storeData.address_neighborhood,
      storeData.address_city,
      storeData.address_state,
      storeData.address_zip_code
    ].filter(Boolean);
    
    if (parts.length === 0) return null;
    
    const fullAddress = parts.join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  };

  const mapsUrl = getGoogleMapsUrl();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
          <Button onClick={() => navigate(`/loja/${storeSlug}`)}>
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  const orderDate = new Date(orderData.created_at);
  const dateStr = orderDate.toLocaleDateString("pt-BR");
  const timeStr = orderDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pedido Confirmado!
          </h1>
          <p className="text-lg text-gray-600">
            Seu pedido foi recebido com sucesso
          </p>
        </div>

        {/* Order Info Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b">
            <div>
              <p className="text-sm text-gray-600">Número do Pedido</p>
              <p 
                className="text-2xl font-bold"
                style={{ color: primaryColor || 'hsl(var(--primary))' }}
              >
                {orderData.order_number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Data e Hora</p>
              <p className="font-medium">{dateStr}</p>
              <p className="text-sm text-gray-600">{timeStr}</p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Dados do Cliente</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">Nome:</span> {orderData.customer_name}</p>
              <p><span className="text-gray-600">Telefone:</span> {orderData.customer_phone}</p>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">
              {orderData.delivery_method === "entrega" ? "Endereço de Entrega" : "Retirada"}
            </h3>
            <p className="text-sm text-gray-700">{orderData.customer_address}</p>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Itens do Pedido</h3>
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-600">
                      Quantidade: {item.quantity} x R$ {item.product_price.toFixed(2)}
                    </p>
                  </div>
                  <p className="font-semibold">R$ {item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>R$ {orderData.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Frete</span>
              <span className={orderData.delivery_fee === 0 ? "text-green-600 font-medium" : ""}>
                {orderData.delivery_fee === 0 ? "Grátis" : `R$ ${orderData.delivery_fee.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-bold">Total</span>
              <span 
                className="text-2xl font-bold"
                style={{ color: primaryColor || 'hsl(var(--primary))' }}
              >
                R$ {orderData.total_amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Forma de Pagamento</p>
            <p className="font-medium">
              {orderData.payment_method === "pix" && "PIX"}
              {orderData.payment_method === "cartao_credito" && "Cartão de Crédito"}
              {orderData.payment_method === "cartao_debito" && "Cartão de Débito"}
              {orderData.payment_method === "whatsapp" && "Combinar via WhatsApp"}
              {orderData.payment_method === "boleto" && "Boleto Bancário"}
            </p>
          </div>

          {/* Boleto Payment Section */}
          {orderData.payment_method === "boleto" && orderData.boleto_url && (
            <div className="mt-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-6 h-6 text-yellow-700" />
                <h3 className="font-semibold text-yellow-900">Boleto Bancário</h3>
              </div>
              
              {orderData.boleto_payment_status === "approved" ? (
                <div className="p-4 bg-green-100 rounded-lg mb-4">
                  <p className="text-green-800 font-medium flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Pagamento Confirmado!
                  </p>
                </div>
              ) : (
                <>
                  {orderData.boleto_expires_at && (
                    <p className="text-sm text-yellow-800 mb-4">
                      <strong>Vencimento:</strong> {new Date(orderData.boleto_expires_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}

                  {orderData.boleto_digitable_line && (
                    <div className="mb-4">
                      <p className="text-sm text-yellow-800 font-medium mb-2">Linha digitável:</p>
                      <div className="flex items-center gap-2 bg-white p-3 rounded border border-yellow-300">
                        <code className="flex-1 text-xs sm:text-sm break-all font-mono text-gray-800">
                          {orderData.boleto_digitable_line}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(orderData.boleto_digitable_line || "");
                            toast.success("Linha digitável copiada!");
                          }}
                          className="shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => window.open(orderData.boleto_url || "", "_blank")}
                      className="flex-1 gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir Boleto
                    </Button>
                    {orderData.boleto_digitable_line && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(orderData.boleto_digitable_line || "");
                          toast.success("Código de barras copiado!");
                        }}
                        className="flex-1 gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar Código
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {orderData.notes && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Observações</p>
              <p className="text-sm">{orderData.notes}</p>
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Próximos Passos</h3>
          {orderData.payment_method === "boleto" && orderData.boleto_url ? (
            <p className="text-sm text-blue-800">
              Efetue o pagamento do boleto até a data de vencimento. Após a confirmação do pagamento 
              (que pode levar até 3 dias úteis), seu pedido será processado e a loja entrará em contato 
              para informar sobre a entrega.
            </p>
          ) : (
            <p className="text-sm text-blue-800">
              Em breve, a loja entrará em contato com você para confirmar os detalhes do pedido e 
              informar sobre o pagamento e entrega. Fique atento ao seu WhatsApp e telefone!
            </p>
          )}
        </div>

        {/* Store Location Section */}
        {mapsUrl && orderData.delivery_method === "retirada" && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            aria-label="Abrir localização da loja no Google Maps"
          >
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Localização:</h3>
              <div className="relative h-32 bg-gray-100 rounded-lg overflow-hidden">
                {/* Static map preview background */}
                <div className="absolute inset-0 bg-gray-50">
                  {/* Horizontal streets (yellow/beige) */}
                  <div className="absolute top-[40%] left-0 right-0 h-2 bg-amber-200"></div>
                  <div className="absolute top-[60%] left-0 right-0 h-2 bg-amber-200"></div>
                  
                  {/* Vertical streets (green borders) */}
                  <div className="absolute top-0 bottom-0 left-[10%] w-1.5 bg-emerald-400"></div>
                  <div className="absolute top-0 bottom-0 left-[25%] w-1.5 bg-emerald-400"></div>
                  <div className="absolute top-0 bottom-0 left-[55%] w-1 bg-emerald-400"></div>
                  <div className="absolute top-0 bottom-0 right-[10%] w-1.5 bg-emerald-400"></div>
                  
                  {/* Green blocks/areas */}
                  <div className="absolute top-2 left-[12%] w-8 h-10 bg-emerald-300 rounded-sm"></div>
                  <div className="absolute top-3 right-[20%] w-10 h-8 bg-emerald-400 rounded-sm"></div>
                  <div className="absolute bottom-3 left-[15%] w-6 h-8 bg-emerald-300 rounded-sm"></div>
                  
                  {/* Blue block */}
                  <div className="absolute top-[45%] right-[25%] w-8 h-6 bg-sky-400 rounded-sm"></div>
                </div>
                
                {/* Location pin */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Pin shape */}
                    <div 
                      className="w-6 h-6 rounded-full shadow-md flex items-center justify-center"
                      style={{ backgroundColor: '#ea4335' }}
                    >
                      <div className="w-2 h-2 bg-red-800 rounded-full"></div>
                    </div>
                    {/* Pin tail */}
                    <div 
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent"
                      style={{ borderTopColor: '#ea4335' }}
                    ></div>
                  </div>
                </div>
                {/* Click hint */}
                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-600 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Abrir no Maps
                </div>
              </div>
            </div>
          </a>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => navigate(`/loja/${storeSlug}`)}
            className="flex-1"
            size="lg"
            style={{ 
              backgroundColor: primaryColor || undefined,
              borderColor: primaryColor || undefined
            }}
          >
            Voltar para a Loja
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
