import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { CheckCircle } from "lucide-react";

interface WhatsAppButtonProps {
  phoneNumber: string;
  storeOwnerId: string;
  storeName: string;
  primaryColor?: string;
}

const WhatsAppButton = ({
  phoneNumber,
  storeOwnerId,
  storeName,
  primaryColor = "#6a1b9a",
}: WhatsAppButtonProps) => {
  const defaultMessage = `Atendimento SAC ${storeName}: `;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const handleOpenDialog = () => {
    setMessage(defaultMessage);
    setMessageSent(false);
    setDialogOpen(true);
  };

  const normalizeMessageWithPrefix = (next: string) => {
    if (next.startsWith(defaultMessage)) return next;

    // Remove anything typed before the fixed prefix (and re-attach the prefix).
    const idx = next.indexOf(defaultMessage);
    const userPart = idx >= 0 ? next.slice(idx + defaultMessage.length) : next;
    return defaultMessage + userPart;
  };

  const ensureCaretAfterPrefix = (el: HTMLTextAreaElement) => {
    if (el.selectionStart < defaultMessage.length) {
      el.setSelectionRange(defaultMessage.length, defaultMessage.length);
    }
  };

  const handleSendMessage = async () => {
    const onlyPrefix = message.trim() === defaultMessage.trim();

    if (!customerName || !customerPhone || onlyPrefix) {
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

      // Mostrar mensagem de confirmação
      setMessageSent(true);

      // Limpar formulário após 3 segundos
      setTimeout(() => {
        setCustomerName("");
        setCustomerPhone("");
        setMessage(defaultMessage);
        setMessageSent(false);
        setDialogOpen(false);
      }, 4000);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating balloon button */}
      <button
        onClick={handleOpenDialog}
        className="fixed bottom-6 right-6 z-40 hover:scale-105 transition-transform focus:outline-none"
        aria-label="Fale com a gente"
      >
        <div className="relative">
          {/* Speech bubble shape */}
          <svg
            width="95"
            height="105"
            viewBox="0 0 95 105"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            {/* Main bubble - circular shape */}
            <circle cx="47.5" cy="42" r="42" fill="#2EAE4E" />
            {/* Tail/pointer - pointing bottom left */}
            <path
              d="M22 76 Q15 95 8 100 Q25 88 35 78"
              fill="#2EAE4E"
            />
          </svg>
          
          {/* Content inside the bubble - text only */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: '18px' }}>
            <span className="text-white font-semibold text-sm leading-tight text-center">
              Fale
              <br />
              com a
              <br />
              gente
            </span>
          </div>
        </div>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para enviar uma mensagem para {storeName}
            </DialogDescription>
          </DialogHeader>
          
          {messageSent ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <p className="text-green-800 text-sm">
                Mensagem recebida, em breve nossa equipe entrará em contato pelo número informado
              </p>
            </div>
          ) : (
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
                  onChange={(e) => setMessage(normalizeMessageWithPrefix(e.target.value))}
                  onFocus={(e) => ensureCaretAfterPrefix(e.currentTarget)}
                  onMouseUp={(e) => ensureCaretAfterPrefix(e.currentTarget)}
                  onKeyDown={(e) => {
                    const el = e.currentTarget;

                    if (e.key === "Home") {
                      e.preventDefault();
                      el.setSelectionRange(defaultMessage.length, defaultMessage.length);
                      return;
                    }

                    if (e.key === "ArrowLeft" && el.selectionStart <= defaultMessage.length) {
                      e.preventDefault();
                      el.setSelectionRange(defaultMessage.length, defaultMessage.length);
                      return;
                    }

                    if (e.key === "Backspace" && el.selectionStart <= defaultMessage.length) {
                      e.preventDefault();
                      el.setSelectionRange(defaultMessage.length, defaultMessage.length);
                    }
                  }}
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
                {sending ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppButton;
