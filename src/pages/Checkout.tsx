import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  customer_phone: z.string().trim().min(10, "Telefone inválido").max(20),
  customer_address: z.string().trim().min(10, "Endereço completo é obrigatório").max(500),
  delivery_method: z.enum(["retirada", "entrega"]),
  payment_method: z.enum(["dinheiro", "pix", "cartao_debito", "cartao_credito"]),
  notes: z.string().max(1000).optional(),
});

const Checkout = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { cart, getTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    delivery_method: "retirada",
    payment_method: "pix",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    try {
      checkoutSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (cart.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }

    setLoading(true);

    try {
      // Get store data
      const { data: storeData, error: storeError } = await supabase
        .from("profiles")
        .select("id, store_name, whatsapp_number")
        .eq("store_slug", storeSlug)
        .single();

      if (storeError || !storeData) {
        throw new Error("Loja não encontrada");
      }

      const subtotal = getTotal();
      const deliveryFee = formData.delivery_method === "entrega" ? 10 : 0;
      const total = subtotal + deliveryFee;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_owner_id: storeData.id,
          customer_name: formData.customer_name,
          customer_email: "",
          customer_phone: formData.customer_phone,
          customer_address: formData.customer_address,
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

      // Format WhatsApp message
      const itemsList = cart
        .map(
          (item) =>
            `${item.quantity}x ${item.name} - R$ ${((item.promotional_price || item.price) * item.quantity).toFixed(2)}`
        )
        .join("\n");

      const whatsappMessage = `
🛒 *NOVO PEDIDO* - ${order.order_number}

👤 *Cliente:* ${formData.customer_name}
📱 *Telefone:* ${formData.customer_phone}
📍 *Endereço:* ${formData.customer_address}

📦 *Itens:*
${itemsList}

💰 *Subtotal:* R$ ${subtotal.toFixed(2)}
🚚 *Entrega:* R$ ${deliveryFee.toFixed(2)}
💵 *Total:* R$ ${total.toFixed(2)}

🚚 *Forma de entrega:* ${formData.delivery_method === "entrega" ? "Entrega" : "Retirada"}
💳 *Pagamento:* ${
        formData.payment_method === "pix"
          ? "PIX"
          : formData.payment_method === "dinheiro"
          ? "Dinheiro"
          : formData.payment_method === "cartao_debito"
          ? "Cartão de Débito"
          : "Cartão de Crédito"
      }

${formData.notes ? `📝 *Observações:* ${formData.notes}` : ""}
      `.trim();

      // Open WhatsApp
      if (storeData.whatsapp_number) {
        const cleanPhone = storeData.whatsapp_number.replace(/\D/g, "");
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, "_blank");
      }

      // Clear cart and show success
      clearCart();
      toast.success("Pedido realizado com sucesso!");
      
      // Redirect to store after 2 seconds
      setTimeout(() => {
        navigate(`/loja/${storeSlug}`);
      }, 2000);
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
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Carrinho vazio</h1>
          <Button onClick={() => navigate(`/loja/${storeSlug}`)}>
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = getTotal();
  const deliveryFee = formData.delivery_method === "entrega" ? 10 : 0;
  const total = subtotal + deliveryFee;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Finalizar Pedido</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer_name">Nome completo *</Label>
                <Input
                  id="customer_name"
                  required
                  value={formData.customer_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_name: e.target.value })
                  }
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

              <div>
                <Label htmlFor="customer_address">Endereço completo *</Label>
                <Textarea
                  id="customer_address"
                  required
                  placeholder="Rua, número, bairro, cidade, estado, CEP"
                  value={formData.customer_address}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_address: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div>
                <Label>Forma de entrega *</Label>
                <RadioGroup
                  value={formData.delivery_method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, delivery_method: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="retirada" id="retirada" />
                    <Label htmlFor="retirada" className="cursor-pointer">
                      Retirada (Grátis)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="entrega" id="entrega" />
                    <Label htmlFor="entrega" className="cursor-pointer">
                      Entrega (R$ 10,00)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Forma de pagamento *</Label>
                <RadioGroup
                  value={formData.payment_method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_method: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="cursor-pointer">
                      PIX
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dinheiro" id="dinheiro" />
                    <Label htmlFor="dinheiro" className="cursor-pointer">
                      Dinheiro
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cartao_debito" id="cartao_debito" />
                    <Label htmlFor="cartao_debito" className="cursor-pointer">
                      Cartão de Débito
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cartao_credito" id="cartao_credito" />
                    <Label htmlFor="cartao_credito" className="cursor-pointer">
                      Cartão de Crédito
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Alguma observação sobre seu pedido?"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? "Processando..." : "Finalizar Pedido"}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="bg-card border rounded-lg p-6 h-fit sticky top-4">
            <h2 className="text-xl font-bold mb-4">Resumo do Pedido</h2>
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">
                    R${" "}
                    {((item.promotional_price || item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Taxa de entrega</span>
                  <span>R$ {deliveryFee.toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
