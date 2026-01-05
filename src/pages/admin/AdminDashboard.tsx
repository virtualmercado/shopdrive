import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  DollarSign, 
  FileText, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  XCircle,
  Link as LinkIcon,
  ArrowRight
} from "lucide-react";
import { useAdminStats, useAdminAlerts } from "@/hooks/useAdminStats";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminDashboard = () => {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: alerts, isLoading: alertsLoading } = useAdminAlerts();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Global Alerts */}
        {!alertsLoading && alerts && alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div 
                key={alert.id}
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  alert.severity === 'critical' 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                }`} />
                <div className="flex-1">
                  <p className={`font-medium text-sm ${
                    alert.severity === 'critical' ? 'text-red-800' : 'text-amber-800'
                  }`}>
                    {alert.title}
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {alert.description}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(alert.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* New Subscribers Today */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos Assinantes (Hoje)</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.newSubscribersToday}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Total: {stats?.totalSubscribers || 0} assinantes
              </p>
            </CardContent>
          </Card>

          {/* MRR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Recorrente (MRR)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.mrr || 0)}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600">Receita mensal ativa</span>
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturas do Mês</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">{stats?.paidInvoices}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">{stats?.pendingInvoices}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-semibold">{stats?.overdueInvoices}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Pagas / Pendentes / Atrasadas
              </p>
            </CardContent>
          </Card>

          {/* Inadimplência */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${
                  Number(stats?.inadimplenciaRate) > 10 ? 'text-red-600' : 'text-foreground'
                }`}>
                  {stats?.inadimplenciaRate}%
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.cancelledThisMonth || 0} cancelamentos este mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Integrations Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Status das Integrações
              </CardTitle>
              <CardDescription>Monitoramento de APIs críticas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Correios', status: 'online' },
                  { name: 'Mercado Pago', status: 'online' },
                  { name: 'PagBank', status: 'online' },
                  { name: 'Melhor Envio', status: 'online' },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{integration.name}</span>
                    <Badge 
                      variant={integration.status === 'online' ? 'default' : 'destructive'}
                      className={integration.status === 'online' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                    >
                      {integration.status === 'online' ? 'Online' : 'Erro'}
                    </Badge>
                  </div>
                ))}
              </div>
              <Link to="/gestor/integracoes">
                <Button variant="ghost" className="w-full mt-4 text-[#6a1b9a]">
                  Ver todas as integrações
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
              <CardDescription>Acesso rápido às principais funções</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/gestor/assinantes">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                    <Users className="h-5 w-5" />
                    <span className="text-xs">Gerenciar Assinantes</span>
                  </Button>
                </Link>
                <Link to="/gestor/faturas">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">Ver Faturas</span>
                  </Button>
                </Link>
                <Link to="/gestor/automacoes">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-xs">Automações</span>
                  </Button>
                </Link>
                <Link to="/gestor/suporte">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-xs">Tickets Abertos</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
