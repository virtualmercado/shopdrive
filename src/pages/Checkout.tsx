import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Minus, Plus, Trash2, X, Tag } from "lucide-react";
import { useCoupon } from "@/hooks/useCoupon";

type DeliveryMethod = "retirada" | "entrega";
type PaymentMethod = "cartao_credito" | "cartao_debito" | "pix" | "whatsapp";

interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  delivery_method: DeliveryMethod;
  payment_method: PaymentMethod;
  notes: string;
}

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  customer_phone: z.string().trim().min(10, "Telefone inválido").max(20),
  customer_address: z.string().trim().max(500).optional(),
  delivery_method: z.enum(["retirada", "entrega"]),
  payment_method: z.enum(["cartao_credito", "cartao_debito", "pix", "whatsapp"]),
  notes: z.string().max(1000).optional(),
});

const CheckoutContent = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { cart, getTotal, clearCart, updateQuantity, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customerEmail, setCustomerEmail] = useState("");
  
  const {
    couponCode,
    setCouponCode,
    appliedCoupon,
    loading: couponLoading,
    applyCoupon,
    removeCoupon,
    recordCouponUsage,
  } = useCoupon(storeData?.id || null);

  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: "",
    customer_phone: "",
    cep: "",
    address: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    delivery_method: "entrega",
    payment_method: "pix",
    notes: "",
  });

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!storeSlug) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .single();

      if (data) {
        setStoreData(data);
      }
    };

    fetchStoreData();
  }, [storeSlug]);

  useEffect(() => {
    calculateDeliveryFee();
  }, [formData.delivery_method, cart, storeData]);

  const calculateDeliveryFee = () => {
    if (formData.delivery_method === "retirada") {
      setDeliveryFee(0);
      return;
    }

    if (!storeData) return;

    const subtotal = getTotal();

    // Frete grátis acima do valor mínimo
    if (subtotal >= (storeData.shipping_free_minimum || 100)) {
      setDeliveryFee(0);
      return;
    }

    // Frete fixo
    setDeliveryFee(storeData.shipping_fixed_fee || 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }

    // Validate required fields
    if (!formData.customer_name || !formData.customer_phone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.delivery_method === "entrega") {
      if (!formData.cep || !formData.address || !formData.number || !formData.neighborhood || !formData.city || !formData.state) {
        toast.error("Preencha todos os dados de endereço para entrega");
        return;
      }
    }

    // Validate with schema
    try {
      const addressString = formData.delivery_method === "entrega" 
        ? `${formData.address}, ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
        : storeData?.pickup_address || "Retirada na loja";

      checkoutSchema.parse({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_address: addressString,
        delivery_method: formData.delivery_method,
        payment_method: formData.payment_method,
        notes: formData.notes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      if (!storeData) {
        throw new Error("Dados da loja não encontrados");
      }

      const subtotal = getTotal();
      const couponDiscount = appliedCoupon?.isValid ? appliedCoupon.discount : 0;
      const total = Math.max(0, subtotal - couponDiscount + deliveryFee);

      const addressString = formData.delivery_method === "entrega" 
        ? `${formData.address}, ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
        : storeData.pickup_address || "Retirada na loja";

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_owner_id: storeData.id,
          customer_name: formData.customer_name,
          customer_email: "",
          customer_phone: formData.customer_phone,
          customer_address: addressString,
          delivery_method: formData.delivery_method,
          payment_method: formData.payment_method,
          subtotal,
          delivery_fee: deliveryFee,
          total_amount: total,
          status: "pending",
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new Error("Erro ao criar pedido");
      }

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_price: item.promotional_price || item.price,
        quantity: item.quantity,
        subtotal: (item.promotional_price || item.price) * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        throw new Error("Erro ao adicionar itens ao pedido");
      }

      // Send WhatsApp message for all orders
      if (storeData.whatsapp_number) {
        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR");
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        const itemsList = cart
          .map(
            (item) =>
              `  ${item.quantity}x ${item.name} - R$ ${((item.promotional_price || item.price) * item.quantity).toFixed(2)}`
          )
          .join("\n");

        const deliveryText = formData.delivery_method === "entrega" 
          ? `🚚 *Entrega*\n📍 ${addressString}`
          : `🏪 *Retirada na loja*\n📍 ${storeData.pickup_address || "Endereço não informado"}`;

        const paymentMethodText = 
          formData.payment_method === "pix" 
            ? "PIX" 
            : formData.payment_method === "cartao_credito" 
            ? "Cartão de Crédito" 
            : formData.payment_method === "cartao_debito" 
            ? "Cartão de Débito" 
            : "Combinar via WhatsApp";

        const whatsappMessage = `
🛒 *NOVO PEDIDO* ${order.order_number}

📅 ${dateStr} às ${timeStr}

👤 *Cliente*
${formData.customer_name}
📱 ${formData.customer_phone}

${deliveryText}

📦 *Itens do Pedido*
${itemsList}

💰 *Valores*
Subtotal: R$ ${subtotal.toFixed(2)}${couponDiscount > 0 ? `\nDesconto (cupom): -R$ ${couponDiscount.toFixed(2)}` : ""}
Frete: R$ ${deliveryFee.toFixed(2)}
*Total: R$ ${total.toFixed(2)}*

💳 *Pagamento*
${paymentMethodText}

${formData.notes ? `📝 *Observações*\n${formData.notes}` : ""}

🔗 Link da loja: ${window.location.origin}/loja/${storeSlug}
        `.trim();

        const cleanPhone = storeData.whatsapp_number.replace(/\D/g, "");
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, "_blank");
      }

      // Record coupon usage if applied
      if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
        await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
      }

      // Clear cart
      clearCart();
      toast.success("Pedido realizado com sucesso!");
      
      // Redirect to confirmation page
      setTimeout(() => {
        navigate(`/loja/${storeSlug}/pedido-confirmado/${order.id}`);
      }, 1000);
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Erro ao finalizar pedido");
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Carrinho vazio</h1>
          <p className="text-muted-foreground">Adicione produtos ao carrinho para continuar</p>
          <Button onClick={() => navigate(`/loja/${storeSlug}`)}>
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = getTotal();
  const couponDiscount = appliedCoupon?.isValid ? appliedCoupon.discount : 0;
  const total = Math.max(0, subtotal - couponDiscount + deliveryFee);
  const isFormValid = formData.customer_name && formData.customer_phone && 
    (formData.delivery_method === "retirada" || 
     (formData.cep && formData.address && formData.number && formData.neighborhood && formData.city && formData.state));

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Digite o código do cupom");
      return;
    }
    const result = await applyCoupon(couponCode, subtotal, customerEmail);
    if (result.isValid) {
      toast.success("Cupom aplicado com sucesso!");
    } else {
      toast.error(result.errorMessage || "Cupom inválido");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/loja/${storeSlug}`)}>
            ← Voltar para a loja
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8">Finalizar Pedido</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulário - 2 colunas */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados do Cliente */}
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <h2 className="text-xl font-semibold mb-4">Dados do Cliente</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="customer_name">Nome completo *</Label>
                    <Input
                      id="customer_name"
                      required
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData({ ...formData, customer_name: e.target.value })
                      }
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_phone">Telefone/WhatsApp *</Label>
                    <Input
                      id="customer_phone"
                      required
                      placeholder="(00) 00000-0000"
                      value={formData.customer_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, customer_phone: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Método de Entrega */}
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <h2 className="text-xl font-semibold mb-4">Método de Entrega</h2>
                
                <RadioGroup
                  value={formData.delivery_method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, delivery_method: value as DeliveryMethod })
                  }
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="retirada" id="retirada" className="peer sr-only" />
                    <Label
                      htmlFor="retirada"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <span className="text-lg font-semibold">🏪 Retirada</span>
                      <span className="text-sm text-muted-foreground">Grátis</span>
                    </Label>
                  </div>

                  <div>
                    <RadioGroupItem value="entrega" id="entrega" className="peer sr-only" />
                    <Label
                      htmlFor="entrega"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <span className="text-lg font-semibold">🚚 Entrega</span>
                      <span className="text-sm text-muted-foreground">
                        {deliveryFee === 0 ? "Frete Grátis" : `R$ ${deliveryFee.toFixed(2)}`}
                      </span>
                    </Label>
                  </div>
                </RadioGroup>

                {formData.delivery_method === "retirada" && storeData?.pickup_address && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">📍 Endereço de retirada:</p>
                    <p className="text-sm text-muted-foreground mt-1">{storeData.pickup_address}</p>
                  </div>
                )}

                {formData.delivery_method === "entrega" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="cep">CEP *</Label>
                      <Input
                        id="cep"
                        required
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="address">Endereço *</Label>
                      <Input
                        id="address"
                        required
                        placeholder="Rua, Avenida..."
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="number">Número *</Label>
                      <Input
                        id="number"
                        required
                        placeholder="123"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        placeholder="Apto, Bloco..."
                        value={formData.complement}
                        onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input
                        id="neighborhood"
                        required
                        placeholder="Bairro"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="city">Cidade *</Label>
                      <Input
                        id="city"
                        required
                        placeholder="Cidade"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="state">Estado *</Label>
                      <Input
                        id="state"
                        required
                        placeholder="UF"
                        maxLength={2}
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Método de Pagamento */}
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <h2 className="text-xl font-semibold mb-4">Método de Pagamento</h2>
                
                <RadioGroup
                  value={formData.payment_method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_method: value as PaymentMethod })
                  }
                  className="grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                  <div>
                    <RadioGroupItem value="pix" id="pix" className="peer sr-only" />
                    <Label
                      htmlFor="pix"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer h-full"
                    >
                      <span className="text-2xl mb-2">📱</span>
                      <span className="text-sm font-medium text-center">PIX</span>
                    </Label>
                  </div>

                  <div>
                    <RadioGroupItem value="cartao_credito" id="cartao_credito" className="peer sr-only" />
                    <Label
                      htmlFor="cartao_credito"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer h-full"
                    >
                      <span className="text-2xl mb-2">💳</span>
                      <span className="text-sm font-medium text-center">Crédito</span>
                    </Label>
                  </div>

                  <div>
                    <RadioGroupItem value="cartao_debito" id="cartao_debito" className="peer sr-only" />
                    <Label
                      htmlFor="cartao_debito"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer h-full"
                    >
                      <span className="text-2xl mb-2">💳</span>
                      <span className="text-sm font-medium text-center">Débito</span>
                    </Label>
                  </div>

                  <div>
                    <RadioGroupItem value="whatsapp" id="whatsapp" className="peer sr-only" />
                    <Label
                      htmlFor="whatsapp"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer h-full"
                    >
                      <span className="text-2xl mb-2">💬</span>
                      <span className="text-sm font-medium text-center">WhatsApp</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Observações */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Alguma observação sobre seu pedido?"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-2"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading || !isFormValid} 
                className="w-full" 
                size="lg"
              >
                {loading ? "Processando..." : "Finalizar Pedido"}
              </Button>
            </form>
          </div>

          {/* Resumo do Pedido - 1 coluna */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
              
              <div className="space-y-4 mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {(item.promotional_price || item.price).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-8 text-center">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        R$ {((item.promotional_price || item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cupom de Desconto */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">Cupom de Desconto</Label>
                {appliedCoupon?.isValid ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">{couponCode}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-700 hover:text-green-900 hover:bg-green-100"
                      onClick={removeCoupon}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código do cupom"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 font-mono uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                    >
                      {couponLoading ? "..." : "Aplicar"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto (cupom)</span>
                    <span>-R$ {couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Frete</span>
                  <span className={deliveryFee === 0 ? "text-green-600 font-medium" : ""}>
                    {deliveryFee === 0 ? "Grátis" : `R$ ${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                {deliveryFee === 0 && subtotal < (storeData?.shipping_free_minimum || 100) && formData.delivery_method === "entrega" && (
                  <p className="text-xs text-green-600">
                    ✓ Frete grátis aplicado!
                  </p>
                )}
              </div>

              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Checkout = () => {
  return (
    <CartProvider>
      <CheckoutContent />
    </CartProvider>
  );
};

export default Checkout;
