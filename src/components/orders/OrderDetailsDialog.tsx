import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOrderDetails } from "@/hooks/useOrders";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderDetailsDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrderDetailsDialog = ({ orderId, open, onOpenChange }: OrderDetailsDialogProps) => {
  const { data: order, isLoading } = useOrderDetails(orderId || "");

  if (!orderId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido #{orderId.slice(0, 8)}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="font-semibold mb-3">Informações do Cliente</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Nome:</span> {order.customer_name}</p>
                <p><span className="text-muted-foreground">Email:</span> {order.customer_email}</p>
                {order.customer_phone && (
                  <p><span className="text-muted-foreground">Telefone:</span> {order.customer_phone}</p>
                )}
                {order.customer_address && (
                  <p><span className="text-muted-foreground">Endereço:</span> {order.customer_address}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <h3 className="font-semibold mb-3">Itens do Pedido</h3>
              <div className="space-y-3">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantidade: {item.quantity} × R$ {item.product_price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold">R$ {item.subtotal.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Método de Pagamento:</span>
                <span className="font-medium">{order.payment_method || "Não informado"}</span>
              </div>
              {order.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Observações:</span>
                  <p className="mt-1 p-2 bg-muted/50 rounded">{order.notes}</p>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data do Pedido:</span>
                <span className="font-medium">
                  {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold pt-2">
                <span>Total:</span>
                <span className="text-primary">R$ {order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground">Pedido não encontrado</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
