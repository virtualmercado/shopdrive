import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  customer_name: string;
  customer_phone: string;
  message: string;
  created_at: string;
}

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("store_owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setMessages(messages.filter((msg) => msg.id !== id));
      toast.success("Mensagem excluída");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Erro ao excluir mensagem");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
              <MessageCircle className="h-4 w-4 text-gray-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Mensagens Loja Online</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Acompanhe as mensagens recebidas através do botão flutuante da sua loja
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando mensagens...</p>
          </div>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem ainda</h3>
                <p className="text-muted-foreground">
                  As mensagens enviadas através do botão WhatsApp da sua loja aparecerão
                  aqui
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <Card key={message.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{message.customer_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {message.customer_phone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(message.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Messages;
