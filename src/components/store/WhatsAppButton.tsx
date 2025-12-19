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
  const defaultMessage = `Atendimento SAC (${storeName}): `;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);

  const handleOpenDialog = () => {
    setMessage(defaultMessage);
    setDialogOpen(true);
  };

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

      // Formatar número e criar link WhatsApp Web
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const fullMessage = `Olá! Meu nome é ${customerName}. Telefone: ${customerPhone}. ${message}`;
      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(fullMessage)}`;

      // Abrir WhatsApp Web (wa.me funciona em desktop e mobile)
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      // Limpar formulário e fechar dialog
      setCustomerName("");
      setCustomerPhone("");
      setMessage(defaultMessage);
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
        className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg hover:scale-110 transition-transform z-40 p-0"
        style={{ backgroundColor: "#25D366" }}
        onClick={handleOpenDialog}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="white" 
          className="h-10 w-10"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
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
