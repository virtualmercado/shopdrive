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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminAI = () => {
  // AI Analytics Query
  const { data: aiData, isLoading } = useQuery({
    queryKey: ['admin-ai-analytics'],
    queryFn: async () => {
      // Get subscriber engagement metrics
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, store_name, last_activity, created_at')
        .not('store_slug', 'is', null)
        .order('last_activity', { ascending: false })
        .limit(20);

      // Get subscription data
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('status', 'active');

      // Calculate metrics
      const activeSubscribers = subscriptions?.length || 0;
      const totalMRR = subscriptions?.reduce((sum, sub) => {
        const price = (sub.subscription_plans as any)?.price || 0;
        return sum + price;
      }, 0) || 0;

      // Simulated AI metrics (in a real app, these would come from ML models)
      const avgEngagement = 72;
      const churnPrediction = 8.5;
      const mrrProjection = totalMRR * 1.12;
      const systemHealth = 98.5;

      // Generate AI insights
      const insights = [
        {
          type: 'warning',
          title: 'Risco de cancelamento detectado',
          description: '3 assinantes com engajamento abaixo de 30% nos últimos 14 dias',
          action: 'Ativar automação de retenção'
        },
        {
          type: 'opportunity',
          title: 'Oportunidade de upgrade',
          description: '5 assinantes do plano Básico atingiram 90% do limite de produtos',
          action: 'Enviar oferta de upgrade'
        },
        {
          type: 'info',
          title: 'Tendência positiva',
          description: 'MRR aumentou 12% em relação ao mês anterior',
          action: 'Manter estratégia atual'
        }
      ];

      // Subscriber behavior analysis
      const behaviorData = profiles?.slice(0, 10).map((profile, index) => ({
        id: profile.id,
        storeName: profile.store_name || 'Loja sem nome',
        engagementScore: Math.floor(Math.random() * 40) + 60,
        status: index < 2 ? 'Risco' : index < 5 ? 'Atenção' : 'Saudável',
        lastLogin: profile.last_activity 
          ? format(new Date(profile.last_activity), "dd/MM/yyyy", { locale: ptBR })
          : 'Nunca'
      })) || [];

      return {
        avgEngagement,
        churnPrediction,
        mrrProjection,
        systemHealth,
        insights,
        behaviorData,
        totalMRR
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Risco':
        return 'bg-red-100 text-red-800';
      case 'Atenção':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-green-100 text-green-800';
    }
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
        {/* AI Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engajamento Médio</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{aiData?.avgEngagement}%</div>
                  <Progress value={aiData?.avgEngagement} className="mt-2 h-2" />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Previsão de Churn</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${
                    (aiData?.churnPrediction || 0) > 10 ? 'text-red-600' : 'text-foreground'
                  }`}>
                    {aiData?.churnPrediction}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Projeção próximos 30 dias
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Previsão MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(aiData?.mrrProjection || 0)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">+12% projetado</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saúde do Sistema</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    {aiData?.systemHealth}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uptime últimos 30 dias
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Insights */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Insights da IA
                </CardTitle>
                <CardDescription>Recomendações automáticas</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiData?.insights.map((insight, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-lg border bg-card"
                  >
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
                          className="p-0 h-auto mt-2 text-[#6a1b9a]"
                        >
                          {insight.action} →
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Projection Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Projeção de Receita
              </CardTitle>
              <CardDescription>Próximos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex items-center justify-center border rounded-lg bg-muted/30">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Gráfico de projeção será exibido aqui
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Baseado em análise de tendências com IA
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Behavior Analysis Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Análise Comportamental
              </CardTitle>
              <CardDescription>Monitoramento de engajamento por assinante</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Score de Engajamento</TableHead>
                  <TableHead>Status IA</TableHead>
                  <TableHead>Último Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  aiData?.behaviorData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.storeName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={row.engagementScore} className="w-20 h-2" />
                          <span className="text-sm">{row.engagementScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.lastLogin}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAI;
