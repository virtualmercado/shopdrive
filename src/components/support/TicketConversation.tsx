import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const TICKET_MESSAGES_PAGE = 50;
export const TICKET_MESSAGE_MAX = 5000;

export interface TicketMessage {
  id: string;
  sender_type: "merchant" | "support";
  sender_user_id: string | null;
  message: string;
  created_at: string;
}

/** Loads the latest N messages; older ones on demand. Displayed ASC. */
export function useTicketMessages(ticketId: string | null) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (before?: string) => {
    if (!ticketId) return [] as TicketMessage[];
    let q = supabase
      .from("merchant_support_ticket_messages")
      .select("id, sender_type, sender_user_id, message, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(TICKET_MESSAGES_PAGE + 1);
    if (before) q = q.lt("created_at", before);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as TicketMessage[];
  }, [ticketId]);

  const reload = useCallback(async () => {
    if (!ticketId) { setMessages([]); return; }
    setLoading(true);
    try {
      const rows = await fetchPage();
      setHasOlder(rows.length > TICKET_MESSAGES_PAGE);
      setMessages(rows.slice(0, TICKET_MESSAGES_PAGE).reverse());
    } catch (e) {
      console.error("Error loading ticket messages:", e);
    } finally { setLoading(false); }
  }, [ticketId, fetchPage]);

  const loadOlder = useCallback(async () => {
    if (!messages.length) return;
    const rows = await fetchPage(messages[0].created_at);
    setHasOlder(rows.length > TICKET_MESSAGES_PAGE);
    setMessages((cur) => [...rows.slice(0, TICKET_MESSAGES_PAGE).reverse(), ...cur]);
  }, [messages, fetchPage]);

  useEffect(() => { reload(); }, [reload]);
  return { messages, hasOlder, loading, reload, loadOlder };
}

interface Props {
  messages: TicketMessage[];
  hasOlder: boolean;
  loading: boolean;
  onLoadOlder: () => Promise<void>;
  /** Optional label resolver for support authors (Master only). */
  supportLabel?: (m: TicketMessage) => string;
}

export function TicketConversation({ messages, hasOlder, loading, onLoadOlder, supportLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const handleOlder = async () => {
    const el = ref.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    await onLoadOlder();
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (el) el.scrollTop += el.scrollHeight - prevHeight;
    });
  };

  useEffect(() => {
    if (!loadingOlder && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length === 0 ? 0 : messages[messages.length - 1].id]);

  if (loading && !messages.length) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div ref={ref} className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
      {hasOlder && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={handleOlder} disabled={loadingOlder}>
            {loadingOlder && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Carregar mensagens anteriores
          </Button>
        </div>
      )}
      {messages.map((m) => {
        const isSupport = m.sender_type === "support";
        return (
          <div
            key={m.id}
            className={`rounded-lg border p-3 ${isSupport ? "bg-primary/5 border-primary/20 ml-6" : "bg-muted/50 mr-6"}`}
          >
            <p className={`text-xs font-semibold mb-1 ${isSupport ? "text-primary" : "text-muted-foreground"}`}>
              {isSupport ? (supportLabel ? supportLabel(m) : "Suporte") : "Lojista"}
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.message}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        );
      })}
      {!messages.length && !loading && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem.</p>
      )}
    </div>
  );
}
