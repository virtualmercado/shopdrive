import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PaymentDetailsModalProps {
  open: boolean;
  onClose: () => void;
  payment: any;
}

export const PaymentDetailsModal = ({
  open,
  onClose,
  payment,
}: PaymentDetailsModalProps) => {
  if (!payment) return null;

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      paid: 'bg-green-500',
      refunded: 'bg-red-500',
      failed: 'bg-gray-500',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID do Pagamento</label>
              <p className="text-foreground font-mono text-sm">{payment.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">{getStatusBadge(payment.status)}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Gateway</label>
              <p className="text-foreground">{payment.gateway}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
              <p className="text-foreground font-mono text-sm">{payment.transaction_id || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Valor Bruto</label>
              <p className="text-foreground text-lg font-semibold">
                R$ {Number(payment.amount).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Taxas</label>
              <p className="text-foreground text-red-600">
                - R$ {Number(payment.gateway_fee).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Valor Líquido</label>
              <p className="text-foreground text-lg font-semibold text-green-600">
                R$ {Number(payment.net_amount).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Data do Pagamento</label>
              <p className="text-foreground">
                {payment.paid_at
                  ? new Date(payment.paid_at).toLocaleString('pt-BR')
                  : 'Pendente'}
              </p>
            </div>
          </div>

          {payment.metadata && Object.keys(payment.metadata).length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Metadata (JSON)
              </label>
              <ScrollArea className="h-48 w-full rounded-md border">
                <pre className="p-4 text-xs">
                  {JSON.stringify(payment.metadata, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
