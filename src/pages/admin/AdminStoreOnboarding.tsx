import { useState } from "react";
import { AdminPagination, useClientPagination } from "@/components/admin/AdminPagination";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Search, ExternalLink, RefreshCw, Copy, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  useAdminOnboardingStores,
  type OnboardingAdminFilter,
} from "@/hooks/useAdminOnboardingStores";

const CLASS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  STORE_READY: { label: "Pronta", variant: "default" },
  STORE_EXEMPT_OPERATIONAL: { label: "Operacional / isenta", variant: "secondary" },
  STORE_RECOVERY_REQUIRED: { label: "Recuperação pendente", variant: "destructive" },
  STORE_NEW_REQUIRED: { label: "Nova / sem configuração", variant: "outline" },
};

const STEP_LABELS: Record<string, string> = {
  company: "Empresa",
  visual: "Identidade visual",
  contacts: "Contatos",
  banner: "Banner principal",
  categories: "Categorias",
  products: "Produtos",
  navigation: "Navegação",
  institutional: "Textos institucionais",
};

const AdminStoreOnboarding = () => {
  const [filter, setFilter] = useState<OnboardingAdminFilter>("incomplete");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { rows, loading, recompute, setExempt, setAiAccess } = useAdminOnboardingStores(filter, search);
  const pager = useClientPagination(rows, [filter, search]);

  const handleAiAccess = async (storeId: string, enabled: boolean) => {
    setBusyId(storeId);
    try {
      await setAiAccess({ storeId, enabled });
      toast.success(enabled ? "IA de imagens autorizada para esta loja." : "Autorização de IA removida.");
    } catch {
      toast.error("Não foi possível atualizar a autorização de IA.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRecompute = async (storeId: string) => {
    setBusyId(storeId);
    try {
      await recompute(storeId);
      toast.success("Progresso recalculado.");
    } catch {
      toast.error("Não foi possível recalcular.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExempt = async (storeId: string, exempt: boolean) => {
    setBusyId(storeId);
    try {
      await setExempt({ storeId, exempt });
      toast.success(exempt ? "Loja marcada como isenta." : "Isenção removida.");
    } catch {
      toast.error("Não foi possível atualizar a isenção.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configuração das lojas</h1>
          <p className="text-muted-foreground text-sm">
            Identifique lojas incompletas e acompanhe o progresso de configuração de cada assinante.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, endereço da loja ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as OnboardingAdminFilter)}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="ready">Lojas prontas</SelectItem>
                <SelectItem value="incomplete">Lojas incompletas</SelectItem>
                <SelectItem value="in_progress">Em configuração</SelectItem>
                <SelectItem value="never_started">Nunca começou</SelectItem>
                <SelectItem value="recovery_pending">Recuperação pendente</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhuma loja encontrada para este filtro.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Categorias</TableHead>
                    <TableHead>Logo</TableHead>
                    <TableHead>Banner</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Etapa atual</TableHead>
                    <TableHead>Configuração mínima</TableHead>
                    <TableHead>IA</TableHead>
                    <TableHead>Identidade IA</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((r) => {
                    const cls = CLASS_LABELS[r.classification] ?? { label: r.classification, variant: "outline" as const };
                    return (
                      <TableRow key={r.store_id}>
                        <TableCell>
                          <div className="font-medium">{r.store_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">/{r.store_slug || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy") : "—"}
                          <div className="text-xs text-muted-foreground">
                            {r.last_activity ? `ativo ${format(new Date(r.last_activity), "dd/MM/yyyy")}` : "sem registro"}
                          </div>
                        </TableCell>
                        <TableCell>{r.metrics.active_products ?? 0}</TableCell>
                        <TableCell>{r.metrics.categories ?? 0}</TableCell>
                        <TableCell>{r.metrics.has_logo ? "Sim" : "Não"}</TableCell>
                        <TableCell>{r.metrics.has_banner ? "Sim" : "Não"}</TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <Progress value={r.progress_percent} className="h-2 w-16" />
                            <span className="text-xs font-medium">{r.progress_percent}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cls.variant}>{cls.label}</Badge>
                          {r.manual_exempt && (
                            <div className="text-xs text-muted-foreground mt-1">isenta manual</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.current_step ? STEP_LABELS[r.current_step] ?? r.current_step : "concluída"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.activation_readiness === "READY" ? "default" : "outline"}>
                            {r.activation_readiness === "READY" ? "Configuração mínima concluída" : "Configuração mínima pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={r.ai_image_enabled ? "default" : "outline"}>
                            {r.ai_image_enabled ? "Autorizada" : "Não autorizada"}
                          </Badge>
                          <div className="text-muted-foreground mt-1">
                            {r.ai_generations_24h} em 24h
                            {r.ai_last_generation_at
                              ? ` · ${format(new Date(r.ai_last_generation_at), "dd/MM HH:mm")}`
                              : ""}
                          </div>
                          {r.ai_last_error && (
                            <div className="text-destructive mt-1 max-w-[160px] truncate" title={r.ai_last_error}>
                              erro: {r.ai_last_error}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={
                              r.applied_palette_id
                                ? "default"
                                : r.brand_status === "error"
                                  ? "destructive"
                                  : r.recommended_palette_id
                                    ? "secondary"
                                    : "outline"
                            }
                          >
                            {r.applied_palette_id
                              ? "Aplicada"
                              : r.brand_status === "error"
                                ? "Falha"
                                : r.recommended_palette_id
                                  ? "Recomendada"
                                  : "Não analisada"}
                          </Badge>
                          <div className="text-muted-foreground mt-1 max-w-[180px]">
                            {r.recommended_palette_id
                              ? `sugerida: ${r.recommended_palette_id} · ${r.recommended_layout_id ?? "—"}`
                              : "sem sugestão"}
                          </div>
                          {r.applied_palette_id && (
                            <div className="text-muted-foreground max-w-[180px]">
                              aplicada: {r.applied_palette_id} · {r.applied_layout_id ?? "—"}
                            </div>
                          )}
                          {r.brand_analyzed_at && (
                            <div className="text-muted-foreground">
                              análise {format(new Date(r.brand_analyzed_at), "dd/MM HH:mm")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{r.onboarding_source ?? "—"}</TableCell>
                        <TableCell>
                          {busyId === r.store_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={!r.store_slug}
                                  onClick={() => window.open(`/${r.store_slug}`, "_blank")}
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" /> Ver loja pública
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/lojista/configuracao-loja`
                                    );
                                    toast.success("Link de configuração copiado.");
                                  }}
                                >
                                  <Copy className="mr-2 h-4 w-4" /> Copiar link do onboarding
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRecompute(r.store_id)}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Recalcular progresso
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExempt(r.store_id, !r.manual_exempt)}>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  {r.manual_exempt ? "Remover isenção" : "Marcar como isenta"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAiAccess(r.store_id, !r.ai_image_enabled)}>
                                  <Sparkles className="mr-2 h-4 w-4" />
                                  {r.ai_image_enabled ? "Remover autorização de IA" : "Autorizar IA para teste"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!loading && rows.length > 0 && (
              <div className="px-4 pb-4">
                <AdminPagination page={pager.page} totalItems={pager.totalItems} onPageChange={pager.setPage} itemLabel="lojas" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminStoreOnboarding;
