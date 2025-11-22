import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTickets } from '@/hooks/useTickets';
import { Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketDetailsModalProps {
  open: boolean;
  onClose: () => void;
  ticket: any;
}

export const TicketDetailsModal = ({
  open,
  onClose,
  ticket,
}: TicketDetailsModalProps) => {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const { addMessage, fetchMessages, closeTicket } = useTickets();

  useEffect(() => {
    if (ticket?.id) {
      loadMessages();
    }
  }, [ticket?.id]);

  const loadMessages = async () => {
    const data = await fetchMessages(ticket.id);
    setMessages(data);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const success = await addMessage(ticket.id, message, isInternal);
    if (success) {
      setMessage('');
      setIsInternal(false);
      loadMessages();
    }
  };

  const handleCloseTicket = async () => {
    const success = await closeTicket(ticket.id);
    if (success) {
      onClose();
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{ticket.ticket_number} - {ticket.subject}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {ticket.profiles?.full_name} • {ticket.profiles?.store_name}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge>{ticket.status}</Badge>
              <Badge variant="outline">{ticket.priority}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Initial description */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="text-sm font-medium mb-2">Descrição inicial</p>
                <p className="text-sm">{ticket.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(ticket.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>

              {/* Messages thread */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`border rounded-lg p-4 ${
                    msg.is_internal
                      ? 'bg-yellow-50 border-yellow-200'
                      : msg.sender_id === ticket.customer_id
                      ? 'bg-gray-50'
                      : 'bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      {msg.profiles?.full_name}
                      {msg.is_internal && (
                        <Lock className="inline w-3 h-3 ml-2 text-yellow-600" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-4 space-y-2 border-t pt-4">
            <Textarea
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="internal"
                  checked={isInternal}
                  onCheckedChange={(checked) => setIsInternal(checked as boolean)}
                />
                <label htmlFor="internal" className="text-sm cursor-pointer">
                  Nota Interna (não visível para o cliente)
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCloseTicket}>
                  Fechar Ticket
                </Button>
                <Button onClick={handleSendMessage}>Enviar Mensagem</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
