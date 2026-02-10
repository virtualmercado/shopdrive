import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Trash2, Save, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSaveQuote, Quote, QuoteItem } from "@/hooks/useQuotes";
import { format, addDays } from "date-fns";

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  stock: number;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface CreateQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuote?: Quote | null;
}

export const CreateQuoteModal = ({ open, onOpenChange, editQuote }: CreateQuoteModalProps) => {
  const { user } = useAuth();
  const saveQuote = useSaveQuote();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [paymentHint, setPaymentHint] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Free item
  const [freeItemName, setFreeItemName] = useState("");
  const [freeItemPrice, setFreeItemPrice] = useState("");
  const [freeItemQty, setFreeItemQty] = useState("1");

  useEffect(() => {
    if (open && user) fetchData();
  }, [open, user]);

  useEffect(() => {
    if (editQuote && open) {
      setSelectedCustomerId(editQuote.customer_id);
      setCustomerName(editQuote.customer_name);
      setCustomerPhone(editQuote.customer_phone || "");
      setCustomerEmail(editQuote.customer_email || "");
      setDeliveryAddress(editQuote.delivery_address || "");
      setValidUntil(editQuote.valid_until);
      setNotes(editQuote.notes || "");
      setDiscount(editQuote.discount);
      setShippingFee(editQuote.shipping_fee);
      setPaymentHint(editQuote.payment_method_hint || "");
      setItems(
        (editQuote.quote_items || []).map((i: any) => ({
          product_id: i.product_id,
          name: i.name,
          sku: i.sku,
          unit_price: Number(i.unit_price),
          quantity: Number(i.quantity),
          line_total: Number(i.line_total),
        }))
      );
    } else if (!editQuote && open) {
      resetForm();
    }
  }, [editQuote, open]);

  const fetchData = async () => {
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, price, promotional_price, stock")
      .eq("user_id", user!.id)
      .order("name");
    setProducts(productsData || []);

    const { data: storeCustomers } = await supabase
      .from("store_customers")
      .select("customer_id")
      .eq("store_owner_id", user!.id);

    if (storeCustomers && storeCustomers.length > 0) {
      const ids = storeCustomers.map((sc) => sc.customer_id);
      const { data: profiles } = await supabase
        .from("customer_profiles")
        .select("id, full_name, email, phone")
        .in("id", ids);
      setCustomers(profiles || []);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDeliveryAddress("");
    setValidUntil(format(addDays(new Date(), 7), "yyyy-MM-dd"));
    setNotes("");
    setDiscount(0);
    setShippingFee(0);
    setPaymentHint("");
    setItems([]);
    setProductSearch("");
    setCustomerSearch("");
    setFreeItemName("");
    setFreeItemPrice("");
    setFreeItemQty("1");
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.full_name);
    setCustomerEmail(c.email);
    setCustomerPhone(c.phone || "");
    setCustomerSearch("");
  };

  const handleAddProduct = (p: Product) => {
    const existing = items.findIndex((i) => i.product_id === p.id);
    const price = p.promotional_price || p.price;
    if (existing >= 0) {
      const updated = [...items];
      updated[existing].quantity += 1;
      updated[existing].line_total = updated[existing].quantity * updated[existing].unit_price;
      setItems(updated);
    } else {
      setItems([...items, { product_id: p.id, name: p.name, sku: null, unit_price: price, quantity: 1, line_total: price }]);
    }
    setProductSearch("");
  };

  const handleAddFreeItem = () => {
    if (!freeItemName || !freeItemPrice) return;
    const price = parseFloat(freeItemPrice);
    const qty = parseInt(freeItemQty) || 1;
    setItems([...items, { product_id: null, name: freeItemName, sku: null, unit_price: price, quantity: qty, line_total: price * qty }]);
    setFreeItemName("");
    setFreeItemPrice("");
    setFreeItemQty("1");
  };

  const handleQuantityChange = (index: number, qty: number) => {
    if (qty < 1) return;
    const updated = [...items];
    updated[index].quantity = qty;
    updated[index].line_total = qty * updated[index].unit_price;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const total = subtotal - discount + shippingFee;

  const handleSave = (status: "draft" | "open") => {
    if (!customerName.trim()) return;
    if (items.length === 0) return;

    saveQuote.mutate(
      {
        quote: {
          customer_id: selectedCustomerId,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          customer_email: customerEmail || null,
          delivery_address: deliveryAddress || null,
          valid_until: validUntil,
          notes: notes || null,
          subtotal,
          discount,
          shipping_fee: shippingFee,
          total,
          payment_method_hint: paymentHint || null,
          status,
        },
        items,
        editId: editQuote?.id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  const filteredCustomers = customers.filter(
    (c) => c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) || c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-hidden flex min-h-0 flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editQuote ? "Editar Orçamento" : "Novo Orçamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4 overscroll-contain">
          <div className="space-y-6 py-4">
            {/* Cliente */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente cadastrado..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-10" />
              </div>
              {customerSearch && filteredCustomers.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredCustomers.slice(0, 5).map((c) => (
                    <div key={c.id} className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0" onClick={() => handleSelectCustomer(c)}>
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-sm text-muted-foreground">{c.email}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do cliente *</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <Label className="text-xs">Endereço de entrega</Label>
                  <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Endereço completo" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados do orçamento */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Dados do Orçamento</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Validade até *</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Forma de pagamento (informativa)</Label>
                  <Input value={paymentHint} onChange={(e) => setPaymentHint(e.target.value)} placeholder="Ex: PIX, cartão..." />
                </div>
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais..." rows={2} />
              </div>
            </div>

            <Separator />

            {/* Itens */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Itens</Label>
              {/* Produto do catálogo */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto do catálogo..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-10" />
              </div>
              {productSearch && filteredProducts.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredProducts.slice(0, 8).map((p) => (
                    <div key={p.id} className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center" onClick={() => handleAddProduct(p)}>
                      <span className="text-sm">{p.name}</span>
                      <span className="text-sm font-medium">R$ {(p.promotional_price || p.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Item livre */}
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs">Item livre</Label>
                  <Input value={freeItemName} onChange={(e) => setFreeItemName(e.target.value)} placeholder="Nome do item" />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Preço</Label>
                  <Input type="number" min="0" step="0.01" value={freeItemPrice} onChange={(e) => setFreeItemPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="w-16">
                  <Label className="text-xs">Qtd</Label>
                  <Input type="number" min="1" value={freeItemQty} onChange={(e) => setFreeItemQty(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={handleAddFreeItem} disabled={!freeItemName || !freeItemPrice}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Items list */}
              {items.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-xs font-semibold grid grid-cols-12 gap-2">
                    <span className="col-span-5">Produto</span>
                    <span className="col-span-2 text-center">Qtd</span>
                    <span className="col-span-2 text-right">Unit.</span>
                    <span className="col-span-2 text-right">Total</span>
                    <span className="col-span-1" />
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="px-3 py-2 text-sm grid grid-cols-12 gap-2 items-center border-t">
                      <span className="col-span-5 truncate">{item.name}</span>
                      <div className="col-span-2 flex justify-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                          className="w-16 h-7 text-center text-xs"
                        />
                      </div>
                      <span className="col-span-2 text-right">R$ {item.unit_price.toFixed(2)}</span>
                      <span className="col-span-2 text-right font-medium">R$ {item.line_total.toFixed(2)}</span>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(index)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Totais */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span>Desconto</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-28 h-7 text-right text-sm"
                />
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span>Frete</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                  className="w-28 h-7 text-right text-sm"
                />
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t justify-end flex-wrap">
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saveQuote.isPending || !customerName.trim() || items.length === 0}>
            <Save className="h-4 w-4 mr-1" />
            Salvar rascunho
          </Button>
          <Button onClick={() => handleSave("open")} disabled={saveQuote.isPending || !customerName.trim() || items.length === 0}>
            <FileText className="h-4 w-4 mr-1" />
            Salvar orçamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
