import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Users, DollarSign, Store, TrendingUp, Crown, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalStores: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch active subscriptions
      const { count: subsCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch subscriptions for revenue calculation
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(price)')
        .eq('status', 'active');

      const totalRevenue = subscriptions?.reduce((acc, sub) => {
        return acc + (Number(sub.subscription_plans?.price) || 0);
      }, 0) || 0;

      // Calculate monthly revenue (current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = subscriptions?.filter(sub => {
        const subDate = new Date(sub.created_at);
        return subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear;
      }).reduce((acc, sub) => {
        return acc + (Number(sub.subscription_plans?.price) || 0);
      }, 0) || 0;

      setStats({
        totalUsers: usersCount || 0,
        activeSubscriptions: subsCount || 0,
        totalRevenue,
        monthlyRevenue,
        totalStores: usersCount || 0, // Assuming each user has a store
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Erro ao carregar estatísticas',
        description: 'Não foi possível carregar as estatísticas da plataforma.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const adminStats = [
    {
      icon: Users,
      label: 'Total de Usuários',
      value: stats.totalUsers.toString(),
      change: '+12.5%',
      positive: true,
    },
    {
      icon: CreditCard,
      label: 'Assinaturas Ativas',
      value: stats.activeSubscriptions.toString(),
      change: '+8.2%',
      positive: true,
    },
    {
      icon: DollarSign,
      label: 'Receita Total',
      value: `R$ ${stats.totalRevenue.toFixed(2)}`,
      change: '+15.3%',
      positive: true,
    },
    {
      icon: TrendingUp,
      label: 'Receita Mensal',
      value: `R$ ${stats.monthlyRevenue.toFixed(2)}`,
      change: '+23.1%',
      positive: true,
    },
    {
      icon: Store,
      label: 'Lojas Ativas',
      value: stats.totalStores.toString(),
      change: '+5.7%',
      positive: true,
    },
    {
      icon: Crown,
      label: 'Taxa de Conversão',
      value: `${stats.totalUsers > 0 ? ((stats.activeSubscriptions / stats.totalUsers) * 100).toFixed(1) : 0}%`,
      change: '+2.4%',
      positive: true,
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-muted-foreground">Visão geral da plataforma VirtualMercado</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminStats.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <span className={`text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Ações Rápidas</h2>
            <div className="space-y-3">
              <a 
                href="/admin/subscribers" 
                className="block p-4 border rounded-lg hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Gerenciar Assinantes</p>
                    <p className="text-sm text-muted-foreground">Visualizar e editar assinaturas</p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </a>
              <a 
                href="/admin/plans" 
                className="block p-4 border rounded-lg hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Gerenciar Planos</p>
                    <p className="text-sm text-muted-foreground">Editar planos e preços</p>
                  </div>
                  <Crown className="h-5 w-5 text-primary" />
                </div>
              </a>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Atividades Recentes</h2>
            <div className="space-y-4">
              {[1, 2, 3].map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Nova assinatura</p>
                    <p className="text-xs text-muted-foreground">Há {index + 1} hora(s)</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
