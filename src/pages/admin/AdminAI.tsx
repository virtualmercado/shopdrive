import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Brain,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  AlertTriangle,
  Lightbulb,
  Download,
  Activity,
  Target
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminStats } from "@/hooks/useAdminStats";

const AdminAI = () => {
  const { data: stats, isLoading } = useAdminStats();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Generate real insights based on actual data
  const getInsights = () => {
    if (!stats) return [];
    const insights = [];

    if (stats.churnRate > 5) {
      insights.push({
        type: 'warning',
        title: 'Taxa de churn elevada',
        description: `${stats.cancelledThisMonth} cancelamento(s) real(is) neste mês (${stats.churnRate}% de churn)`,
        action: 'Verificar motivos de cancelamento'
      });
    }

    if (stats.overdueInvoices > 0) {
      insights.push({
        type: 'warning',
        title: 'Faturas em atraso',
        description: `${stats.overdueInvoices} fatura(s) vencida(s) — inadimplência de ${stats.inadimplenciaRate}%`,
        action: 'Revisar cobranças pendentes'
      });
    }

    if (stats.mrr > 0) {
      insights.push({
        type: 'info',
        title: 'MRR atual',
        description: `Receita recorrente mensal de ${formatCurrency(stats.mrr)} com ${stats.activeSubscribersCount} assinante(s) ativo(s)`,
        action: 'Ver detalhes financeiros'
      });
    }

    if (stats.newSubscribersToday > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Novos assinantes hoje',
        description: `${stats.newSubscribersToday} novo(s) cadastro(s) hoje`,
        action: 'Acompanhar onboarding'
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Sem alertas',
        description: 'Nenhum ponto de atenção identificado no momento',
        action: 'Continuar monitorando'
      });
    }

    return insights;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'opportunity':
        return <Target className="h-5 w-5 text-green-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Metrics Cards - ALL REAL DATA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR (Receita Recorrente)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.mrr || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.activeSubscribersCount || 0} assinante(s) ativo(s)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Mensal</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${
                    (stats?.churnRate || 0) > 10 ? 'text-red-600' : 'text-foreground'
                  }`}>
                    {stats?.churnRate || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.cancelledThisMonth || 0} cancelamento(s) real(is)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">LTV Médio</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.avgLTV || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receita total: {formatCurrency(stats?.totalRevenue || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${
                    parseFloat(stats?.inadimplenciaRate || '0') > 10 ? 'text-red-600' : 'text-foreground'
                  }`}>
                    {stats?.inadimplenciaRate || '0'}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.overdueInvoices || 0} fatura(s) vencida(s)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Insights (Dados Reais)
              </CardTitle>
              <CardDescription>Baseado em dados reais da plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))
                ) : (
                  getInsights().map((insight, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{insight.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {insight.description}
                          </p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 h-auto mt-2 text-primary"
                          >
                            {insight.action} →
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resumo Financeiro
              </CardTitle>
              <CardDescription>Dados consolidados do mês</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Assinantes ativos</span>
                    <span className="font-medium">{stats?.activeSubscribersCount || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Total de lojas</span>
                    <span className="font-medium">{stats?.totalSubscribers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Faturas pagas (mês)</span>
                    <span className="font-medium">{stats?.paidInvoices || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Faturas pendentes</span>
                    <span className="font-medium">{stats?.pendingInvoices || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Novos hoje</span>
                    <span className="font-medium">{stats?.newSubscribersToday || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAI;
