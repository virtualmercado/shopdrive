import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, Eye, RefreshCw } from "lucide-react";
import { useOrders, useOrderStats, useUpdateOrderStatus } from "@/hooks/useOrders";
import { OrderDetailsDialog } from "@/components/orders/OrderDetailsDialog";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Orders = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const { data: orders, isLoading: ordersLoading } = useOrders();
  const { data: stats, isLoading: statsLoading } = useOrderStats();
  const updateStatus = useUpdateOrderStatus();

  const handleViewDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailsOpen(true);
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatus.mutate({ orderId, status: newStatus });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Pagos</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.paidOrders || 0}</p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Processamento</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.processingOrders || 0}</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Pedidos Recentes</h2>
          </div>
          {ordersLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="divide-y">
              {orders.map((order) => (
                <div key={order.id} className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-semibold">Pedido #{order.id.slice(0, 8)}</p>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right space-y-3">
                      <p className="text-xl font-bold text-primary">
                        R$ {order.total_amount.toFixed(2)}
                      </p>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="paid">Pago</SelectItem>
                            <SelectItem value="processing">Processando</SelectItem>
                            <SelectItem value="shipped">Enviado</SelectItem>
                            <SelectItem value="delivered">Entregue</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleViewDetails(order.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          )}
        </Card>
      </div>

      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </DashboardLayout>
  );
};

export default Orders;