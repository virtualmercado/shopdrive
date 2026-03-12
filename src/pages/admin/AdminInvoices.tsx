import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText,
  DollarSign,
  Download,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Calendar,
  Wallet,
  Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const AdminInvoices = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-invoices', statusFilter, searchTerm],
    queryFn: async () => {
      const today = new Date();
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Get invoices with subscriber info
      let query = supabase
        .from('invoices')
        .select(`
          *,
          profiles:subscriber_id (store_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      // Calculate totals — use paid_at for "received this month" and due_date for MRR
      const { data: monthlyPaid } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', monthStart)
        .lte('paid_at', monthEnd);

      const { data: monthlyMRR } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const { count: paidCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid')
        .gte('paid_at', monthStart)
        .lte('paid_at', monthEnd);

      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue');

      const { count: pendingCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const totalMRR = monthlyMRR?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      const totalReceived = monthlyPaid?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

      setLastUpdated(new Date());

      return {
        invoices: invoices || [],
        totalMRR,
        totalReceived,
        paidCount: paidCount || 0,
        overdueCount: overdueCount || 0,
        pendingCount: pendingCount || 0
      };
    }
  });

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Dados atualizados com sucesso");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paga</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Atrasada</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExport = (fmt: string) => {
    toast.success(`Exportação em ${fmt.toUpperCase()} será iniciada em breve`);
  };

  // Quick-filter cards config
  const STAT_CARDS = [
    { key: 'all', label: 'Receita do Mês (MRR)', icon: DollarSign, getValue: () => formatCurrency(data?.totalMRR || 0), color: 'text-green-600' },
    { key: 'received', label: 'Recebido no Mês', icon: Wallet, getValue: () => formatCurrency(data?.totalReceived || 0), color: 'text-emerald-600' },
    { key: 'paid', label: 'Faturas Pagas', icon: CheckCircle, getValue: () => String(data?.paidCount || 0), color: 'text-green-500' },
    { key: 'pending', label: 'Faturas Pendentes', icon: Clock, getValue: () => String(data?.pendingCount || 0), color: 'text-amber-500' },
    { key: 'overdue', label: 'Faturas Atrasadas', icon: XCircle, getValue: () => String(data?.overdueCount || 0), color: 'text-red-500' },
  ];

  const handleCardClick = (key: string) => {
    // MRR and Received cards don't filter
    if (key === 'all' || key === 'received') {
      setStatusFilter('all');
    } else {
      setStatusFilter(key);
    }
  };

  const activeCardKey = statusFilter === 'all' ? 'all' : statusFilter;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STAT_CARDS.map(({ key, label, icon: Icon, getValue, color }) => {
            const isActive = key === activeCardKey || (key === 'all' && statusFilter === 'all' && activeCardKey === 'all') || (key === 'received' && statusFilter === 'all');
            const isClickable = key !== 'all' && key !== 'received';
            return (
              <Card
                key={key}
                className={`transition-all ${isClickable ? 'cursor-pointer hover:shadow-md' : ''} ${
                  isClickable && statusFilter === key ? 'ring-2 ring-primary shadow-md' : ''
                }`}
                onClick={() => handleCardClick(key)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className={`text-2xl font-bold ${key === 'overdue' ? 'text-red-600' : key === 'all' || key === 'received' ? 'text-green-600' : ''}`}>
                      {getValue()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por assinante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Atrasadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Última atualização: {format(lastUpdated, "HH:mm")}
              </span>
            )}
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
          </div>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Assinante</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma fatura encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.invoices.map((invoice: any) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">
                        {invoice.invoice_id || invoice.id.slice(0, 8) + '...'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {invoice.profiles?.store_name || 'Sem nome'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.profiles?.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.paid_at 
                          ? format(new Date(invoice.paid_at), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Webhook Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status dos Webhooks de Pagamento</CardTitle>
            <CardDescription>Monitoramento de integrações de pagamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { code: "MP", name: "Mercado Pago", active: true, bgColor: "bg-blue-100", textColor: "text-blue-600" },
                { code: "PB", name: "PagBank", active: true, bgColor: "bg-green-100", textColor: "text-green-600" },
                { code: "ST", name: "Stone / Ton", active: false, bgColor: "bg-gray-100", textColor: "text-gray-600" },
                { code: "IP", name: "InfinitePay", active: false, bgColor: "bg-gray-100", textColor: "text-gray-600" },
              ].map((gw) => (
                <div key={gw.code} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${gw.bgColor} rounded-lg flex items-center justify-center`}>
                      <span className={`${gw.textColor} font-bold text-sm`}>{gw.code}</span>
                    </div>
                    <div>
                      <p className="font-medium">{gw.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {gw.active ? "Webhook ativo" : "Webhook não configurado"}
                      </p>
                    </div>
                  </div>
                  {gw.active ? (
                    <Badge className="bg-green-100 text-green-800">Conectado</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-500">Não configurado</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminInvoices;
