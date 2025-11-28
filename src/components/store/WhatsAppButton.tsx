import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppButtonProps {
  phoneNumber: string;
  storeOwnerId: string;
  storeName: string;
  primaryColor?: string;
}

const WhatsAppButton = ({ phoneNumber, storeOwnerId, storeName, primaryColor = "#6a1b9a" }: WhatsAppButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!customerName || !customerPhone || !message) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSending(true);

    try {
      // Salvar mensagem no banco
      const { error } = await supabase.from("whatsapp_messages").insert({
        store_owner_id: storeOwnerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        message: message,
      });

      if (error) throw error;

      // Formatar número e criar link WhatsApp
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const whatsappMessage = `Olá! Meu nome é ${customerName}. ${message}`;
      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
        whatsappMessage
      )}`;

      // Abrir WhatsApp
      window.open(whatsappUrl, "_blank");

      // Limpar formulário e fechar dialog
      setCustomerName("");
      setCustomerPhone("");
      setMessage("");
      setDialogOpen(false);
      toast.success("Abrindo WhatsApp...");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        size="lg"
        className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg hover:scale-110 transition-transform z-40"
        style={{ backgroundColor: primaryColor }}
        onClick={() => setDialogOpen(true)}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem via WhatsApp</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para iniciar uma conversa com {storeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Digite seu nome"
              />
            </div>
            <div>
              <Label htmlFor="phone">Seu telefone</Label>
              <Input
                id="phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                rows={4}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={sending}
              className="w-full text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {sending ? "Enviando..." : "Enviar via WhatsApp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppButton;
