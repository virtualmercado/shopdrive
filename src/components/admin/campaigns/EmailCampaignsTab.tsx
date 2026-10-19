import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ADMIN_PAGE_SIZE, getPageRange, getTotalPages } from "@/lib/adminPagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, Plus, RefreshCw, Eye, Ban, Pencil, Send, Image as ImageIcon, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { validCampaignInformation, validCampaignContent, validCampaignAudienceDates } from "@/lib/emailCampaignValidation";
import MediaSelectorModal from "@/components/admin/MediaSelectorModal";
import { CampaignMedia, campaignImageError, validCampaignImageLink, campaignImageAspectWarning } from "@/lib/campaignImage";

type CampaignStatus = "draft" | "ready" | "processing" | "completed" | "completed_with_errors" | "cancelled";
type RecipientStatus = "pending" | "queued" | "sent" | "failed" | "suppressed" | "cancelled";

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  ready: { label: "Pronta", color: "bg-blue-100 text-blue-800" },
  processing: { label: "Em processamento", color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Concluída", color: "bg-green-100 text-green-800" },
  completed_with_errors: { label: "Concluída com falhas", color: "bg-orange-100 text-orange-800" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800" },
};

const RECIPIENT_STATUS: Record<RecipientStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  queued: { label: "Na fila", variant: "secondary" },
  sent: { label: "Enviado", variant: "default" },
  failed: { label: "Falha", variant: "destructive" },
  suppressed: { label: "Descadastrado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const PLAN_OPTIONS = [
  { value: "all", label: "Todos os planos" },
  { value: "gratis", label: "GRÁTIS" },
  { value: "pro", label: "PRO" },
  { value: "premium", label: "PREMIUM" },
  { value: "marca", label: "MARCA" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "pending", label: "Pagamento pendente" },
  { value: "suspenso", label: "Suspenso" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "exclusao_solicitada", label: "Exclusão solicitada" },
  { value: "excluida", label: "Excluído" },
];
const PRODUCTS_OPTIONS = [
  { value: "all", label: "Qualquer quantidade" },
  { value: "none", label: "Sem produtos" },
  { value: "1_20", label: "1 a 20 produtos" },
  { value: "21_150", label: "21 a 150 produtos" },
  { value: "over_150", label: "Mais de 150 produtos" },
];
const SETUP_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "ready", label: "Configuração pronta" },
  { value: "incomplete", label: "Configuração incompleta" },
];

interface AudienceFilters {
  search: string;
  plan: string;
  status: string;
  products: string;
  setup: string;
  date_from: string;
  date_to: string;
}
const EMPTY_FILTERS: AudienceFilters = {
  search: "", plan: "all", status: "all", products: "all", setup: "all", date_from: "", date_to: "",
};

const filtersToPayload = (f: AudienceFilters) => ({
  ...(f.search.trim() ? { search: f.search.trim() } : {}),
  plan: f.plan, status: f.status, products: f.products, setup: f.setup,
  ...(f.date_from ? { date_from: new Date(f.date_from + "T00:00:00").toISOString() } : {}),
  ...(f.date_to ? { date_to: new Date(f.date_to + "T23:59:59").toISOString() } : {}),
});

const filtersSummary = (f: Record<string, unknown> | null | undefined): string => {
  if (!f) return "Todos os assinantes com e-mail";
  const parts: string[] = [];
  const plan = PLAN_OPTIONS.find((o) => o.value === f.plan);
  if (plan && f.plan !== "all") parts.push(`Plano: ${plan.label}`);
  const st = STATUS_OPTIONS.find((o) => o.value === f.status);
  if (st && f.status !== "all") parts.push(`Status: ${st.label}`);
  const pr = PRODUCTS_OPTIONS.find((o) => o.value === f.products);
  if (pr && f.products !== "all") parts.push(`Produtos: ${pr.label}`);
  const su = SETUP_OPTIONS.find((o) => o.value === f.setup);
  if (su && f.setup !== "all") parts.push(`Configuração: ${su.label}`);
  if (typeof f.search === "string" && f.search) parts.push(`Busca: "${f.search}"`);
  if (f.date_from) parts.push(`Desde ${format(new Date(String(f.date_from)), "dd/MM/yyyy")}`);
  if (f.date_to) parts.push(`Até ${format(new Date(String(f.date_to)), "dd/MM/yyyy")}`);
  return parts.length ? parts.join(" · ") : "Todos os assinantes com e-mail";
};

const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

interface CampaignRow {
  id: string; name: string; subject: string; status: CampaignStatus;
  is_archived: boolean; archived_at: string | null; archived_by: string | null;
  can_delete: boolean; can_archive: boolean; can_restore: boolean;
  audience_filters: Record<string, unknown>; creator_email: string | null;
  created_at: string; confirmed_at: string | null; completed_at: string | null; cancelled_at: string | null;
  total_recipients: number; total_queued: number; total_sent: number; total_failed: number; total_suppressed: number;
}

interface CampaignDetail extends CampaignRow {
  content: string; cta_label: string | null; cta_url: string | null; pending: number;
  updated_at: string; started_at: string | null;
  media_id: string | null; image_url: string | null; image_alt: string | null;
  image_link_url: string | null; image_name: string | null;
}

interface RecipientRow {
  id: string; store_name: string | null; store_slug: string | null; email: string;
  status: RecipientStatus; last_error: string | null;
  queued_at: string | null; sent_at: string | null; suppressed_at: string | null;
}

interface AudienceCount { filtered: number; suppressed: number; eligible: number }

const WIZARD_STEPS = ["Informações", "Público", "Conteúdo", "Prévia", "Revisão"];

export const EmailCampaignsTab = () => {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [managementTarget, setManagementTarget] = useState<{ campaign: CampaignRow; action: "delete" | "archive" | "restore" } | null>(null);
  const [managing, setManaging] = useState(false);
  const listGeneration = useRef(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CampaignRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setDebouncedSearch(search); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCampaigns = useCallback(async (p = page) => {
    const generation = ++listGeneration.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_managed_email_campaigns", {
        p_search: debouncedSearch || null,
        p_status: statusFilter,
        p_date_from: dateFrom ? new Date(dateFrom + "T00:00:00").toISOString() : null,
        p_date_to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : null,
        p_limit: ADMIN_PAGE_SIZE,
        p_offset: getPageRange(p).from,
        p_archive: archiveFilter,
      });
      if (error) throw error;
      if (generation !== listGeneration.current) return;
      const result = data as unknown as { total: number; counts: Record<string, number>; rows: CampaignRow[] };
      setRows(result.rows || []);
      setCounts(result.counts || {});
      setTotal(result.total || 0);
      if (p > getTotalPages(result.total || 0)) setPage(getTotalPages(result.total || 0));
    } catch (err) {
      if (generation !== listGeneration.current) return;
      console.error("Erro ao listar campanhas:", err);
      toast.error("Erro ao carregar campanhas");
    } finally {
      if (generation === listGeneration.current) setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, dateFrom, dateTo, archiveFilter]);

  useEffect(() => { void fetchCampaigns(page); }, [fetchCampaigns, page]);

  // Atualiza enquanto houver campanha em processamento.
  useEffect(() => {
    if (!rows.some((r) => r.status === "processing")) return;
    const t = setInterval(() => void fetchCampaigns(page), 5000);
    return () => clearInterval(t);
  }, [rows, fetchCampaigns, page]);

  const openNew = () => { setEditingId(null); setWizardOpen(true); };
  const openEdit = (c: CampaignRow) => { setEditingId(c.id); setWizardOpen(true); };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.rpc("admin_cancel_email_campaign", { p_campaign_id: cancelTarget.id });
      if (error) throw error;
      const r = data as unknown as { cancelled_recipients: number };
      toast.success(`Campanha cancelada. ${r.cancelled_recipients} destinatário(s) ainda não enviados foram cancelados. E-mails já aceitos pelo servidor de envio não podem ser revertidos.`);
      setCancelTarget(null);
      void fetchCampaigns(page);
    } catch (err) {
      console.error("Erro ao cancelar campanha:", err);
      toast.error("Não foi possível cancelar a campanha");
    } finally {
      setCancelling(false);
    }
  };

  const handleManagement = async () => {
    if (!managementTarget || managing) return;
    setManaging(true);
    const { campaign, action } = managementTarget;
    try {
      const rpc = { delete: "admin_delete_email_campaign", archive: "admin_archive_email_campaign", restore: "admin_restore_email_campaign" } as const;
      const { error } = await supabase.rpc(rpc[action], { p_campaign_id: campaign.id });
      if (error) throw error;
      toast.success({ delete: "Campanha excluída", archive: "Campanha arquivada", restore: "Campanha restaurada" }[action]);
      setManagementTarget(null);
      await fetchCampaigns(page);
    } catch (err) {
      const message = typeof err === "object" && err !== null && "message" in err ? String(err.message) : "";
      toast.error(message.startsWith("Esta campanha") ? message : "Não foi possível atualizar a campanha. Atualize a lista e tente novamente.");
      void fetchCampaigns(page);
    } finally { setManaging(false); }
  };

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const cards = [
    { label: "Total", value: totalAll },
    { label: "Rascunhos", value: (counts.draft || 0) + (counts.ready || 0) },
    { label: "Em processamento", value: counts.processing || 0 },
    { label: "Concluídas", value: counts.completed || 0 },
    { label: "Com falhas", value: counts.completed_with_errors || 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1">
            <Label>Buscar</Label>
            <Input placeholder="Nome ou assunto da campanha" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full lg:w-56">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(CAMPAIGN_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full lg:w-48">
            <Label>Exibição</Label>
            <Select value={archiveFilter} onValueChange={(v) => { setPage(1); setArchiveFilter(v); }}>
              <SelectTrigger aria-label="Exibição"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Não arquivadas</SelectItem>
                <SelectItem value="archived">Arquivadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => void fetchCampaigns(page)} aria-label="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Nova campanha
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Destinatários</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead className="text-right">Suprimidos</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhuma campanha encontrada.
                </TableCell>
              </TableRow>
            ) : rows.map((c) => {
              const st = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <button className="text-left font-medium hover:underline" onClick={() => setDetailId(c.id)}>
                      {c.name}
                    </button>
                    <p className="text-xs text-muted-foreground truncate max-w-[260px]">{c.subject}</p>
                  </TableCell>
                  <TableCell><Badge className={st.color}>{st.label}</Badge>{c.is_archived && <Badge variant="outline" className="ml-1">Arquivada</Badge>}</TableCell>
                  <TableCell className="text-right">{c.total_recipients}</TableCell>
                  <TableCell className="text-right">{c.total_sent}</TableCell>
                  <TableCell className="text-right">{c.total_failed}</TableCell>
                  <TableCell className="text-right">{c.total_suppressed}</TableCell>
                  <TableCell>{fmtDate(c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(c.id)} aria-label="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!c.is_archived && (c.status === "draft" || c.status === "ready") && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {!c.is_archived && (c.status === "draft" || c.status === "ready" || c.status === "processing") && (
                        <Button variant="ghost" size="icon" onClick={() => setCancelTarget(c)} aria-label="Cancelar campanha">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {([
                        { action: "delete", allowed: c.can_delete, label: "Excluir definitivamente", Icon: Trash2 },
                        { action: "archive", allowed: c.can_archive, label: "Arquivar", Icon: Archive },
                        { action: "restore", allowed: c.can_restore, label: "Restaurar da lista arquivada", Icon: ArchiveRestore },
                      ] as const).filter((a) => a.allowed).map(({ action, label, Icon }) => (
                        <Tooltip key={action}>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={label} onClick={() => setManagementTarget({ campaign: c, action })} disabled={managing}>
                              <Icon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="px-4 pb-4">
          <AdminPagination page={page} totalItems={total} onPageChange={setPage} itemLabel="campanhas" disabled={loading} />
        </div>
      </Card>

      <CampaignWizard
        open={wizardOpen}
        campaignId={editingId}
        onClose={() => setWizardOpen(false)}
        onSaved={() => void fetchCampaigns(page)}
      />

      <CampaignDetailDialog
        campaignId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void fetchCampaigns(page)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Destinatários ainda não enviados serão cancelados e não receberão o e-mail.
              E-mails já aceitos pelo servidor de envio não podem ser revertidos.
              O histórico da campanha será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!managementTarget} onOpenChange={(o) => { if (!o && !managing) setManagementTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{managementTarget?.action === "delete" ? "Excluir esta campanha?" : managementTarget?.action === "archive" ? "Arquivar campanha?" : "Restaurar da lista arquivada?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {managementTarget?.action === "delete"
                ? "Esta campanha ainda não possui histórico de envio e será removida permanentemente. Esta ação não poderá ser desfeita."
                : managementTarget?.action === "archive"
                  ? "A campanha será removida da listagem principal, mas todo o histórico de destinatários e envios continuará preservado e poderá ser consultado posteriormente."
                  : "A campanha voltará à listagem principal, mantendo seu status e histórico. Nenhum e-mail será reenviado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={managing}>Cancelar</AlertDialogCancel>
            <Button variant={managementTarget?.action === "delete" ? "destructive" : "default"} onClick={() => void handleManagement()} disabled={managing}>
              {managing ? "Aguarde…" : managementTarget?.action === "delete" ? "Excluir campanha" : managementTarget?.action === "archive" ? "Arquivar" : "Restaurar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ============================= WIZARD =============================

interface WizardProps {
  open: boolean;
  campaignId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const CampaignWizard = ({ open, campaignId, onClose, onSaved }: WizardProps) => {
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [image, setImage] = useState<CampaignMedia | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [filters, setFilters] = useState<AudienceFilters>(EMPTY_FILTERS);
  const [audience, setAudience] = useState<AudienceCount | null>(null);
  const [counting, setCounting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countGeneration = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Carrega rascunho existente para edição.
  useEffect(() => {
    if (!open) return;
    setStep(0); setPreviewHtml(""); setAudience(null);
    setImage(null); setImageAlt(""); setImageLink(""); setMediaOpen(false);
    if (!campaignId) {
      setId(null); setName(""); setSubject(""); setContent(""); setCtaLabel(""); setCtaUrl(""); setFilters(EMPTY_FILTERS);
      return;
    }
    void (async () => {
      const { data, error } = await supabase.rpc("admin_get_email_campaign", { p_campaign_id: campaignId });
      if (error || !data) { toast.error("Erro ao carregar campanha"); onCloseRef.current(); return; }
      const c = data as unknown as CampaignDetail;
      setId(c.id); setName(c.name); setSubject(c.subject); setContent(c.content);
      setCtaLabel(c.cta_label || ""); setCtaUrl(c.cta_url || "");
      setImageAlt(c.image_alt || ""); setImageLink(c.image_link_url || "");
      if (c.media_id) {
        const { data: media, error: mediaError } = await supabase.from("media_files").select("*").eq("id", c.media_id).single();
        if (mediaError || !media) { toast.error("Erro ao carregar a imagem da Biblioteca Master"); onCloseRef.current(); return; }
        setImage(media);
      }
      setFilters({ ...EMPTY_FILTERS, ...(c.audience_filters as Partial<AudienceFilters>) });
    })();
  }, [open, campaignId]);

  const countAudience = useCallback(async (f: AudienceFilters) => {
    const generation = ++countGeneration.current;
    setCounting(true);
    try {
      const { data, error } = await supabase.rpc("admin_count_campaign_audience", { p_filters: filtersToPayload(f) });
      if (generation !== countGeneration.current) return;
      if (error) throw error;
      setAudience(data as unknown as AudienceCount);
    } catch (err) {
      if (generation !== countGeneration.current) return;
      console.error("Erro ao contar público:", err);
      setAudience(null);
    } finally {
      if (generation === countGeneration.current) setCounting(false);
    }
  }, []);

  useEffect(() => {
    if (!open || step !== 1) return;
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(() => void countAudience(filters), 400);
    return () => { if (countTimer.current) clearTimeout(countTimer.current); };
  }, [open, step, filters, countAudience]);

  const validStep0 = validCampaignInformation(name, subject);
  const validImage = !image || (!campaignImageError(image) && imageAlt.length <= 200 && validCampaignImageLink(imageLink));
  const validStep2 = validCampaignContent(content, ctaLabel, ctaUrl) && validImage;
  const validAudience = validCampaignAudienceDates(filters.date_from, filters.date_to)
    && !counting && !!audience && audience.eligible > 0;

  const save = async (): Promise<string | null> => {
    if (!validImage) { toast.error("Revise a imagem e o link HTTPS da imagem."); return null; }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("admin_save_email_campaign", {
        p_id: id,
        p_name: name.trim(),
        p_subject: subject.trim(),
        p_content: content,
        p_cta_label: ctaLabel.trim() || null,
        p_cta_url: ctaLabel.trim() ? ctaUrl.trim() : null,
        p_filters: filtersToPayload(filters),
        p_media_id: image?.id || null,
        p_image_alt: image ? imageAlt.trim() || null : null,
        p_image_link_url: image ? imageLink.trim() || null : null,
      });
      if (error) throw error;
      const newId = data as string;
      setId(newId);
      onSaved();
      return newId;
    } catch (err) {
      console.error("Erro ao salvar campanha:", err);
      const msg = err instanceof Error && err.message.includes("invalid_cta_url")
        ? "URL do botão inválida: use um endereço https:// válido."
        : "Erro ao salvar a campanha";
      toast.error(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 0 && !validStep0) { toast.error("Preencha nome e assunto"); return; }
    if (step === 1 && !validAudience) { toast.error("Revise os filtros e aguarde um público elegível"); return; }
    if (step === 2 && !validStep2) {
      toast.error(ctaLabel.trim() ? "Revise o conteúdo e a URL do botão (https://...)" : "Preencha o conteúdo da mensagem");
      return;
    }
    const savedId = await save();
    if (!savedId) return;
    if (step === 2) {
      const { data, error } = await supabase.rpc("admin_preview_email_campaign", {
        p_subject: subject.trim(), p_content: content,
        p_cta_label: ctaLabel.trim() || null, p_cta_url: ctaLabel.trim() ? ctaUrl.trim() : null,
        p_media_id: image?.id || null, p_image_alt: image ? imageAlt.trim() || null : null,
        p_image_link_url: image ? imageLink.trim() || null : null,
      });
      if (error) { toast.error("Erro ao gerar prévia"); return; }
      setPreviewHtml(data as string);
    }
    if (step === 1) void countAudience(filters);
    setStep((s) => Math.min(s + 1, 4));
  };

  const confirmAndSend = async () => {
    if (!id || !validStep0 || !validStep2 || !validAudience) return;
    setConfirming(true);
    try {
      const { data, error } = await supabase.rpc("admin_confirm_email_campaign", { p_campaign_id: id });
      if (error) throw error;
      const r = data as unknown as { already: boolean; queued: number; suppressed: number };
      if (r.already) {
        toast.info("Esta campanha já havia sido confirmada. Nenhum envio duplicado foi criado.");
      } else {
        toast.success(`Campanha confirmada: ${r.queued} e-mail(s) na fila${r.suppressed ? `, ${r.suppressed} descadastrado(s) ignorado(s)` : ""}. O envio é processado gradualmente.`);
      }
      setConfirmOpen(false);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao confirmar campanha:", err);
      toast.error("Não foi possível confirmar a campanha");
    } finally {
      setConfirming(false);
    }
  };

  const setF = (patch: Partial<AudienceFilters>) => {
    countGeneration.current += 1;
    setAudience(null);
    setFilters((f) => ({ ...f, ...patch }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onSaved(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          <DialogDescription>Etapa {step + 1} de 5 — {WIZARD_STEPS[step]}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 mb-4">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Nome interno da campanha *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Promoção de novembro" />
            </div>
            <div>
              <Label>Assunto do e-mail *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Ex.: Novidades da ShopDrive para sua loja" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Busca</Label>
                <Input value={filters.search} onChange={(e) => setF({ search: e.target.value })} placeholder="Loja, responsável, e-mail..." />
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={filters.plan} onValueChange={(v) => setF({ plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(v) => setF({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produtos</Label>
                <Select value={filters.products} onValueChange={(v) => setF({ products: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCTS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Configuração da loja</Label>
                <Select value={filters.setup} onValueChange={(v) => setF({ setup: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SETUP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Cadastro de</Label>
                  <Input type="date" value={filters.date_from} onChange={(e) => setF({ date_from: e.target.value })} />
                </div>
                <div>
                  <Label>até</Label>
                  <Input type="date" value={filters.date_to} onChange={(e) => setF({ date_to: e.target.value })} />
                </div>
              </div>
            </div>
            <Card className="p-4 bg-muted/40">
              {counting ? (
                <p className="text-sm text-muted-foreground">Calculando público...</p>
              ) : audience ? (
                <div className="text-sm space-y-1">
                  <p><strong>{audience.filtered}</strong> lojas atendem aos filtros</p>
                  <p><strong>{audience.suppressed}</strong> estão descadastradas</p>
                  <p className="text-base font-semibold">{audience.eligible} receberão a campanha</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ajuste os filtros para ver o público elegível.</p>
              )}
            </Card>
            <p className="text-xs text-muted-foreground">
              Somente lojas com e-mail válido são elegíveis. Descadastrados nunca recebem campanhas.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Mensagem *</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                maxLength={20000}
                placeholder={"Escreva a mensagem da campanha.\n\nUse linhas em branco para separar parágrafos."}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Texto simples: parágrafos e quebras de linha são preservados. HTML não é permitido por segurança.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Texto do botão (opcional)</Label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60} placeholder="Ex.: Conhecer novidades" />
              </div>
              <div>
                <Label>URL do botão</Label>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." disabled={!ctaLabel.trim()} />
              </div>
            </div>
            {ctaLabel.trim() && !/^https:\/\/[^\s"<>]+$/.test(ctaUrl.trim()) && (
              <p className="text-xs text-destructive">A URL do botão deve começar com https://</p>
            )}
            <div className="border-t pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Imagem da campanha <span className="text-muted-foreground font-normal">(Opcional)</span></Label>
                <Button variant="outline" size="sm" onClick={() => setMediaOpen(true)}>
                  <ImageIcon className="h-4 w-4 mr-2" />{image ? "Trocar imagem" : "Selecionar da Biblioteca"}
                </Button>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Imagem recomendada: 1200 × 600 px (proporção 2:1 horizontal). Formatos: JPG, PNG ou WebP. Peso recomendado até 300 KB • máximo 1,5 MB.</p>
                <p>Para melhor visualização em celulares e computadores, prefira imagens horizontais e evite imagens quadradas ou verticais.</p>
              </div>
              {image && <>
                <div className="flex items-center gap-3 min-w-0">
                  <img src={image.url} alt={imageAlt || subject} className="w-24 h-20 object-contain border rounded-md bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{image.name}</p>
                    <p className="text-xs text-muted-foreground">{image.width && image.height ? `${image.width} × ${image.height} px · ` : ""}{(image.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="icon" title="Remover imagem" aria-label="Remover imagem" onClick={() => { setImage(null); setImageAlt(""); setImageLink(""); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {campaignImageAspectWarning(image) && <p role="status" className="text-xs text-secondary-foreground bg-secondary/10 rounded-md px-3 py-2">
                  <span className="text-muted-foreground">Atenção: esta imagem não possui o formato horizontal recomendado e poderá ocupar muito espaço no e-mail. Para melhor resultado, utilize uma imagem na proporção aproximada de 2:1.</span>
                </p>}
                <div><Label htmlFor="campaign-image-alt">Texto alternativo da imagem</Label><Input id="campaign-image-alt" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} maxLength={200} placeholder={subject} /></div>
                <div><Label htmlFor="campaign-image-link">Ao clicar na imagem, abrir:</Label><Input id="campaign-image-link" value={imageLink} onChange={(e) => setImageLink(e.target.value)} maxLength={2000} placeholder="https://..." /></div>
                {!validCampaignImageLink(imageLink) && <p className="text-xs text-destructive">O link da imagem deve ser um endereço HTTPS válido.</p>}
              </>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            {previewHtml ? (
              <iframe title="Prévia do e-mail" srcDoc={previewHtml} className="w-full h-[480px] border rounded-md bg-white" sandbox="" />
            ) : (
              <Skeleton className="h-[480px] w-full" />
            )}
            <p className="text-xs text-muted-foreground mt-2">
              O link de descadastro exibido é fictício na prévia; cada destinatário recebe o seu próprio link.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <Card className="p-4 space-y-2">
              <p><span className="text-muted-foreground">Nome:</span> <strong>{name}</strong></p>
              <p><span className="text-muted-foreground">Assunto:</span> {subject}</p>
              <p><span className="text-muted-foreground">Público:</span> {filtersSummary(filtersToPayload(filters))}</p>
              {audience && (
                <>
                  <p><span className="text-muted-foreground">Elegíveis pelos filtros:</span> {audience.filtered}</p>
                  <p><span className="text-muted-foreground">Descadastrados (não recebem):</span> {audience.suppressed}</p>
                  <p className="font-semibold">Total final: {audience.eligible} destinatário(s)</p>
                </>
              )}
              {ctaLabel.trim() && <p><span className="text-muted-foreground">Botão:</span> {ctaLabel} → {ctaUrl}</p>}
              <p className="break-words"><span className="text-muted-foreground">Imagem:</span> {image?.name || "Nenhuma"}</p>
              {image && <img src={image.url} alt={imageAlt || subject} className="w-32 h-24 object-contain" />}
              {image && imageLink.trim() && <p className="break-all"><span className="text-muted-foreground">Link da imagem:</span> {imageLink.trim()}</p>}
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground mb-1">Conteúdo:</p>
              <p className="whitespace-pre-wrap max-h-48 overflow-y-auto">{content}</p>
            </Card>
            <p className="text-xs text-muted-foreground">
              Ao confirmar, o público é congelado e os e-mails entram na fila com prioridade inferior aos e-mails
              transacionais. O envio começa imediatamente e é processado gradualmente (cerca de 50 por minuto).
            </p>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>Voltar</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void save()} disabled={saving || !validStep0}>
              {saving ? "Salvando..." : "Salvar rascunho"}
            </Button>
            {step < 4 ? (
              <Button onClick={() => void next()} disabled={saving}>Avançar</Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={confirming || !validStep0 || !validStep2 || !validAudience}>
                <Send className="h-4 w-4 mr-2" /> Confirmar e enviar campanha
              </Button>
            )}
          </div>
        </DialogFooter>

        <MediaSelectorModal isOpen={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(file) => { setImage(file); setPreviewHtml(""); }} campaignImagesOnly title="Imagem da campanha — Biblioteca Master" />

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar envio da campanha</AlertDialogTitle>
              <AlertDialogDescription>
                O público será congelado agora e {audience?.eligible ?? 0} destinatário(s) entrarão na fila de envio.
                Esta ação inicia o envio real dos e-mails e não pode ser desfeita para mensagens já enviadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirming}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmAndSend} disabled={confirming}>
                {confirming ? "Confirmando..." : "Confirmar e enviar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

// ============================= DETALHES =============================

interface DetailProps {
  campaignId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

const CampaignDetailDialog = ({ campaignId, onClose, onChanged }: DetailProps) => {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recPage, setRecPage] = useState(1);
  const [recStatus, setRecStatus] = useState("all");
  const [loadingRec, setLoadingRec] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!campaignId) return;
    const { data, error } = await supabase.rpc("admin_get_email_campaign", { p_campaign_id: campaignId });
    if (error) { toast.error("Erro ao carregar campanha"); return; }
    setCampaign(data as unknown as CampaignDetail);
  }, [campaignId]);

  const fetchRecipients = useCallback(async (p = recPage) => {
    if (!campaignId) return;
    setLoadingRec(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_campaign_recipients", {
        p_campaign_id: campaignId, p_status: recStatus, p_limit: 50, p_offset: (p - 1) * 50,
      });
      if (error) throw error;
      const r = data as unknown as { total: number; rows: RecipientRow[] };
      setRecipients(r.rows || []);
      setRecTotal(r.total || 0);
    } catch (err) {
      console.error("Erro ao listar destinatários:", err);
    } finally {
      setLoadingRec(false);
    }
  }, [campaignId, recPage, recStatus]);

  useEffect(() => {
    if (!campaignId) { setCampaign(null); setRecipients([]); setPreviewHtml(""); setShowPreview(false); return; }
    setRecPage(1); setRecStatus("all");
    void fetchDetail();
  }, [campaignId, fetchDetail]);

  useEffect(() => { if (campaignId) void fetchRecipients(recPage); }, [campaignId, recPage, recStatus, fetchRecipients]);

  // Atualiza enquanto a campanha estiver em processamento.
  useEffect(() => {
    if (!campaignId || campaign?.status !== "processing") return;
    const t = setInterval(() => { void fetchDetail(); void fetchRecipients(recPage); }, 5000);
    return () => clearInterval(t);
  }, [campaignId, campaign?.status, fetchDetail, fetchRecipients, recPage]);

  const togglePreview = async () => {
    if (showPreview) { setShowPreview(false); return; }
    if (!previewHtml && campaign) {
      const { data, error } = await supabase.rpc("admin_preview_email_campaign", {
        p_subject: campaign.subject, p_content: campaign.content,
        p_cta_label: campaign.cta_label, p_cta_url: campaign.cta_url,
        p_media_id: campaign.media_id, p_image_alt: campaign.image_alt,
        p_image_link_url: campaign.image_link_url,
      });
      if (error) { toast.error("Erro ao gerar prévia"); return; }
      setPreviewHtml(data as string);
    }
    setShowPreview(true);
  };

  const st = campaign ? CAMPAIGN_STATUS[campaign.status] : null;

  return (
    <Dialog open={!!campaignId} onOpenChange={(o) => { if (!o) { onChanged(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign?.name || "Campanha"}
            {st && <Badge className={st.color}>{st.label}</Badge>}
            {campaign?.is_archived && <Badge variant="outline">Arquivada</Badge>}
          </DialogTitle>
          <DialogDescription>{campaign?.subject}</DialogDescription>
        </DialogHeader>

        {campaign && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3"><p className="text-xs text-muted-foreground">Destinatários</p><p className="text-xl font-bold">{campaign.total_recipients}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Enviados</p><p className="text-xl font-bold">{campaign.total_sent}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Falhas</p><p className="text-xl font-bold">{campaign.total_failed}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Suprimidos</p><p className="text-xl font-bold">{campaign.total_suppressed}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold">{campaign.pending}</p></Card>
            </div>

            <Card className="p-4 text-sm space-y-1">
              <p><span className="text-muted-foreground">Público:</span> {filtersSummary(campaign.audience_filters)}</p>
              <p><span className="text-muted-foreground">Criada por:</span> {campaign.creator_email || "—"}</p>
              <p><span className="text-muted-foreground">Criada em:</span> {fmtDate(campaign.created_at)}</p>
              {campaign.confirmed_at && <p><span className="text-muted-foreground">Confirmada em:</span> {fmtDate(campaign.confirmed_at)}</p>}
              {campaign.completed_at && <p><span className="text-muted-foreground">Concluída em:</span> {fmtDate(campaign.completed_at)}</p>}
              {campaign.cancelled_at && <p><span className="text-muted-foreground">Cancelada em:</span> {fmtDate(campaign.cancelled_at)}</p>}
              {campaign.archived_at && <p><span className="text-muted-foreground">Arquivada em:</span> {fmtDate(campaign.archived_at)}</p>}
              {campaign.cta_label && <p><span className="text-muted-foreground">Botão:</span> {campaign.cta_label} → {campaign.cta_url}</p>}
              <p className="break-words"><span className="text-muted-foreground">Imagem:</span> {campaign.image_name || "Nenhuma"}</p>
              {campaign.image_url && <img src={campaign.image_url} alt={campaign.image_alt || campaign.subject} className="w-32 h-24 object-contain" />}
              {campaign.image_link_url && <p className="break-all"><span className="text-muted-foreground">Link da imagem:</span> {campaign.image_link_url}</p>}
            </Card>

            <div>
              <Button variant="outline" size="sm" onClick={() => void togglePreview()}>
                <Eye className="h-4 w-4 mr-2" /> {showPreview ? "Ocultar mensagem" : "Ver mensagem"}
              </Button>
              {showPreview && previewHtml && (
                <iframe title="Mensagem da campanha" srcDoc={previewHtml} className="w-full h-[420px] border rounded-md bg-white mt-3" sandbox="" />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Destinatários</h4>
                <Select value={recStatus} onValueChange={(v) => { setRecStatus(v); setRecPage(1); }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(RECIPIENT_STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRec ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                    ))
                  ) : recipients.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum destinatário.</TableCell></TableRow>
                  ) : recipients.map((r) => {
                    const rs = RECIPIENT_STATUS[r.status] || RECIPIENT_STATUS.pending;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.store_name || r.store_slug || "—"}</TableCell>
                        <TableCell className="text-xs">{r.email}</TableCell>
                        <TableCell><Badge variant={rs.variant}>{rs.label}</Badge></TableCell>
                        <TableCell className="text-xs">{fmtDate(r.sent_at || r.suppressed_at || r.queued_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.last_error || ""}>
                          {r.status === "failed" ? (r.last_error || "Falha ao enviar") : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <AdminPagination page={recPage} totalItems={recTotal} onPageChange={setRecPage} itemLabel="destinatários" disabled={loadingRec} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmailCampaignsTab;
