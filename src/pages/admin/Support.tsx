import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatCard } from '@/components/admin/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TicketDetailsModal } from '@/components/admin/TicketDetailsModal';
import { useTickets } from '@/hooks/useTickets';
import { Search, Ticket, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    waiting: 0,
    resolved: 0,
    avgResolutionTime: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    category: '',
  });
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { fetchTickets, loading } = useTickets();

  useEffect(() => {
    loadTickets();
  }, [filters]);

  const loadTickets = async () => {
    const data = await fetchTickets(filters);
    setTickets(data);

    const open = data.filter((t: any) => t.status === 'open').length;
    const inProgress = data.filter((t: any) => t.status === 'in_progress').length;
    const waiting = data.filter((t: any) => t.status === 'waiting').length;
    const resolved = data.filter((t: any) => t.status === 'closed').length;

    setStats({
      open,
      inProgress,
      waiting,
      resolved,
      avgResolutionTime: 0,
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      open: 'bg-blue-500',
      in_progress: 'bg-yellow-500',
      waiting: 'bg-orange-500',
      closed: 'bg-green-500',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-500',
      medium: 'bg-blue-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500',
    };
    return <Badge className={colors[priority as keyof typeof colors] || ''}>{priority}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Suporte</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="Abertos" value={stats.open} icon={Ticket} />
          <StatCard title="Em Andamento" value={stats.inProgress} icon={Clock} />
          <StatCard title="Aguardando Cliente" value={stats.waiting} icon={AlertCircle} />
          <StatCard title="Resolvidos (30d)" value={stats.resolved} icon={CheckCircle} />
          <StatCard title="Tempo Médio" value={`${stats.avgResolutionTime}h`} icon={Clock} />
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, assunto ou cliente..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="waiting">Aguardando</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setFilters({ search: '', status: '', priority: '', category: '' })}
          >
            Limpar Filtros
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum ticket encontrado
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono font-semibold">{ticket.ticket_number}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{ticket.profiles?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{ticket.profiles?.store_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.category}</Badge>
                    </TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(ticket.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setModalOpen(true);
                        }}
                      >
                        Ver/Responder
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TicketDetailsModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          loadTickets();
        }}
        ticket={selectedTicket}
      />
    </AdminLayout>
  );
}
