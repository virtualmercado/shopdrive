import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SubscriberDetailsModal } from '@/components/admin/SubscriberDetailsModal';
import { useSubscribers } from '@/hooks/useSubscribers';
import { Search, Download, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    planId: '',
  });
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { fetchSubscribers, loading } = useSubscribers();

  useEffect(() => {
    loadSubscribers();
  }, [filters]);

  const loadSubscribers = async () => {
    const data = await fetchSubscribers(filters);
    setSubscribers(data);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-500',
      trialing: 'bg-blue-500',
      cancelled: 'bg-red-500',
      past_due: 'bg-yellow-500',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>{status}</Badge>;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gerenciar Assinantes</h1>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou loja..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trialing">Trial</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="past_due">Inadimplente</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setFilters({ search: '', status: '', planId: '' })}>
            Limpar Filtros
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assinante</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : subscribers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum assinante encontrado
                  </TableCell>
                </TableRow>
              ) : (
                subscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {getInitials(subscriber.full_name)}
                        </div>
                        <span className="font-medium">{subscriber.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{subscriber.id}</TableCell>
                    <TableCell>{subscriber.store_name || 'Sem loja'}</TableCell>
                    <TableCell>
                      {subscriber.subscriptions?.[0]?.subscription_plans?.name || 'Sem plano'}
                    </TableCell>
                    <TableCell>
                      {subscriber.subscriptions?.[0]
                        ? getStatusBadge(subscriber.subscriptions[0].status)
                        : <Badge variant="outline">Sem assinatura</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {subscriber.last_activity
                        ? formatDistanceToNow(new Date(subscriber.last_activity), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSubscriber(subscriber);
                          setModalOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <SubscriberDetailsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        subscriber={selectedSubscriber}
      />
    </AdminLayout>
  );
}
