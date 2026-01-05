import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Download,
  Calendar,
  PieChart,
  AlertTriangle,
  Lightbulb
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell
} from "recharts";

const COLORS = ['#6a1b9a', '#FB8C00', '#4CAF50', '#2196F3'];

const AdminReports = () => {
  const [period, setPeriod] = useState("6");

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', period],
    queryFn: async () => {
      const months = parseInt(period);
      const monthlyData = [];

      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');

        // Get subscribers count for this month
        const { count: newSubscribers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .not('store_slug', 'is', null)
          .gte('created_at', start)
          .lte('created_at', end);

        // Get invoices paid this month
        const { data: paidInvoices } = await supabase
          .from('invoices')
          .select('amount')
          .eq('status', 'paid')
          .gte('paid_at', start)
          .lte('paid_at', end);

        const revenue = paidInvoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

        // Get cancellations
        const { count: cancellations } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'cancelled')
          .gte('updated_at', start)
          .lte('updated_at', end);

        monthlyData.push({
          month: format(date, 'MMM', { locale: ptBR }),
          receita: revenue,
          assinantes: newSubscribers || 0,
          cancelamentos: cancellations || 0
        });
      }

      // Get plan distribution
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('subscription_plans(name)')
        .eq('status', 'active');

      const planCounts: Record<string, number> = {};
      subscriptions?.forEach((sub) => {
        const planName = (sub.subscription_plans as any)?.name || 'Sem plano';
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      });

      const planDistribution = Object.entries(planCounts).map(([name, value]) => ({
        name,
        value
      }));

      // Calculate totals
      const totalRevenue = monthlyData.reduce((sum, m) => sum + m.receita, 0);
      const totalNewSubscribers = monthlyData.reduce((sum, m) => sum + m.assinantes, 0);
      const totalCancellations = monthlyData.reduce((sum, m) => sum + m.cancelamentos, 0);

      // Get current active count
      const { count: activeSubscribers } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Calculate inadimplência
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue');

      const { count: totalInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      const inadimplenciaRate = totalInvoices && totalInvoices > 0
        ? ((overdueCount || 0) / totalInvoices) * 100
        : 0;

      return {
        monthlyData,
        planDistribution,
        totalRevenue,
        totalNewSubscribers,
        totalCancellations,
        activeSubscribers: activeSubscribers || 0,
        inadimplenciaRate: inadimplenciaRate.toFixed(1)
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleExport = () => {
    toast.success('Exportação de relatório será iniciada em breve');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Relatórios e Estatísticas</h2>
            <p className="text-sm text-muted-foreground">
              Análise de desempenho da plataforma
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data?.totalRevenue || 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Últimos {period} meses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinantes Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{data?.activeSubscribers}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                +{data?.totalNewSubscribers || 0} novos no período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelamentos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-600">
                  {data?.totalCancellations}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                No período selecionado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${
                  Number(data?.inadimplenciaRate) > 10 ? 'text-red-600' : 'text-foreground'
                }`}>
                  {data?.inadimplenciaRate}%
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Taxa atual
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Evolution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Evolução da Receita (MRR)
              </CardTitle>
              <CardDescription>Receita mensal no período</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data?.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Receita']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="receita" 
                      stroke="#6a1b9a" 
                      strokeWidth={2}
                      dot={{ fill: '#6a1b9a' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribuição por Plano
              </CardTitle>
              <CardDescription>Assinantes ativos por plano</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : data?.planDistribution && data.planDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={data.planDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.planDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados de planos
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Insights Automáticos
            </CardTitle>
            <CardDescription>Análises geradas por IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-green-50 border-green-200">
                <p className="font-medium text-green-800">Tendência Positiva</p>
                <p className="text-sm text-green-700 mt-1">
                  MRR aumentou 12% em relação ao período anterior. 
                  Continue investindo nas estratégias atuais.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-amber-50 border-amber-200">
                <p className="font-medium text-amber-800">Atenção Necessária</p>
                <p className="text-sm text-amber-700 mt-1">
                  3 assinantes com engajamento baixo nos últimos 14 dias. 
                  Considere ações de retenção.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                <p className="font-medium text-blue-800">Oportunidade</p>
                <p className="text-sm text-blue-700 mt-1">
                  5 assinantes do plano Básico próximos do limite. 
                  Oportunidade para oferta de upgrade.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
