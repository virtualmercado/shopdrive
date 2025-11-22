import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatCard } from '@/components/admin/StatCard';
import { EventFeed } from '@/components/admin/EventFeed';
import { supabase } from '@/integrations/supabase/client';
import { Users, DollarSign, TrendingDown, AlertCircle, Ticket } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    activeSubscribers: 0,
    mrr: 0,
    churnRate: 0,
    pastDue: 0,
    openTickets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [mrrData, setMrrData] = useState<any[]>([]);
  const [planData, setPlanData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch active subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(price, name)')
        .eq('status', 'active');

      if (subsError) throw subsError;

      // Fetch past due invoices
      const { data: pastDueInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'overdue');

      if (invoicesError) throw invoicesError;

      // Fetch open tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('status', 'open');

      if (ticketsError) throw ticketsError;

      // Calculate MRR
      const mrr = subscriptions?.reduce((sum, sub) => {
        const price = sub.subscription_plans?.price || 0;
        return sum + Number(price);
      }, 0) || 0;

      // Calculate plan distribution
      const planCounts: { [key: string]: number } = {};
      subscriptions?.forEach(sub => {
        const planName = sub.subscription_plans?.name || 'Sem Plano';
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      });

      const planChartData = Object.entries(planCounts).map(([name, value]) => ({
        name,
        value,
      }));

      setStats({
        activeSubscribers: subscriptions?.length || 0,
        mrr,
        churnRate: 0, // Would need historical data
        pastDue: pastDueInvoices?.length || 0,
        openTickets: tickets?.length || 0,
      });

      setPlanData(planChartData);

      // Mock MRR evolution data
      setMrrData([
        { month: 'Jan', mrr: mrr * 0.7 },
        { month: 'Fev', mrr: mrr * 0.75 },
        { month: 'Mar', mrr: mrr * 0.8 },
        { month: 'Abr', mrr: mrr * 0.85 },
        { month: 'Mai', mrr: mrr * 0.9 },
        { month: 'Jun', mrr },
      ]);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching dashboard data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#FB8C00', '#4CAF50'];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
          <p className="text-muted-foreground">Visão geral da plataforma VirtualMercado</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="Assinantes Ativos"
            value={stats.activeSubscribers}
            icon={Users}
            loading={loading}
          />
          <StatCard
            title="MRR"
            value={`R$ ${stats.mrr.toFixed(2)}`}
            icon={DollarSign}
            loading={loading}
          />
          <StatCard
            title="Churn Rate"
            value={`${stats.churnRate.toFixed(1)}%`}
            icon={TrendingDown}
            loading={loading}
          />
          <StatCard
            title="Inadimplentes"
            value={stats.pastDue}
            icon={AlertCircle}
            loading={loading}
          />
          <StatCard
            title="Tickets Abertos"
            value={stats.openTickets}
            icon={Ticket}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Evolução do MRR</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} name="MRR" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Distribuição de Planos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EventFeed />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
