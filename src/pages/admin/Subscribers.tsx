import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: string;
  status: string;
  created_at: string;
  current_period_end: string;
  subscription_plans: {
    name: string;
    price: number;
  } | null;
  profiles: {
    full_name: string;
    store_name: string | null;
  } | null;
}

const Subscribers = () => {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          created_at,
          current_period_end,
          user_id,
          subscription_plans (
            name,
            price
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = data?.map(sub => sub.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, store_name')
        .in('id', userIds);

      // Merge the data
      const mergedData = (data || []).map(sub => {
        const profile = profilesData?.find(p => p.id === sub.user_id);
        return {
          ...sub,
          profiles: profile ? {
            full_name: profile.full_name,
            store_name: profile.store_name
          } : null
        };
      });

      setSubscriptions(mergedData as any);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast({
        title: 'Erro ao carregar assinantes',
        description: 'Não foi possível carregar a lista de assinantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (subscriptionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: newStatus })
        .eq('id', subscriptionId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: 'O status da assinatura foi atualizado com sucesso.',
      });

      fetchSubscriptions();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status da assinatura.',
        variant: 'destructive',
      });
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = 
      sub.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.profiles?.store_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trialing: 'secondary',
      canceled: 'destructive',
      past_due: 'destructive',
      paused: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Assinantes</h1>
          <p className="text-muted-foreground">Visualize e gerencie todas as assinaturas da plataforma</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trialing">Teste</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
                <SelectItem value="past_due">Vencido</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assinante</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.profiles?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>{sub.profiles?.store_name || 'N/A'}</TableCell>
                    <TableCell>{sub.subscription_plans?.name || 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>R$ {sub.subscription_plans?.price?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={sub.status}
                        onValueChange={(value) => handleStatusChange(sub.id, value)}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="trialing">Teste</SelectItem>
                          <SelectItem value="canceled">Cancelado</SelectItem>
                          <SelectItem value="past_due">Vencido</SelectItem>
                          <SelectItem value="paused">Pausado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSubscriptions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum assinante encontrado</p>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Subscribers;
