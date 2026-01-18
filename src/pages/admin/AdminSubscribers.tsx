import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search,
  MoreHorizontal,
  Eye,
  Ban,
  RefreshCw,
  ArrowUpCircle,
  History,
  Package,
  Trash2,
  Download,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { AccountDeletionModal } from "@/components/admin/AccountDeletionModal";
import { DataExportModal } from "@/components/admin/DataExportModal";
import { ChangePlanModal } from "@/components/admin/ChangePlanModal";
import { FinancialHistoryModal } from "@/components/admin/FinancialHistoryModal";
import { SuspendAccountModal } from "@/components/admin/SuspendAccountModal";
import { BlockAccountModal } from "@/components/admin/BlockAccountModal";

const AdminSubscribers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [financialHistoryModalOpen, setFinancialHistoryModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const { data: subscribers, isLoading, refetch } = useQuery({
    queryKey: ['admin-subscribers', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          store_name,
          email,
          created_at,
          store_slug,
          account_status
        `)
        .not('store_slug', 'is', null)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`store_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      if (statusFilter === "active") {
        query = query.eq('account_status', 'active');
      } else if (statusFilter === "suspenso") {
        query = query.eq('account_status', 'suspenso');
      } else if (statusFilter === "bloqueado") {
        query = query.eq('account_status', 'bloqueado');
      } else if (statusFilter === "exclusao_solicitada") {
        query = query.eq('account_status', 'exclusao_solicitada');
      } else if (statusFilter === "excluida") {
        query = query.eq('account_status', 'excluida');
      }

      const { data: profiles, error } = await query.limit(50);

      if (error) throw error;

      const subscriberData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, subscription_plans(name)')
            .eq('user_id', profile.id)
            .maybeSingle();

          const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          return {
            ...profile,
            planName: (subscription?.subscription_plans as any)?.name || 'Grátis',
            subscriptionStatus: subscription?.status || 'inactive',
            productCount: productCount || 0
          };
        })
      );

      return subscriberData;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-100 text-amber-800">Inadimplente</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  const getAccountStatusBadge = (status: string) => {
    switch (status) {
      case 'exclusao_solicitada':
        return <Badge className="bg-orange-100 text-orange-800">Exclusão solicitada</Badge>;
      case 'excluida':
        return <Badge variant="secondary">Excluída</Badge>;
      case 'suspenso':
        return <Badge className="bg-amber-100 text-amber-800">Suspenso</Badge>;
      case 'bloqueado':
        return <Badge variant="destructive">Bloqueado</Badge>;
      default:
        return null;
    }
  };

  // View Store action
  const handleViewStore = (subscriber: any) => {
    const storeUrl = `/loja/${subscriber.store_slug}`;
    
    if (subscriber.account_status === 'suspenso' || subscriber.account_status === 'bloqueado') {
      toast.info("Esta loja está atualmente desativada, mas pode ser visualizada", {
        action: {
          label: "Abrir mesmo assim",
          onClick: () => window.open(storeUrl, '_blank'),
        },
      });
    } else {
      window.open(storeUrl, '_blank');
    }
  };

  // Change Plan action
  const handleChangePlan = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setChangePlanModalOpen(true);
  };

  // Financial History action
  const handleFinancialHistory = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setFinancialHistoryModalOpen(true);
  };

  // Suspend/Reactivate action
  const handleSuspend = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setSuspendModalOpen(true);
  };

  // Block action
  const handleBlock = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setBlockModalOpen(true);
  };

  const handleOpenDeletion = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setDeletionModalOpen(true);
  };

  const handleOpenExport = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setExportModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gerenciar Assinantes</h2>
            <p className="text-sm text-muted-foreground">
              {subscribers?.length || 0} assinantes cadastrados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="suspenso">Suspensos</SelectItem>
                <SelectItem value="bloqueado">Bloqueados</SelectItem>
                <SelectItem value="exclusao_solicitada">Exclusão solicitada</SelectItem>
                <SelectItem value="excluida">Excluídos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Subscribers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : subscribers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum assinante encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  subscribers?.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell>
                        <div className="font-medium">{subscriber.store_name || 'Sem nome'}</div>
                        <div className="text-xs text-muted-foreground">
                          /{subscriber.store_slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subscriber.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscriber.planName}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {subscriber.productCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(subscriber.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subscriber.subscriptionStatus)}
                      </TableCell>
                      <TableCell>
                        {getAccountStatusBadge(subscriber.account_status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleViewStore(subscriber)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Visualizar Loja
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangePlan(subscriber)}>
                              <ArrowUpCircle className="h-4 w-4 mr-2" />
                              Alterar Plano
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleFinancialHistory(subscriber)}>
                              <History className="h-4 w-4 mr-2" />
                              Histórico Financeiro
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenExport(subscriber)}>
                              <Download className="h-4 w-4 mr-2" />
                              Exportar dados
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleSuspend(subscriber)}
                              className="text-amber-600"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              {subscriber.account_status === 'suspenso' ? 'Reativar Conta' : 'Suspender Conta'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleBlock(subscriber)}
                              className={subscriber.account_status === 'bloqueado' ? 'text-green-600' : 'text-destructive'}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              {subscriber.account_status === 'bloqueado' ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
                            </DropdownMenuItem>
                            {subscriber.account_status === 'exclusao_solicitada' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenDeletion(subscriber)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir conta definitivamente
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Modals */}
        <AccountDeletionModal
          subscriber={selectedSubscriber}
          open={deletionModalOpen}
          onOpenChange={setDeletionModalOpen}
        />

        <DataExportModal
          subscriber={selectedSubscriber}
          open={exportModalOpen}
          onOpenChange={setExportModalOpen}
        />

        <ChangePlanModal
          subscriber={selectedSubscriber}
          open={changePlanModalOpen}
          onOpenChange={setChangePlanModalOpen}
        />

        <FinancialHistoryModal
          subscriber={selectedSubscriber}
          open={financialHistoryModalOpen}
          onOpenChange={setFinancialHistoryModalOpen}
        />

        <SuspendAccountModal
          subscriber={selectedSubscriber}
          open={suspendModalOpen}
          onOpenChange={setSuspendModalOpen}
        />

        <BlockAccountModal
          subscriber={selectedSubscriber}
          open={blockModalOpen}
          onOpenChange={setBlockModalOpen}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminSubscribers;
