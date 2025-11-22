import { AdminLayout } from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, FileText } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stats {
  activeSubscribers: number;
  overdueSubscribers: number;
  newSubscriptions: number;
  mrr: number;
  churn: number;
  overdueInvoices: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  severity: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    activeSubscribers: 0,
    overdueSubscribers: 0,
    newSubscriptions: 0,
    mrr: 0,
    churn: 0,
    overdueInvoices: 0,
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch active subscriptions
      const { data: activeData } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact' })
        .eq('status', 'active');

      // Fetch new subscriptions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: newData } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact' })
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Fetch overdue invoices
      const { data: overdueData } = await supabase
        .from('invoices')
        .select('*', { count: 'exact' })
        .eq('status', 'overdue');

      // Fetch recent events
      const { data: eventsData } = await supabase
        .from('platform_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setStats({
        activeSubscribers: activeData?.length || 0,
        overdueSubscribers: 0,
        newSubscriptions: newData?.length || 0,
        mrr: 0,
        churn: 0,
        overdueInvoices: overdueData?.length || 0,
      });

      setEvents(eventsData || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching dashboard data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const mrrData = [
    { month: 'Jan', value: 12000 },
    { month: 'Fev', value: 15000 },
    { month: 'Mar', value: 18000 },
    { month: 'Abr', value: 22000 },
    { month: 'Mai', value: 25000 },
    { month: 'Jun', value: 28000 },
  ];

  const cycleData = [
    { month: 'Jan', novos: 25, cancelados: 5, upgrades: 8, downgrades: 3 },
    { month: 'Fev', novos: 30, cancelados: 7, upgrades: 10, downgrades: 4 },
    { month: 'Mar', novos: 35, cancelados: 6, upgrades: 12, downgrades: 2 },
    { month: 'Abr', novos: 40, cancelados: 8, upgrades: 15, downgrades: 5 },
  ];

  const plansData = [
    { name: 'Grátis', value: 45 },
    { name: 'Pro', value: 30 },
    { name: 'Premium', value: 25 },
  ];

  const COLORS = ['#6a1b9a', '#FB8C00', '#43A047'];

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      success: 'text-green-600',
      info: 'text-blue-600',
      warning: 'text-orange-600',
      error: 'text-red-600',
    };
    return colors[severity] || 'text-gray-600';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-2">Visão geral da plataforma VirtualMercado</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assinantes Ativos</p>
                <h3 className="text-3xl font-bold mt-2">{stats.activeSubscribers}</h3>
                <div className="flex items-center gap-1 mt-2 text-green-600">
                  <TrendingUp size={16} />
                  <span className="text-sm">+12%</span>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="text-primary" size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assinantes Inadimplentes</p>
                <h3 className="text-3xl font-bold mt-2">{stats.overdueSubscribers}</h3>
                <div className="flex items-center gap-1 mt-2 text-red-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm">Ação necessária</span>
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Novas Assinaturas (30d)</p>
                <h3 className="text-3xl font-bold mt-2">{stats.newSubscriptions}</h3>
                <div className="flex items-center gap-1 mt-2 text-green-600">
                  <TrendingUp size={16} />
                  <span className="text-sm">+8%</span>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR</p>
                <h3 className="text-3xl font-bold mt-2">R$ {stats.mrr.toLocaleString('pt-BR')}</h3>
                <div className="flex items-center gap-1 mt-2 text-green-600">
                  <TrendingUp size={16} />
                  <span className="text-sm">+15%</span>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="text-primary" size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Churn</p>
                <h3 className="text-3xl font-bold mt-2">{stats.churn}%</h3>
                <div className="flex items-center gap-1 mt-2 text-green-600">
                  <TrendingDown size={16} />
                  <span className="text-sm">-2%</span>
                </div>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingDown className="text-orange-600" size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Faturas Atrasadas</p>
                <h3 className="text-3xl font-bold mt-2">{stats.overdueInvoices}</h3>
                <div className="flex items-center gap-1 mt-2 text-red-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm">Pendente</span>
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <FileText className="text-red-600" size={24} />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Evolução do MRR</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6a1b9a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Ciclo de Assinaturas</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cycleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="novos" fill="#43A047" />
                <Bar dataKey="cancelados" fill="#E53935" />
                <Bar dataKey="upgrades" fill="#6a1b9a" />
                <Bar dataKey="downgrades" fill="#FB8C00" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Plans and Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Planos Mais Utilizados</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={plansData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {plansData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Feed de Eventos</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento recente</p>
              ) : (
                events.map(event => (
                  <div key={event.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(event.severity)}`}></div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(event.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
