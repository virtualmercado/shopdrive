import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Package, MapPin, LogOut, Plus, Trash2, Edit2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface CustomerAddress {
  id: string;
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
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
  const { user, loading: authLoading, signOut, updatePassword } = useCustomerAuth();
  const { toast } = useToast();

  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    recipient_name: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

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
        .select('id, store_name, store_logo_url, primary_color, button_bg_color, button_text_color, button_border_style, font_family, font_weight')
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
        setCustomerProfile(profile);
        setFullName(profile.full_name);
        setPhone(profile.phone || "");
      }

      // Fetch addresses
      const { data: addrs } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false });

      if (addrs) setAddresses(addrs);

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

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('customer_profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados salvos!", description: "Suas informações foram atualizadas." });
    }

    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await updatePassword(newPassword);
    if (!error) {
      setNewPassword("");
      setConfirmNewPassword("");
    }
    setSaving(false);
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    setSaving(true);

    const addressData = {
      ...addressForm,
      customer_id: user.id,
    };

    if (editingAddress) {
      const { error } = await supabase
        .from('customer_addresses')
        .update(addressData)
        .eq('id', editingAddress.id);

      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Endereço atualizado!" });
        const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false });
        if (data) setAddresses(data);
      }
    } else {
      const { error } = await supabase
        .from('customer_addresses')
        .insert(addressData);

      if (error) {
        toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Endereço adicionado!" });
        const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false });
        if (data) setAddresses(data);
      }
    }

    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressForm({ recipient_name: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
    setSaving(false);
  };

  const handleDeleteAddress = async (id: string) => {
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setAddresses(addresses.filter(a => a.id !== id));
      toast({ title: "Endereço excluído!" });
    }
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setEditingAddress(address);
    setAddressForm({
      recipient_name: address.recipient_name,
      cep: address.cep,
      street: address.street,
      number: address.number,
      complement: address.complement || "",
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
    });
    setShowAddressForm(true);
  };

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: storeProfile?.font_family || 'Inter' }}>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={`/loja/${storeSlug}`} className="flex items-center gap-2">
            {storeProfile?.store_logo_url ? (
              <img src={storeProfile.store_logo_url} alt={storeProfile.store_name} className="h-10 object-contain" />
            ) : (
              <span className="font-semibold text-lg">{storeProfile?.store_name}</span>
            )}
          </Link>
          <Link to={`/loja/${storeSlug}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Minha Conta</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Dados</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Endereços</span>
            </TabsTrigger>
            <TabsTrigger value="logout" className="flex items-center gap-2 text-red-600">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Dados do Cliente</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      value={customerProfile?.email || ""}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-md font-semibold mb-4">Alterar senha</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
                    <Input
                      id="confirmNewPassword"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={handleChangePassword}
                  disabled={saving || !newPassword}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
                >
                  Alterar senha
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Meus Pedidos</h2>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Você ainda não fez nenhum pedido.</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => handleViewOrder(order)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Meus Endereços</h2>
                <Button
                  size="sm"
                  onClick={() => { setShowAddressForm(true); setEditingAddress(null); setAddressForm({ recipient_name: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" }); }}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {showAddressForm && (
                <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                  <h3 className="font-semibold mb-4">{editingAddress ? "Editar endereço" : "Novo endereço"}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Nome do destinatário</Label>
                      <Input value={addressForm.recipient_name} onChange={(e) => setAddressForm({ ...addressForm, recipient_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input value={addressForm.cep} onChange={(e) => setAddressForm({ ...addressForm, cep: e.target.value })} maxLength={9} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} maxLength={2} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Rua / Avenida</Label>
                      <Input value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input value={addressForm.number} onChange={(e) => setAddressForm({ ...addressForm, number: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input value={addressForm.complement} onChange={(e) => setAddressForm({ ...addressForm, complement: e.target.value })} placeholder="Opcional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input value={addressForm.neighborhood} onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleSaveAddress} disabled={saving} style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}>
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowAddressForm(false); setEditingAddress(null); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {addresses.length === 0 && !showAddressForm ? (
                <p className="text-muted-foreground text-center py-8">Nenhum endereço cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div key={address.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{address.recipient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {address.street}, {address.number}
                          {address.complement && `, ${address.complement}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {address.neighborhood} - {address.city}/{address.state}
                        </p>
                        <p className="text-sm text-muted-foreground">CEP: {address.cep}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditAddress(address)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteAddress(address.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Logout Tab */}
          <TabsContent value="logout">
            <Card className="p-6 text-center">
              <LogOut className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h2 className="text-lg font-semibold mb-2">Sair da conta</h2>
              <p className="text-muted-foreground mb-6">Tem certeza que deseja sair da sua conta?</p>
              <Button variant="destructive" onClick={handleLogout}>
                Sair da conta
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data:</span>
              <span>{selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedOrder?.status || '')}`}>
                {getStatusLabel(selectedOrder?.status || '')}
              </span>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Produtos</h4>
              {loadingOrderItems ? (
                <p className="text-muted-foreground text-center py-4">Carregando...</p>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t pt-4 flex justify-between font-bold">
              <span>Total</span>
              <span>{selectedOrder && new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOrder.total_amount)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerAccount;
