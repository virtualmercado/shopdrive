import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ChevronRight, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

const CustomerAccount = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useCustomerAuth();
  const { toast } = useToast();

  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/loja/${storeSlug}/auth`, { replace: true });
    }
  }, [user, authLoading, navigate, storeSlug]);

  useEffect(() => {
    const fetchData = async () => {
      if (!storeSlug || !user) return;

      // Fetch store profile
      const { data: store } = await supabase
        .from('profiles')
        .select('*')
        .eq('store_slug', storeSlug)
        .single();

      if (store) setStoreProfile(store);

      // Fetch customer profile
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCustomerProfile(profile as CustomerProfile);
      }

      // Fetch orders for this customer in this store
      if (store) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, order_number, created_at, status, total_amount')
          .eq('customer_id', user.id)
          .eq('store_owner_id', store.id)
          .order('created_at', { ascending: false });

        if (orderData) setOrders(orderData);
      }

      setLoading(false);
    };

    fetchData();
  }, [storeSlug, user]);

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingOrderItems(true);

    const { data } = await supabase
      .from('order_items')
      .select('id, product_name, quantity, product_price, subtotal')
      .eq('order_id', order.id);

    if (data) setOrderItems(data);
    setLoadingOrderItems(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate(`/loja/${storeSlug}`);
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

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    if (numbers.length === 10) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
    return phone;
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return '';
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length === 11) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
    }
    return cpf;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: storeProfile?.font_family || 'Inter' }}>
      {/* Simple Header */}
      <header 
        className="border-b py-4 px-4"
        style={{ 
          backgroundColor: storeProfile?.secondary_color || '#FFFFFF',
          color: storeProfile?.footer_text_color || '#000000'
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <Link to={`/loja/${storeSlug}`}>
            {storeProfile?.store_logo_url ? (
              <img 
                src={storeProfile.store_logo_url} 
                alt={storeProfile.store_name || 'Logo da loja'} 
                className="h-10 object-contain"
              />
            ) : (
              <span className="font-semibold text-lg">{storeProfile?.store_name || 'Loja'}</span>
            )}
          </Link>
          <Link 
            to={`/loja/${storeSlug}`} 
            className="text-sm flex items-center gap-1 hover:underline"
            style={{ color: storeProfile?.footer_text_color || '#000000' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Minha Conta</h1>

        {/* Customer Data Section */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Dados do Cliente</h2>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Nome</Label>
              <p className="font-medium">{customerProfile?.full_name || '-'}</p>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">E-mail</Label>
              <p className="font-medium">{customerProfile?.email || '-'}</p>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Telefone</Label>
              <p className="font-medium">{formatPhone(customerProfile?.phone || '') || '-'}</p>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">CPF</Label>
              <p className="font-medium">{formatCpf(customerProfile?.cpf || '') || '-'}</p>
            </div>
          </div>
        </section>

        {/* Orders Section */}
        <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Meus Pedidos</h2>
          
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Você ainda não fez nenhum pedido.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
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
                        {new Date(order.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                      </p>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sair da conta
        </Button>
      </main>

      {/* Simple Footer */}
      {storeProfile && (
        <footer 
          className="py-6 px-4 text-center text-sm"
          style={{ 
            backgroundColor: storeProfile.footer_bg_color || '#1a1a1a',
            color: storeProfile.footer_text_color || '#ffffff'
          }}
        >
          <p>© {new Date().getFullYear()} {storeProfile.store_name}. Todos os direitos reservados.</p>
          <p className="text-xs mt-2 opacity-70">Desenvolvido com VirtualMercado</p>
        </footer>
      )}

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Detalhes do Pedido {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          
          {loadingOrderItems ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Qtd: {item.quantity} x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.product_price)}
                      </p>
                    </div>
                    <p className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
              
              {selectedOrder && (
                <div className="flex justify-between pt-4 border-t font-bold text-lg">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOrder.total_amount)}</span>
                </div>
              )}
              
              {selectedOrder && (
                <div className="pt-2">
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerAccount;
