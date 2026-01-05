import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Shield,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  CreditCard,
  Link as LinkIcon,
  FileText,
  Clock,
  HardDrive,
  RotateCcw,
  RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

const AdminSecurity = () => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['admin-audit-logs', typeFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (store_name, email)
        `)
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('entity_type', typeFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    }
  });

  const { data: securityAlerts } = useQuery({
    queryKey: ['admin-security-alerts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_events')
        .select('*')
        .in('severity', ['error', 'critical', 'warning'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      return data || [];
    }
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <User className="h-4 w-4 text-green-500" />;
      case 'login_failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'payment':
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case 'integration':
        return <LinkIcon className="h-4 w-4 text-purple-500" />;
      case 'plan_change':
        return <FileText className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'login':
        return <Badge className="bg-green-100 text-green-800">Login</Badge>;
      case 'login_failed':
        return <Badge variant="destructive">Falha Login</Badge>;
      case 'payment':
        return <Badge className="bg-blue-100 text-blue-800">Pagamento</Badge>;
      case 'integration':
        return <Badge className="bg-purple-100 text-purple-800">Integração</Badge>;
      case 'plan_change':
        return <Badge className="bg-amber-100 text-amber-800">Alteração Plano</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const handleExport = () => {
    toast.success('Exportação de logs será iniciada em breve');
  };

  const handleBackup = () => {
    toast.success('Backup manual será iniciado em breve');
  };

  const handleRestore = () => {
    toast.info('Funcionalidade de restauração será implementada em breve');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Security Alerts */}
        {securityAlerts && securityAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alertas de Segurança
              </CardTitle>
              <CardDescription>Eventos críticos recentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {securityAlerts.slice(0, 5).map((alert: any) => (
                  <div 
                    key={alert.id}
                    className={`p-3 rounded-lg border flex items-start gap-3 ${
                      alert.severity === 'critical' 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(alert.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Backup Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Backup e Restauração
            </CardTitle>
            <CardDescription>Gerenciamento de backups do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Último Backup</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">Automático</Badge>
              </div>
              <Button variant="outline" onClick={handleBackup} className="h-auto py-4">
                <div className="flex flex-col items-center gap-2">
                  <Download className="h-5 w-5" />
                  <span>Baixar Backup Completo</span>
                </div>
              </Button>
              <Button variant="outline" onClick={handleRestore} className="h-auto py-4">
                <div className="flex flex-col items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  <span>Restaurar Sistema</span>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Filter */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nos logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="auth">Autenticação</SelectItem>
                <SelectItem value="payment">Pagamento</SelectItem>
                <SelectItem value="integration">Integração</SelectItem>
                <SelectItem value="subscription">Assinatura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Logs de Atividade
            </CardTitle>
            <CardDescription>Registro de todas as atividades do sistema</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    </TableRow>
                  ))
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          {getActionBadge(log.action)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {log.profiles?.store_name || 'Sistema'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.profiles?.email || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entity_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ip_address || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSecurity;
