import { AdminPagination } from "@/components/admin/AdminPagination";
import { ADMIN_PAGE_SIZE } from "@/lib/adminPagination";
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
  AlertTriangle,
  Globe,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  ShieldOff,
  Lock,
  FileWarning,
  UserX,
  Loader2,
  Gift,
  Copy as CopyIcon
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useCallback, useEffect } from "react";
import { type SubscriberRow, planLabel, statusLabel, buildSubscribersCsv } from "@/lib/subscriberContacts";
import { toast } from "sonner";
import { AccountDeletionModal } from "@/components/admin/AccountDeletionModal";
import { DataExportModal } from "@/components/admin/DataExportModal";
import { ChangePlanModal } from "@/components/admin/ChangePlanModal";
import { FinancialHistoryModal } from "@/components/admin/FinancialHistoryModal";
import { SuspendAccountModal } from "@/components/admin/SuspendAccountModal";
import { BlockAccountModal } from "@/components/admin/BlockAccountModal";
import { StoreDetailsDialog } from "@/components/admin/StoreDetailsDialog";
import { CloneStoreModal } from "@/components/admin/CloneStoreModal";
import { GrantTrialModal } from "@/components/admin/GrantTrialModal";
import { ManageTrialModal } from "@/components/admin/ManageTrialModal";
import { useAdminPlanTrials, trialDaysLeft } from "@/hooks/useAdminPlanTrials";
import { PLAN_DISPLAY_NAMES, getPlanFromPlanId } from "@/lib/planLimits";

const EXPORT_MAX = 10000;
const CONTACT_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "with_email", label: "Com e-mail" },
  { value: "without_email", label: "Sem e-mail" },
  { value: "with_phone", label: "Com telefone/WhatsApp" },
  { value: "without_phone", label: "Sem telefone/WhatsApp" },
  { value: "with_both", label: "Com e-mail e telefone/WhatsApp" },
];
const PRODUCT_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sem produtos" },
  { value: "1_20", label: "1 a 20" },
  { value: "21_150", label: "21 a 150" },
  { value: "over_150", label: "Acima de 150" },
];
const SETUP_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "incomplete", label: "Configuração incompleta" },
  { value: "ready", label: "Pronta" },
];
const PLAN_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "gratis", label: "GRÁTIS" },
  { value: "pro", label: "PRO" },
  { value: "premium", label: "PREMIUM" },
  { value: "marca", label: "MARCA" },
];
const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const AdminSubscribers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [productsFilter, setProductsFilter] = useState("all");
  const [setupFilter, setSetupFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState<null | "pdf" | "csv">(null);
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm.trim()); setCurrentPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const withReset = (setter: (v: string) => void) => (v: string) => { setter(v); setCurrentPage(1); };
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [financialHistoryModalOpen, setFinancialHistoryModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [grantTrialModalOpen, setGrantTrialModalOpen] = useState(false);
  const [manageTrialModalOpen, setManageTrialModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = ADMIN_PAGE_SIZE;

  const filterArgs = {
    p_search: debouncedSearch || null,
    p_plan: planFilter,
    p_status: statusFilter,
    p_contact: contactFilter,
    p_date_from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : null,
    p_date_to: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : null,
    p_products: productsFilter,
    p_setup: setupFilter,
  };

  const toSubscriber = (r: SubscriberRow) => ({
    ...r,
    email: r.account_email || r.profile_email,
    planName: planLabel(r.plan_code),
    subscriptionStatus: r.subscription_status,
  });

  const { data: pageData, isLoading, refetch } = useQuery({
    queryKey: ['admin-subscribers', filterArgs, currentPage],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('admin_list_subscribers', {
        ...filterArgs,
        p_limit: PAGE_SIZE,
        p_offset: (currentPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      return data as { total: number; counts: Record<string, number>; counts_all: number; rows: SubscriberRow[] };
    },
  });

  const statusCounts = pageData?.counts || {};
  const totalCount = pageData?.counts_all || 0;
  const filteredTotal = pageData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const subscribers = (pageData?.rows || []).map(toSubscriber);

  // Temporary plan trials (entitlements) for the visible page only
  const { data: trialMap } = useAdminPlanTrials(subscribers.map((s) => s.id));
  const productCounts = Object.fromEntries(subscribers.map((s) => [s.id, s.product_count])) as Record<string, number>;

  const describeFilters = () => {
    const f: string[] = [];
    if (debouncedSearch) f.push(`Busca: "${debouncedSearch}"`);
    if (planFilter !== 'all') f.push(`Plano: ${planLabel(planFilter)}`);
    if (statusFilter !== 'all') f.push(`Status: ${statusLabel(statusFilter)}`);
    if (contactFilter !== 'all') f.push(`Contato: ${CONTACT_OPTIONS.find(o => o.value === contactFilter)?.label}`);
    if (productsFilter !== 'all') f.push(`Produtos: ${PRODUCT_OPTIONS.find(o => o.value === productsFilter)?.label}`);
    if (setupFilter !== 'all') f.push(`Configuração: ${SETUP_OPTIONS.find(o => o.value === setupFilter)?.label}`);
    if (dateFrom) f.push(`Cadastro desde ${format(new Date(`${dateFrom}T00:00:00`), 'dd/MM/yyyy')}`);
    if (dateTo) f.push(`Cadastro até ${format(new Date(`${dateTo}T00:00:00`), 'dd/MM/yyyy')}`);
    return f.length ? f.join(' · ') : 'Nenhum (todos os assinantes)';
  };

  const handleExport = async (kind: "pdf" | "csv") => {
    setExporting(kind);
    try {
      // Busca todo o resultado filtrado no servidor (não só a página atual).
      const all: SubscriberRow[] = [];
      for (let offset = 0; offset < EXPORT_MAX; offset += 1000) {
        const { data, error } = await (supabase.rpc as any)('admin_list_subscribers', {
          ...filterArgs, p_limit: 1000, p_offset: offset,
        });
        if (error) throw error;
        all.push(...(data.rows as SubscriberRow[]));
        if (all.length >= data.total || data.rows.length < 1000) break;
      }
      const stamp = format(new Date(), 'yyyy-MM-dd_HHmm');
      const fmtDate = (iso: string) => format(new Date(iso), 'dd/MM/yyyy');
      if (kind === 'csv') {
        const blob = new Blob([buildSubscribersCsv(all, fmtDate)], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `assinantes_${stamp}.csv`);
      } else {
        const { generateSubscribersPdf } = await import('@/lib/subscribersPdf');
        const blob = generateSubscribersPdf(all, describeFilters());
        downloadBlob(blob, `assinantes_${stamp}.pdf`);
      }
      await (supabase.rpc as any)('admin_log_subscribers_export', {
        p_format: kind, p_count: all.length, p_filters: { ...filterArgs, descricao: describeFilters() },
      });
      toast.success(`Exportação gerada com ${all.length} lojas`);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar a exportação');
    } finally {
      setExporting(null);
    }
  };

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

  const STATUS_CARDS = [
    { key: 'all', label: 'Todos', icon: Users, color: 'text-foreground' },
    { key: 'active', label: 'Ativos', icon: CheckCircle, color: 'text-green-600' },
    { key: 'inactive', label: 'Inativos', icon: XCircle, color: 'text-muted-foreground' },
    { key: 'pending', label: 'Pagamento pendente', icon: Clock, color: 'text-blue-600' },
    { key: 'suspenso', label: 'Suspensos', icon: ShieldOff, color: 'text-amber-600' },
    { key: 'bloqueado', label: 'Bloqueados', icon: Lock, color: 'text-destructive' },
    { key: 'exclusao_solicitada', label: 'Exclusão solicitada', icon: FileWarning, color: 'text-orange-600' },
    { key: 'excluida', label: 'Excluídos', icon: UserX, color: 'text-muted-foreground' },
  ];

  // Visual-only derivation. Real account states (suspended/blocked/deleted)
  // always take precedence over the subscription-derived label.
  const getStatusBadge = (status: string, accountStatus?: string) => {
    if (accountStatus === 'excluida') return <Badge variant="secondary">Excluída</Badge>;
    if (accountStatus === 'bloqueado') return <Badge variant="destructive">Bloqueado</Badge>;
    if (accountStatus === 'suspenso') return <Badge className="bg-amber-100 text-amber-800">Suspenso</Badge>;
    switch (status) {
      case 'free':
        return <Badge variant="outline">Grátis</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-100 text-amber-800">Inadimplente</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800">Pagamento pendente</Badge>;
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
    const storeUrl = `/${subscriber.store_slug}`;
    
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

  const handleOpenDetails = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setDetailsDialogOpen(true);
  };

  const handleOpenClone = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setCloneModalOpen(true);
  };

  const handleGrantTrial = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setGrantTrialModalOpen(true);
  };

  const handleManageTrial = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setManageTrialModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Gerenciar Assinantes</h2>
            <p className="text-sm text-muted-foreground">
              {totalCount} assinantes cadastrados
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={!!exporting || filteredTotal === 0}>
              {exporting === 'csv' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')} disabled={!!exporting || filteredTotal === 0}>
              {exporting === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar PDF
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

        {/* Commercial filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar loja, responsável, e-mail, telefone ou slug..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <FilterSelect label="Plano" value={planFilter} onChange={withReset(setPlanFilter)} options={PLAN_OPTIONS} />
              <FilterSelect label="Status" value={statusFilter} onChange={handleStatusFilterChange} options={[{ value: 'all', label: 'Todos' }, ...Object.keys(STATUS_LABELS_LOCAL).map(k => ({ value: k, label: STATUS_LABELS_LOCAL[k] }))]} />
              <FilterSelect label="Contato" value={contactFilter} onChange={withReset(setContactFilter)} options={CONTACT_OPTIONS} />
              <FilterSelect label="Produtos" value={productsFilter} onChange={withReset(setProductsFilter)} options={PRODUCT_OPTIONS} />
              <FilterSelect label="Configuração" value={setupFilter} onChange={withReset(setSetupFilter)} options={SETUP_OPTIONS} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" aria-label="Cadastro desde" value={dateFrom} onChange={(e) => withReset(setDateFrom)(e.target.value)} />
                <Input type="date" aria-label="Cadastro até" value={dateTo} onChange={(e) => withReset(setDateTo)(e.target.value)} />
              </div>
            </div>
            <p className="text-sm font-medium">{filteredTotal} {filteredTotal === 1 ? 'loja encontrada' : 'lojas encontradas'}</p>
          </CardContent>
        </Card>

        {/* Status Quick-Filter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {STATUS_CARDS.map(({ key, label, icon: Icon, color }) => {
            const count = key === 'all' ? totalCount : (statusCounts[key] || 0);
            const isActive = statusFilter === key;
            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isActive ? 'ring-2 ring-primary shadow-md' : ''
                }`}
                onClick={() => handleStatusFilterChange(key)}
              >
                <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="text-xs text-muted-foreground leading-tight">{label}</span>
                  <span className="text-lg font-bold">{count}</span>
                </CardContent>
              </Card>
            );
          })}
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
                        {subscriber.email || 'Não informado'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline">{subscriber.planName}</Badge>
                          {trialMap?.[subscriber.id]?.active && (
                            <Badge className="border border-dashed border-primary/50 bg-primary/10 text-primary hover:bg-primary/10">
                              <Gift className="mr-1 h-3 w-3" />
                              {PLAN_DISPLAY_NAMES[getPlanFromPlanId(trialMap[subscriber.id].active!.trial_plan)].toUpperCase()}
                              {" • TESTE "}
                              {trialDaysLeft(trialMap[subscriber.id].active!.ends_at)}d
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {productCounts?.[subscriber.id] ?? '…'}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(subscriber.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subscriber.subscriptionStatus, subscriber.account_status)}
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
                            <DropdownMenuItem onClick={() => handleOpenDetails(subscriber)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewStore(subscriber)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Visualizar Loja
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleChangePlan(subscriber)}>
                              <ArrowUpCircle className="h-4 w-4 mr-2" />
                              Alterar Plano
                            </DropdownMenuItem>
                            {trialMap?.[subscriber.id]?.active ? (
                              <DropdownMenuItem onClick={() => handleManageTrial(subscriber)}>
                                <Gift className="h-4 w-4 mr-2" />
                                Gerenciar degustação
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleGrantTrial(subscriber)}>
                                <Gift className="h-4 w-4 mr-2" />
                                Conceder degustação
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleFinancialHistory(subscriber)}>
                              <History className="h-4 w-4 mr-2" />
                              Histórico Financeiro
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenExport(subscriber)}>
                              <Download className="h-4 w-4 mr-2" />
                              Exportar dados
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenClone(subscriber)}>
                              <CopyIcon className="h-4 w-4 mr-2" />
                              Duplicar loja
                            </DropdownMenuItem>
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

        {/* Pagination */}
        {filteredTotal > 0 && (
          <AdminPagination
            page={safePage}
            totalItems={filteredTotal}
            onPageChange={setCurrentPage}
            itemLabel="assinantes"
          />
        )}

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

        <StoreDetailsDialog
          store={selectedSubscriber}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />

        <CloneStoreModal
          subscriber={selectedSubscriber}
          open={cloneModalOpen}
          onOpenChange={setCloneModalOpen}
        />

        <GrantTrialModal
          subscriber={selectedSubscriber}
          history={selectedSubscriber ? trialMap?.[selectedSubscriber.id]?.history ?? [] : []}
          open={grantTrialModalOpen}
          onOpenChange={setGrantTrialModalOpen}
        />

        <ManageTrialModal
          subscriber={selectedSubscriber}
          trial={selectedSubscriber ? trialMap?.[selectedSubscriber.id]?.active ?? null : null}
          open={manageTrialModalOpen}
          onOpenChange={setManageTrialModalOpen}
        />
      </div>
    </AdminLayout>
  );
};

const STATUS_LABELS_LOCAL: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", pending: "Pagamento pendente", suspenso: "Suspenso",
  bloqueado: "Bloqueado", exclusao_solicitada: "Exclusão solicitada", excluida: "Excluído",
};

const FilterSelect = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-full" aria-label={label}>
      <span className="text-muted-foreground mr-1 text-xs">{label}:</span>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default AdminSubscribers;
