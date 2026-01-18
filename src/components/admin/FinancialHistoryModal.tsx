import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, History, Search, CreditCard, RefreshCw, Ban, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscriber {
  id: string;
  store_name: string | null;
  email: string | null;
}

interface FinancialHistoryModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FinancialHistoryModal = ({
  subscriber,
  open,
  onOpenChange,
}: FinancialHistoryModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: financialData, isLoading } = useQuery({
    queryKey: ['financial-history', subscriber?.id],
    queryFn: async () => {
      if (!subscriber?.id) return { invoices: [], payments: [], planChanges: [] };

      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('subscriber_id', subscriber.id)
        .order('created_at', { ascending: false });

      // Fetch payments through invoices
      const invoiceIds = invoices?.map(i => i.id) || [];
      const { data: payments } = invoiceIds.length > 0
        ? await supabase
            .from('payments')
            .select('*')
            .in('invoice_id', invoiceIds)
            .order('created_at', { ascending: false })
        : { data: [] };

      // Fetch master subscription payments
      const { data: masterPayments } = await supabase
        .from('master_subscription_payments')
        .select('*')
        .eq('user_id', subscriber.id)
        .order('created_at', { ascending: false });

      // Fetch audit logs for plan changes
      const { data: planChanges } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', subscriber.id)
        .in('action', ['plan_change', 'subscription_created', 'subscription_cancelled'])
        .order('created_at', { ascending: false });

      return {
        invoices: invoices || [],
        payments: payments || [],
        masterPayments: masterPayments || [],
        planChanges: planChanges || [],
      };
    },
    enabled: open && !!subscriber?.id,
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: "Pago", variant: "default" },
      pending: { label: "Pendente", variant: "outline" },
      failed: { label: "Falhou", variant: "destructive" },
      refunded: { label: "Estornado", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "secondary" },
      success: { label: "Sucesso", variant: "default" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'plan_change':
        return <ArrowUpCircle className="h-4 w-4 text-blue-500" />;
      case 'subscription_cancelled':
        return <Ban className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-500" />;
    }
  };

  // Combine all financial events into a timeline
  const allEvents = [
    ...(financialData?.invoices || []).map(inv => ({
      type: 'invoice',
      date: inv.created_at,
      description: `Fatura gerada`,
      amount: inv.amount,
      status: inv.status,
      details: `Período: ${format(new Date(inv.reference_period_start), 'dd/MM/yyyy')} - ${format(new Date(inv.reference_period_end), 'dd/MM/yyyy')}`,
    })),
    ...(financialData?.payments || []).map(pay => ({
      type: 'payment',
      date: pay.created_at,
      description: `Pagamento via ${pay.gateway}`,
      amount: pay.amount,
      status: pay.status,
      details: pay.transaction_id ? `ID: ${pay.transaction_id}` : '',
    })),
    ...(financialData?.masterPayments || []).map(pay => ({
      type: 'master_payment',
      date: pay.created_at,
      description: `Pagamento assinatura via ${pay.payment_method}`,
      amount: pay.amount,
      status: pay.status,
      details: pay.gateway_payment_id ? `ID: ${pay.gateway_payment_id}` : '',
    })),
    ...(financialData?.planChanges || []).map(log => ({
      type: 'plan_change',
      date: log.created_at,
      description: log.action === 'plan_change' 
        ? `Alteração de plano: ${(log.metadata as any)?.previous_plan || 'N/A'} → ${(log.metadata as any)?.new_plan || 'N/A'}`
        : log.action,
      amount: null,
      status: 'info',
      details: (log.metadata as any)?.reason || '',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredEvents = allEvents.filter(event =>
    event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico Financeiro
          </DialogTitle>
          <DialogDescription>
            Histórico completo de <strong>{subscriber.store_name || subscriber.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no histórico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">
                {financialData?.payments?.filter(p => p.status === 'paid').length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Pagamentos realizados</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-600">
                {financialData?.invoices?.filter(i => i.status === 'pending').length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Faturas pendentes</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">
                {(financialData?.payments?.filter(p => p.status === 'failed').length || 0) +
                 (financialData?.masterPayments?.filter(p => p.status === 'failed').length || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Falhas de pagamento</p>
            </div>
          </div>

          {/* Timeline */}
          <ScrollArea className="h-[350px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-2 opacity-50" />
                <p>Nenhum registro financeiro encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event, index) => (
                    <TableRow key={index}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(event.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{event.description}</p>
                          {event.details && (
                            <p className="text-xs text-muted-foreground">{event.details}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.amount !== null ? (
                          <span className="font-medium">
                            R$ {Number(event.amount).toFixed(2).replace('.', ',')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.status !== 'info' ? getStatusBadge(event.status) : (
                          <Badge variant="outline">Info</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
