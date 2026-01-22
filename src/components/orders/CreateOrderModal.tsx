import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Trash2, Save, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  stock: number;
  image_url: string | null;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
}

interface CustomerAddress {
  id: string;
  customer_id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  is_default: boolean | null;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PaymentSettings {
  whatsapp_enabled: boolean;
  whatsapp_accepts_cash: boolean;
  whatsapp_accepts_credit: boolean;
  whatsapp_accepts_debit: boolean;
  whatsapp_accepts_pix: boolean;
  mercadopago_enabled: boolean;
  pagbank_enabled: boolean;
}

interface ShippingRule {
  id: string;
  rule_name: string;
  shipping_fee: number;
  is_active: boolean;
}

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: () => void;
  editOrder?: any;
}

export const CreateOrderModal = ({
  open,
  onOpenChange,
  onOrderCreated,
  editOrder,
}: CreateOrderModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Data lists
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  
  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [selectedShipping, setSelectedShipping] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [notes, setNotes] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  
  useEffect(() => {
    if (open && user) {
      fetchData();
    }
  }, [open, user]);

  useEffect(() => {
    if (editOrder && open) {
      // Pre-populate form with edit order data
      setSelectedCustomerId(editOrder.customer_id || "");
      setNotes(editOrder.notes || "");
      setSelectedPaymentMethod(editOrder.payment_method || "");
      setShippingFee(editOrder.delivery_fee || 0);
      setCustomerAddress(editOrder.customer_address || "");
      
      // Load order items
      if (editOrder.order_items) {
        setOrderItems(editOrder.order_items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.product_price,
          subtotal: item.subtotal,
        })));
      }
    } else if (!editOrder && open) {
      // Reset form for new order
      resetForm();
    }
  }, [editOrder, open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, price, promotional_price, stock, image_url")
        .eq("user_id", user!.id)
        .order("name");
      
      setProducts(productsData || []);

      // Fetch customers
      const { data: storeCustomers } = await supabase
        .from("store_customers")
        .select("customer_id")
        .eq("store_owner_id", user!.id);

      if (storeCustomers && storeCustomers.length > 0) {
        const customerIds = storeCustomers.map(sc => sc.customer_id);
        const { data: customerProfiles } = await supabase
          .from("customer_profiles")
          .select("id, full_name, email, phone, cpf")
          .in("id", customerIds);
        
        setCustomers(customerProfiles || []);

        // Fetch customer addresses
        const { data: addressesData } = await supabase
          .from("customer_addresses")
          .select("*")
          .in("customer_id", customerIds);
        
        setCustomerAddresses(addressesData || []);
      }

      // Fetch payment settings
      const { data: paymentData } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      setPaymentSettings(paymentData);

      // Fetch shipping rules
      const { data: shippingData } = await supabase
        .from("shipping_rules")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true);
      
      setShippingRules(shippingData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId("");
    setCustomerSearch("");
    setProductSearch("");
    setOrderItems([]);
    setSelectedPaymentMethod("");
    setSelectedShipping("");
    setShippingFee(0);
    setNotes("");
    setCustomerAddress("");
  };

  const handleAddProduct = (product: Product) => {
    const existingIndex = orderItems.findIndex(item => item.product_id === product.id);
    const effectivePrice = product.promotional_price || product.price;
    
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].subtotal = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: effectivePrice,
        subtotal: effectivePrice,
      }]);
    }
    setProductSearch("");
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const updated = [...orderItems];
    updated[index].quantity = newQuantity;
    updated[index].subtotal = newQuantity * updated[index].unit_price;
    setOrderItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleShippingChange = (ruleId: string) => {
    setSelectedShipping(ruleId);
    const rule = shippingRules.find(r => r.id === ruleId);
    setShippingFee(rule?.shipping_fee || 0);
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal + shippingFee;

  const getPaymentMethods = () => {
    const methods: { value: string; label: string }[] = [];
    
    if (paymentSettings?.whatsapp_enabled) {
      if (paymentSettings.whatsapp_accepts_pix) methods.push({ value: "pix", label: "PIX" });
      if (paymentSettings.whatsapp_accepts_cash) methods.push({ value: "dinheiro", label: "Dinheiro" });
      if (paymentSettings.whatsapp_accepts_credit) methods.push({ value: "credito", label: "Cartão de Crédito" });
      if (paymentSettings.whatsapp_accepts_debit) methods.push({ value: "debito", label: "Cartão de Débito" });
    }
    
    if (paymentSettings?.mercadopago_enabled) {
      if (!methods.find(m => m.value === "pix")) methods.push({ value: "pix", label: "PIX" });
      if (!methods.find(m => m.value === "credito")) methods.push({ value: "credito", label: "Cartão de Crédito" });
    }
    
    if (paymentSettings?.pagbank_enabled) {
      if (!methods.find(m => m.value === "pix")) methods.push({ value: "pix", label: "PIX" });
      if (!methods.find(m => m.value === "credito")) methods.push({ value: "credito", label: "Cartão de Crédito" });
    }
    
    // Default if no payment settings
    if (methods.length === 0) {
      methods.push(
        { value: "pix", label: "PIX" },
        { value: "dinheiro", label: "Dinheiro" },
        { value: "credito", label: "Cartão de Crédito" },
        { value: "debito", label: "Cartão de Débito" }
      );
    }
    
    return methods;
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Get customer's default address or first available address
  const getCustomerDefaultAddress = (customerId: string): string => {
    const addresses = customerAddresses.filter(a => a.customer_id === customerId);
    const defaultAddress = addresses.find(a => a.is_default) || addresses[0];
    
    if (!defaultAddress) return "";
    
    const parts = [
      defaultAddress.street,
      defaultAddress.number,
      defaultAddress.complement,
      defaultAddress.neighborhood,
      `${defaultAddress.city}/${defaultAddress.state}`,
      `CEP: ${defaultAddress.cep}`
    ].filter(Boolean);
    
    return parts.join(", ");
  };

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast({ title: "Erro", description: "Selecione um cliente.", variant: "destructive" });
      return;
    }
    if (orderItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto.", variant: "destructive" });
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ title: "Erro", description: "Selecione uma forma de pagamento.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (!customer) throw new Error("Cliente não encontrado");

      // Use customer's default address automatically
      const deliveryAddress = getCustomerDefaultAddress(selectedCustomerId);

      if (editOrder) {
        // Update existing order
        const { error: orderError } = await supabase
          .from("orders")
          .update({
            customer_id: selectedCustomerId,
            customer_name: customer.full_name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_address: deliveryAddress,
            payment_method: selectedPaymentMethod,
            delivery_method: selectedShipping || null,
            delivery_fee: shippingFee,
            subtotal: subtotal,
            total_amount: total,
            notes: notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editOrder.id);

        if (orderError) throw orderError;

        // Delete old items and insert new ones
        await supabase.from("order_items").delete().eq("order_id", editOrder.id);

        const orderItemsData = orderItems.map(item => ({
          order_id: editOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }));

        const { error: itemsError } = await supabase.from("order_items").insert(orderItemsData);
        if (itemsError) throw itemsError;

        toast({ title: "Sucesso", description: "Pedido atualizado com sucesso!" });
      } else {
        // Create new order
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .insert({
            store_owner_id: user!.id,
            customer_id: selectedCustomerId,
            customer_name: customer.full_name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_address: deliveryAddress,
            payment_method: selectedPaymentMethod,
            delivery_method: selectedShipping || null,
            delivery_fee: shippingFee,
            subtotal: subtotal,
            total_amount: total,
            notes: notes,
            status: "pending",
            order_source: "manual",
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderItemsData = orderItems.map(item => ({
          order_id: orderData.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }));

        const { error: itemsError } = await supabase.from("order_items").insert(orderItemsData);
        if (itemsError) throw itemsError;

        toast({ title: "Sucesso", description: "Pedido criado com sucesso!" });
      }

      onOrderCreated();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error saving order:", error);
      toast({ title: "Erro", description: "Erro ao salvar pedido.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-hidden flex min-h-0 flex-col">
        <DialogHeader>
          <DialogTitle>{editOrder ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4 overscroll-contain">
          <div className="space-y-6 py-4">
            {/* Customer Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {customerSearch && filteredCustomers.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setCustomerSearch("");
                      }}
                    >
                      <p className="font-medium">{customer.full_name}</p>
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    </div>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="font-medium">{selectedCustomer.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
                  {selectedCustomer.phone && (
                    <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                  )}
                  {getCustomerDefaultAddress(selectedCustomer.id) && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs font-medium text-muted-foreground">Endereço de entrega:</p>
                      <p className="text-sm">{getCustomerDefaultAddress(selectedCustomer.id)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Product Search and Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Produtos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {productSearch && filteredProducts.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {filteredProducts.slice(0, 8).map((product) => (
                    <div
                      key={product.id}
                      className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                      onClick={() => handleAddProduct(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          R$ {(product.promotional_price || product.price).toFixed(2)}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  ))}
                </div>
              )}

              {/* Order Items */}
              {orderItems.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-2">
                    <div className="col-span-5">Produto</div>
                    <div className="col-span-2 text-center">Qtd</div>
                    <div className="col-span-2 text-right">Unit.</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>
                  {orderItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-muted/30 rounded-lg">
                      <div className="col-span-5 font-medium truncate">{item.product_name}</div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                          className="text-center h-8"
                        />
                      </div>
                      <div className="col-span-2 text-right text-sm">
                        R$ {item.unit_price.toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right font-medium">
                        R$ {item.subtotal.toFixed(2)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {orderItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum produto adicionado</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment and Shipping */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                  <SelectTrigger 
                    className={`focus:ring-2 focus:ring-primary ${selectedPaymentMethod ? 'border-primary' : ''}`}
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPaymentMethods().map((method) => (
                      <SelectItem 
                        key={method.value} 
                        value={method.value}
                        className="focus:bg-primary/20"
                      >
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frete</Label>
                <Select value={selectedShipping} onValueChange={handleShippingChange}>
                  <SelectTrigger
                    className={`focus:ring-2 focus:ring-primary ${selectedShipping && selectedShipping !== "none" ? 'border-primary' : ''}`}
                  >
                    <SelectValue placeholder="Selecione ou sem frete" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem frete</SelectItem>
                    {shippingRules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.rule_name} - R$ {rule.shipping_fee.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações do pedido..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-right">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete:</span>
                <span>R$ {shippingFee.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : editOrder ? "Atualizar Pedido" : "Criar Pedido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
