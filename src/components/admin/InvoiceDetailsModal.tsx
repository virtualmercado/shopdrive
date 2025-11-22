import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, Mail, XCircle, DollarSign } from 'lucide-react';

interface InvoiceDetailsModalProps {
  open: boolean;
  onClose: () => void;
  invoice: any;
  onAction?: (action: string) => void;
}

export const InvoiceDetailsModal = ({
  open,
  onClose,
  invoice,
  onAction,
}: InvoiceDetailsModalProps) => {
  if (!invoice) return null;

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      paid: 'bg-green-500',
      overdue: 'bg-red-500',
      cancelled: 'bg-gray-500',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Fatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID da Fatura</label>
              <p className="text-foreground font-mono text-sm">{invoice.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">{getStatusBadge(invoice.status)}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Valor</label>
              <p className="text-foreground text-lg font-semibold">
                R$ {Number(invoice.amount).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Vencimento</label>
              <p className="text-foreground">
                {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Período de Referência</label>
              <p className="text-foreground">
                {new Date(invoice.reference_period_start).toLocaleDateString('pt-BR')} -{' '}
                {new Date(invoice.reference_period_end).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {invoice.notes && (
              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Notas</label>
                <p className="text-foreground">{invoice.notes}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.('generate_link')}
              disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
            >
              <Link className="w-4 h-4 mr-2" />
              Gerar Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.('resend_email')}
              disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
            >
              <Mail className="w-4 h-4 mr-2" />
              Reenviar E-mail
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.('cancel')}
              disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.('apply_credit')}
              disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Aplicar Crédito
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
