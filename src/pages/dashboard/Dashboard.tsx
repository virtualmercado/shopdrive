import { Card } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, ShoppingCart, DollarSign, TrendingUp, ClipboardList } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useDashboardStats, useRecentOrders } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { primaryColor } = useTheme();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentOrders, isLoading: ordersLoading } = useRecentOrders(5);
  
  const getLighterShade = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const lighterR = Math.min(255, r + 40);
    const lighterG = Math.min(255, g + 40);
    const lighterB = Math.min(255, b + 40);
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-700" },
      confirmed: { label: "Confirmado", className: "bg-blue-100 text-blue-700" },
      paid: { label: "Pago", className: "bg-green-100 text-green-700" },
      shipped: { label: "Enviado", className: "bg-purple-100 text-purple-700" },
      delivered: { label: "Entregue", className: "bg-green-100 text-green-700" },
      cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700" },
    };
    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const statsCards = [
    {
      icon: DollarSign,
      label: "Vendas do Mês",
      value: stats ? formatCurrency(stats.monthlySales) : "R$ 0,00",
    },
    {
      icon: ShoppingCart,
      label: "Pedidos",
      value: stats?.totalOrders?.toString() || "0",
    },
    {
      icon: Package,
      label: "Produtos",
      value: stats?.totalProducts?.toString() || "0",
    },
    {
      icon: TrendingUp,
      label: "Taxa de Conversão",
      value: stats ? `${stats.conversionRate}%` : "0%",
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: getLighterShade(primaryColor) }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">{stat.value}</p>
              )}
            </Card>
          ))}
        </div>

        {/* Recent Orders */}
        <Card className="p-6">
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <ClipboardList className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Pedidos Recentes</h2>
            </div>
          </div>
          <div className="space-y-4">
            {ordersLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))
            ) : recentOrders && recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Pedido {order.order_number || order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(order.total_amount)}</p>
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum pedido encontrado</p>
                <p className="text-sm">Os pedidos da sua loja aparecerão aqui</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;