import { useState, useEffect } from "react";
import { HeadphonesIcon, Send, GraduationCap, ChevronDown, ChevronUp, Trash2, MessageCircle, ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useWhatsAppChannel } from "@/hooks/usePlatformSettings";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SupportTicket {
  id: string;
  message: string;
  response: string | null;
  status: 'pending' | 'answered' | 'read';
  created_at: string;
  answered_at: string | null;
  read_at: string | null;
  deleted_by_merchant: boolean;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
}

const Support = () => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor } = useTheme();
  const { channel: whatsappChannel, generateWhatsAppLink } = useWhatsAppChannel();
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ store_name?: string; email?: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchTickets();
      fetchFaqItems();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("store_name")
      .eq("id", user.id)
      .single();
    
    if (data) {
      setProfile({ store_name: data.store_name, email: user.email });
    }
  };

  const fetchTickets = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("merchant_support_tickets")
      .select("*")
      .eq("merchant_id", user.id)
      .eq("deleted_by_merchant", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tickets:", error);
      return;
    }

    setTickets(data as SupportTicket[] || []);
  };

  const fetchFaqItems = async () => {
    const { data, error } = await supabase
      .from("faq_items")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching FAQ items:", error);
      return;
    }

    setFaqItems(data || []);
  };

  const handleSendMessage = async () => {
    if (!user || !message.trim()) return;

    setLoading(true);
    
    const { error } = await supabase
      .from("merchant_support_tickets")
      .insert({
        merchant_id: user.id,
        message: message.trim(),
        status: 'pending'
      });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      setLoading(false);
      return;
    }

    toast.success("Mensagem enviada com sucesso!");
    setMessage("");
    fetchTickets();
    setLoading(false);
  };

  const handleToggleTicket = async (ticket: SupportTicket) => {
    if (expandedTicketId === ticket.id) {
      // Closing the ticket
      setExpandedTicketId(null);
      
      // If it was answered, mark as read
      if (ticket.status === 'answered') {
        await supabase
          .from("merchant_support_tickets")
          .update({ status: 'read', read_at: new Date().toISOString() })
          .eq("id", ticket.id);
        
        fetchTickets();
      }
    } else {
      // Opening the ticket
      setExpandedTicketId(ticket.id);
    }
  };

  const getTicketStyle = (ticket: SupportTicket) => {
    if (ticket.status === 'pending') {
      return "text-muted-foreground"; // Opaque - waiting for response
    } else if (ticket.status === 'answered') {
      return "text-blue-800 font-medium"; // Dark blue - answered but not read
    } else {
      return "text-muted-foreground"; // Opaque - already read
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from("merchant_support_tickets")
      .update({ deleted_by_merchant: true })
      .eq("id", ticketId);

    if (error) {
      console.error("Error deleting ticket:", error);
      toast.error("Erro ao excluir mensagem");
      return;
    }

    toast.success("Mensagem excluída com sucesso");
    fetchTickets();
  };

  const canDeleteTicket = (ticket: SupportTicket) => {
    // Somente mensagens respondidas pela VM E lidas pelo lojista podem ser excluídas
    return ticket.status === 'read' && ticket.response !== null;
  };

  const handleWhatsAppClick = () => {
    const link = generateWhatsAppLink({
      nome_da_loja: profile?.store_name || "Minha Loja",
      email_do_assinante: profile?.email || user?.email || "",
      plano_do_assinante: "Plano Atual",
    });

    if (link) {
      window.open(link, "_blank");
    } else {
      toast.error("Canal de WhatsApp não configurado");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <HeadphonesIcon className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Suporte / Tickets</h1>
        </div>

        {/* Como podemos ajudar? */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <HeadphonesIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Como podemos ajudar?</CardTitle>
                <CardDescription>
                  Digite abaixo as suas dúvidas ou dificuldades dentro da plataforma.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Message input */}
            <div className="space-y-3">
              <Textarea
                placeholder="Digite sua mensagem aqui..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || loading}
                  className="gap-2"
                  style={{ 
                    backgroundColor: buttonBgColor, 
                    color: buttonTextColor 
                  }}
                >
                  <Send className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>

            {/* Tickets list */}
            {tickets.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Histórico de mensagens
                </h3>
                <div className="space-y-2">
                {tickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className="border rounded-lg overflow-hidden"
                    >
                      <div className="flex items-start">
                        <button
                          onClick={() => handleToggleTicket(ticket)}
                          className={`flex-1 p-3 text-left flex items-start justify-between gap-3 hover:bg-muted/50 transition-colors ${getTicketStyle(ticket)}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{ticket.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {ticket.status === 'pending' && (
                                <span className="ml-2 text-xs text-amber-600">
                                  • Aguardando resposta
                                </span>
                              )}
                              {ticket.status === 'answered' && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">
                                  • Nova resposta
                                </span>
                              )}
                            </p>
                          </div>
                          {ticket.response && (
                            expandedTicketId === ticket.id ? (
                              <ChevronUp className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronDown className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            )
                          )}
                        </button>
                        <button
                          onClick={() => canDeleteTicket(ticket) && handleDeleteTicket(ticket.id)}
                          disabled={!canDeleteTicket(ticket)}
                          className={`p-3 flex-shrink-0 transition-colors ${
                            canDeleteTicket(ticket)
                              ? "text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              : "text-muted-foreground/40 cursor-not-allowed"
                          }`}
                          title={canDeleteTicket(ticket) ? "Excluir mensagem" : "Somente mensagens respondidas e lidas podem ser excluídas"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {/* Response area */}
                      {expandedTicketId === ticket.id && ticket.response && (
                        <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                          <div className="pt-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              Resposta do suporte:
                            </p>
                            <p className="text-sm text-foreground">
                              {ticket.response}
                            </p>
                            {ticket.answered_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Respondido em {format(new Date(ticket.answered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tickets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <HeadphonesIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma mensagem enviada ainda.</p>
                <p className="text-sm">Envie sua primeira dúvida ou problema!</p>
              </div>
            )}

            {/* WhatsApp Support Block */}
            {whatsappChannel && whatsappChannel.is_active && (
              <div className="border-t pt-4 mt-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800">Suporte via WhatsApp</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Atendimento direto com a equipe da VirtualMercado.
                      </p>
                      {whatsappChannel.operating_hours && (
                        <p className="text-xs text-green-600 mt-1">
                          Horário: {whatsappChannel.operating_hours}
                        </p>
                      )}
                      <Button
                        onClick={handleWhatsAppClick}
                        className="mt-3 bg-green-600 hover:bg-green-700 text-white gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Falar com atendimento no WhatsApp
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Academia VM */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Academia VM</CardTitle>
                <CardDescription>
                  Principais dúvidas, perguntas e respostas sobre a sua plataforma.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {faqItems.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma pergunta frequente cadastrada ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Support;