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

interface WhatsAppOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string | null;
    customer_name: string;
    customer_phone: string | null;
    total_amount: number;
  } | null;
  storeName?: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalizePhone = (raw: string): string =>
  raw.replace(/[^0-9+]/g, "");

const buildDefaultMessage = (
  orderNumber: string,
  total: number,
  storeName: string
) =>
  `Olá! Segue o resumo do seu pedido ${orderNumber} no valor de ${formatCurrency(total)}.\n\nObrigado pela compra! — ${storeName}`;

export function WhatsAppOrderModal({
  open,
  onOpenChange,
  order,
  storeName = "Nossa Loja",
}: WhatsAppOrderModalProps) {
  const isMobile = useIsMobile();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open && order) {
      setPhone(order.customer_phone ?? "");
      setMessage(
        buildDefaultMessage(
          order.order_number ?? `#${order.id.slice(0, 8)}`,
          order.total_amount,
          storeName
        )
      );
    }
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
    // Remove leading + for wa.me
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Enviar por WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o resumo do pedido {order.order_number ?? `#${order.id.slice(0, 8)}`} para o
            cliente via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="wa-phone">WhatsApp</Label>
            <Input
              id="wa-phone"
              placeholder="+55 11 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="wa-message">Mensagem</Label>
            <Textarea
              id="wa-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Dica: no WhatsApp, você pode apagar a mensagem manualmente após enviar, se desejar.
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleClearMessage} className="gap-1">
            <Eraser className="h-4 w-4" />
            Limpar mensagem
          </Button>
          <Button
            onClick={handleOpen}
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
