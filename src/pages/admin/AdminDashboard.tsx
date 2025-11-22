import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Users, DollarSign, TrendingDown, AlertCircle, FileText } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/admin/StatCard';
import { EventFeed } from '@/components/admin/EventFeed';
import { Card } from '@/components/ui/card';

interface Stats {
  activeSubscriptions: number;
  mrr: number;
  churn: string;
  pastDue: number;
  openTickets: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    activeSubscriptions: 0,
    mrr: 0,
    churn: '0%',
    pastDue: 0,
    openTickets: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch subscriptions data
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(price, name)');

      if (subsError) throw subsError;

      // Calculate stats
      const activeSubscriptions = subscriptions?.filter(s => s.status === 'active').length || 0;
      const pastDue = subscriptions?.filter(s => s.status === 'past_due').length || 0;
      
      const totalMRR = subscriptions
        ?.filter(s => s.status === 'active')
        .reduce((acc, sub: any) => acc + (sub.subscription_plans?.price || 0), 0) || 0;

      // Calculate churn (simplified - cancelled in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cancelledRecently = subscriptions?.filter(
        s => s.status === 'cancelled' && new Date(s.updated_at) >= thirtyDaysAgo
      ).length || 0;
      const churnRate = activeSubscriptions > 0 
        ? ((cancelledRecently / activeSubscriptions) * 100).toFixed(1) 
        : '0.0';

      // Fetch open tickets
      const { data: ticketsData } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('status', 'open');

      setStats({
        activeSubscriptions,
        mrr: totalMRR,
        churn: `${churnRate}%`,
        pastDue,
        openTickets: ticketsData?.length || 0
      });

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

  return (
    <AdminLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-2">Visão geral da plataforma VirtualMercado</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={Users}
            title="Assinantes Ativos"
            value={stats.activeSubscriptions}
            color="primary"
            loading={loading}
          />
          
          <StatCard
            icon={DollarSign}
            title="MRR"
            value={new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(stats.mrr)}
            color="success"
            loading={loading}
          />
          
          <StatCard
            icon={TrendingDown}
            title="Churn Rate"
            value={stats.churn}
            color="warning"
            loading={loading}
          />
          
          <StatCard
            icon={AlertCircle}
            title="Inadimplentes"
            value={stats.pastDue}
            color="danger"
            loading={loading}
          />

          <StatCard
            icon={FileText}
            title="Tickets Abertos"
            value={stats.openTickets}
            color="info"
            loading={loading}
          />
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

          <EventFeed />
        </div>
      </div>
    </AdminLayout>
  );
}
