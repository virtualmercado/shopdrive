import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, FileText, Eye } from "lucide-react";

const Orders = () => {
  // Mock orders data
  const orders = [
    { 
      id: "1234", 
      customer: "João Silva", 
      total: 299.90, 
      status: "paid", 
      date: "15/11/2024",
      items: 3
    },
    { 
      id: "1235", 
      customer: "Maria Santos", 
      total: 549.90, 
      status: "processing", 
      date: "14/11/2024",
      items: 5
    },
    { 
      id: "1236", 
      customer: "Pedro Costa", 
      total: 199.90, 
      status: "shipped", 
      date: "13/11/2024",
      items: 2
    },
  ];

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { text: string; className: string }> = {
      paid: { text: "Pago", className: "bg-green-100 text-green-700" },
      processing: { text: "Processando", className: "bg-yellow-100 text-yellow-700" },
      shipped: { text: "Enviado", className: "bg-blue-100 text-blue-700" },
      delivered: { text: "Entregue", className: "bg-primary/10 text-primary" },
    };
    return labels[status] || { text: status, className: "bg-muted text-muted-foreground" };
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
                <p className="text-2xl font-bold">156</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Pagos</p>
                <p className="text-2xl font-bold">128</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Processamento</p>
                <p className="text-2xl font-bold">28</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Pedidos Recentes</h2>
          </div>
          <div className="divide-y">
            {orders.map((order) => {
              const status = getStatusLabel(order.status);
              return (
                <div key={order.id} className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold">Pedido #{order.id}</p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${status.className}`}>
                          {status.text}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.customer}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.items} {order.items === 1 ? 'item' : 'itens'} • {order.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary mb-2">
                        R$ {order.total.toFixed(2)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Nota
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Orders;