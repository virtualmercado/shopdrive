import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/admin/StatCard';
import { 
  Users, 
  Store, 
  ShoppingCart, 
  DollarSign, 
  LayoutDashboard,
  FileText,
  BarChart,
  Link,
  MessageSquare,
  LogOut
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type Section = 'dashboard' | 'subscribers' | 'invoices' | 'reports' | 'integrations' | 'support';

interface Subscriber {
  id: string;
  full_name: string;
  store_name: string | null;
  store_slug: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  subscriber_id: string;
  profiles: {
    full_name: string;
    store_name: string | null;
  };
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  customer_id: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });

  // Subscribers data
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  // Invoices data
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Support tickets data
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeSection === 'subscribers' && subscribers.length === 0) {
      loadSubscribers();
    } else if (activeSection === 'invoices' && invoices.length === 0) {
      loadInvoices();
    } else if (activeSection === 'support' && tickets.length === 0) {
      loadTickets();
    }
  }, [activeSection]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: storesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('store_slug', 'is', null);

      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { data: ordersData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'delivered');

      const revenue = ordersData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

      setStats({
        totalUsers: usersCount || 0,
        totalStores: storesCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue: revenue,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading dashboard stats:', error);
      }
      toast({
        title: 'Erro',
        description: 'Erro ao carregar estatísticas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, store_name, store_slug, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading subscribers:', error);
      }
      toast({
        title: 'Erro',
        description: 'Erro ao carregar assinantes',
        variant: 'destructive',
      });
    }
  };

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          amount,
          status,
          due_date,
          subscriber_id,
          profiles:subscriber_id (
            full_name,
            store_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading invoices:', error);
      }
      toast({
        title: 'Erro',
        description: 'Erro ao carregar faturas',
        variant: 'destructive',
      });
    }
  };

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          ticket_number,
          subject,
          status,
          priority,
          customer_id,
          created_at,
          profiles!support_tickets_customer_id_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading tickets:', error);
      }
      toast({
        title: 'Erro',
        description: 'Erro ao carregar tickets',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    { id: 'dashboard' as Section, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'subscribers' as Section, label: 'Assinantes', icon: Users },
    { id: 'invoices' as Section, label: 'Faturas e Pagamentos', icon: DollarSign },
    { id: 'reports' as Section, label: 'Relatórios', icon: BarChart },
    { id: 'integrations' as Section, label: 'Integrações', icon: Link },
    { id: 'support' as Section, label: 'Suporte', icon: MessageSquare },
  ];

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid':
      case 'closed':
        return 'default';
      case 'pending':
      case 'open':
        return 'secondary';
      case 'overdue':
      case 'urgent':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeSection === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
                <p className="text-muted-foreground mt-1">
                  Visão geral da plataforma VirtualMercado
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  title="Total de Usuários"
                  value={stats.totalUsers}
                  color="info"
                  loading={loading}
                />
                <StatCard
                  icon={Store}
                  title="Total de Lojas"
                  value={stats.totalStores}
                  color="primary"
                  loading={loading}
                />
                <StatCard
                  icon={ShoppingCart}
                  title="Total de Pedidos"
                  value={stats.totalOrders}
                  color="warning"
                  loading={loading}
                />
                <StatCard
                  icon={DollarSign}
                  title="Receita Total"
                  value={`R$ ${stats.totalRevenue.toFixed(2)}`}
                  color="success"
                  loading={loading}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Bem-vindo ao Painel Administrativo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Utilize o menu lateral para navegar entre as diferentes seções de gerenciamento da plataforma.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Subscribers Section */}
          {activeSection === 'subscribers' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Assinantes</h2>
                <p className="text-muted-foreground mt-1">
                  Gerenciar usuários e lojas da plataforma
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lista de Assinantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Nome da Loja</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data de Cadastro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscribers.map((subscriber) => (
                        <TableRow key={subscriber.id}>
                          <TableCell className="font-medium">{subscriber.full_name}</TableCell>
                          <TableCell>{subscriber.store_name || '-'}</TableCell>
                          <TableCell>{subscriber.store_slug || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={subscriber.store_slug ? 'default' : 'secondary'}>
                              {subscriber.store_slug ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(subscriber.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Invoices Section */}
          {activeSection === 'invoices' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Faturas e Pagamentos</h2>
                <p className="text-muted-foreground mt-1">
                  Gerenciar faturas e pagamentos dos assinantes
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lista de Faturas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vencimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.profiles?.full_name || '-'}
                          </TableCell>
                          <TableCell>{invoice.profiles?.store_name || '-'}</TableCell>
                          <TableCell>R$ {Number(invoice.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reports Section */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Relatórios</h2>
                <p className="text-muted-foreground mt-1">
                  Análises e relatórios da plataforma
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Relatórios</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Funcionalidade em desenvolvimento. Em breve você poderá visualizar gráficos e métricas detalhadas.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Integrations Section */}
          {activeSection === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Integrações</h2>
                <p className="text-muted-foreground mt-1">
                  Gerenciar integrações e APIs
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Integrações Disponíveis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Funcionalidade em desenvolvimento. Em breve você poderá configurar integrações com gateways de pagamento e outros serviços.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Support Section */}
          {activeSection === 'support' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Suporte</h2>
                <p className="text-muted-foreground mt-1">
                  Gerenciar tickets de suporte
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tickets de Suporte</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Assunto</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                          <TableCell>{ticket.profiles?.full_name || '-'}</TableCell>
                          <TableCell>{ticket.subject}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(ticket.priority)}>
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(ticket.status)}>
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
