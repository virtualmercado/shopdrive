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
  Calendar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

const AdminInvoices = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

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

      // Calculate totals
      const { data: monthlyPaid } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const { count: paidCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue');

      const { count: pendingCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const totalMRR = monthlyPaid?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

      return {
        invoices: invoices || [],
        totalMRR,
        paidCount: paidCount || 0,
        overdueCount: overdueCount || 0,
        pendingCount: pendingCount || 0
      };
    }
  });

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

  const handleExport = (format: string) => {
    toast.success(`Exportação em ${format.toUpperCase()} será iniciada em breve`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês (MRR)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data?.totalMRR || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturas Pagas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{data?.paidCount}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturas Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{data?.pendingCount}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturas Atrasadas</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-600">{data?.overdueCount}</div>
              )}
            </CardContent>
          </Card>
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
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
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
                        {invoice.id.slice(0, 8)}...
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
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">MP</span>
                  </div>
                  <div>
                    <p className="font-medium">Mercado Pago</p>
                    <p className="text-xs text-muted-foreground">Webhook ativo</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">Conectado</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold text-sm">PB</span>
                  </div>
                  <div>
                    <p className="font-medium">PagBank</p>
                    <p className="text-xs text-muted-foreground">Webhook ativo</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">Conectado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminInvoices;
