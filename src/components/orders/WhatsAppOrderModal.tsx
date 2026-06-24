import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Eraser } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildItemizedWhatsAppMessage } from "@/lib/whatsappOrderMessage";

interface WhatsAppOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string | null;
    customer_name: string;
    customer_phone: string | null;
    total_amount: number;
    subtotal?: number | null;
    delivery_fee?: number | null;
    delivery_method?: string | null;
    payment_method?: string | null;
    notes?: string | null;
    created_at?: string | null;
  } | null;
  storeName?: string;
}

const normalizePhone = (raw: string): string => raw.replace(/[^0-9+]/g, "");

export function WhatsAppOrderModal({
  open,
  onOpenChange,
  order,
  storeName = "Nossa Loja",
}: WhatsAppOrderModalProps) {
  const isMobile = useIsMobile();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!open || !order) return;
      setPhone(order.customer_phone ?? "");
      setLoadingItems(true);
      try {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_name, quantity, product_price, subtotal, variations")
          .eq("order_id", order.id);
        const itemsForWa = (items || []).map((i: any) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          product_price: Number(i.product_price),
          subtotal: Number(i.subtotal),
          variations: i.variations && typeof i.variations === "object" ? i.variations : null,
        }));
        const msg = buildItemizedWhatsAppMessage(
          {
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            created_at: order.created_at || new Date(),
            subtotal: order.subtotal ?? null,
            delivery_fee: order.delivery_fee ?? null,
            total_amount: order.total_amount,
            delivery_method: order.delivery_method ?? null,
            payment_method: order.payment_method ?? null,
            notes: order.notes ?? null,
          },
          itemsForWa,
          storeName
        );
        setMessage(msg);
      } finally {
        setLoadingItems(false);
      }
    };
    load();
  }, [open, order, storeName]);

  const handleOpen = () => {
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 10) {
      toast({
        title: "Número inválido",
        description: "Informe um número de WhatsApp válido com DDD.",
        variant: "destructive",
      });
      return;
    }
    const encoded = encodeURIComponent(message);
    const phoneSanitized = normalized.replace(/^\+/, "");
    const url = isMobile
      ? `https://wa.me/${phoneSanitized}?text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${normalized}&text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const handleClearMessage = () => {
    setMessage("");
    toast({ title: "Mensagem limpa", description: "O campo de mensagem foi esvaziado." });
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92%] max-w-[560px] sm:max-w-[560px] gap-0 p-6 overflow-hidden">
        <DialogHeader className="mb-6">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Enviar por WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o resumo do pedido {order.order_number ?? `#${order.id.slice(0, 8)}`} para o
            cliente via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="wa-phone">WhatsApp</Label>
            <Input
              id="wa-phone"
              placeholder="+55 11 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full box-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa-message">Mensagem</Label>
            <Textarea
              id="wa-message"
              rows={10}
              value={loadingItems ? "Carregando itens do pedido..." : message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full box-border font-mono text-xs"
              disabled={loadingItems}
            />
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Dica: no WhatsApp, você pode editar a mensagem antes de enviar.
          </p>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleClearMessage} className="gap-1">
            <Eraser className="h-4 w-4" />
            Limpar mensagem
          </Button>
          <Button
            onClick={handleOpen}
            disabled={loadingItems}
            className="gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            <Send className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
