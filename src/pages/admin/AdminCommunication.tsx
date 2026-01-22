import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  MoreVertical,
  Edit,
  Copy,
  Pause,
  Play,
  Archive,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  BarChart3,
  ExternalLink,
  Link as LinkIcon,
  Image,
  Monitor,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  useAdminBanners,
  useCreateBanner,
  useUpdateBanner,
  useDuplicateBanner,
  useReorderBanners,
  useBannerCounts,
  useBannerMetrics,
  useExportBannerEvents,
  BannerFormData,
  DashboardBanner,
  BannerStatus,
  BannerLinkType,
  BannerBadgeType,
} from "@/hooks/useDashboardBanners";

const INTERNAL_ROUTES = [
  { value: "/lojista", label: "Dashboard" },
  { value: "/lojista/products", label: "Produtos" },
  { value: "/lojista/orders", label: "Pedidos" },
  { value: "/lojista/customers", label: "Clientes" },
  { value: "/lojista/marketing", label: "Marketing" },
  { value: "/lojista/customize", label: "Personalizar" },
  { value: "/lojista/shipping", label: "Frete" },
  { value: "/lojista/payment-methods", label: "Meios de Pagamento" },
  { value: "/lojista/financeiro", label: "Financeiro" },
  { value: "/lojista/settings", label: "Configurações" },
  { value: "/lojista/support", label: "Suporte" },
  { value: "/central-de-ajuda", label: "Central de Ajuda" },
];

const STATUS_CONFIG: Record<BannerStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  active: { label: "Ativo", color: "bg-green-100 text-green-800" },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-800" },
  archived: { label: "Arquivado", color: "bg-red-100 text-red-800" },
};

const BADGE_TYPES: { value: BannerBadgeType; label: string }[] = [
  { value: "default", label: "Padrão" },
  { value: "info", label: "Informativo (Azul)" },
  { value: "success", label: "Sucesso (Verde)" },
  { value: "warning", label: "Atenção (Laranja)" },
  { value: "sponsored", label: "Patrocinado (Dourado)" },
];

const DEFAULT_FORM_DATA: BannerFormData = {
  title: "",
  subtitle: "",
  status: "draft",
  priority: 0,
  badge_text: "",
  badge_type: "default",
  is_sponsored: false,
  link_type: "internal",
  internal_route: "/lojista",
  external_url: "",
  open_in_new_tab: true,
  image_desktop_url: "",
  image_mobile_url: "",
  starts_at: "",
  ends_at: "",
};

const AdminCommunication = () => {
  const { data: banners, isLoading } = useAdminBanners();
  const { data: counts } = useBannerCounts();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const duplicateBanner = useDuplicateBanner();
  const reorderBanners = useReorderBanners();
  const exportEvents = useExportBannerEvents();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [editingBanner, setEditingBanner] = useState<DashboardBanner | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(DEFAULT_FORM_DATA);
  const [metricsFilter, setMetricsFilter] = useState(30);
  const [selectedBannerForMetrics, setSelectedBannerForMetrics] = useState<string | null>(null);

  const { data: selectedMetrics } = useBannerMetrics(selectedBannerForMetrics || "", metricsFilter);

  const handleOpenForm = (banner?: DashboardBanner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        subtitle: banner.subtitle || "",
        status: banner.status,
        priority: banner.priority,
        badge_text: banner.badge_text || "",
        badge_type: banner.badge_type || "default",
        is_sponsored: banner.is_sponsored,
        link_type: banner.link_type,
        internal_route: banner.internal_route || "/lojista",
        external_url: banner.external_url || "",
        open_in_new_tab: banner.open_in_new_tab,
        image_desktop_url: banner.image_desktop_url,
        image_mobile_url: banner.image_mobile_url || "",
        starts_at: banner.starts_at ? banner.starts_at.split("T")[0] : "",
        ends_at: banner.ends_at ? banner.ends_at.split("T")[0] : "",
      });
    } else {
      setEditingBanner(null);
      setFormData({
        ...DEFAULT_FORM_DATA,
        priority: (banners?.length || 0) + 1,
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBanner(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return false;
    }
    if (!formData.image_desktop_url.trim()) {
      toast.error("Imagem desktop é obrigatória");
      return false;
    }
    if (formData.link_type === "internal" && !formData.internal_route) {
      toast.error("Rota interna é obrigatória");
      return false;
    }
    if (formData.link_type === "external" && !formData.external_url?.startsWith("http")) {
      toast.error("URL externa deve começar com http:// ou https://");
      return false;
    }

    // Validate limits when activating
    if (formData.status === "active") {
      const currentActiveCount = banners?.filter(b => 
        b.status === "active" && b.id !== editingBanner?.id
      ).length || 0;
      const currentSponsoredCount = banners?.filter(b => 
        b.status === "active" && b.is_sponsored && b.id !== editingBanner?.id
      ).length || 0;

      if (currentActiveCount >= 6) {
        toast.error("Limite atingido: máximo 6 banners ativos. Pause ou arquive outro banner para ativar este.");
        return false;
      }
      if (formData.is_sponsored && currentSponsoredCount >= 2) {
        toast.error("Limite atingido: máximo 2 banners patrocinados ativos. Pause ou arquive outro banner patrocinado.");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const dataToSubmit = {
        ...formData,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : undefined,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : undefined,
        badge_text: formData.is_sponsored && !formData.badge_text ? "Patrocinado" : formData.badge_text,
      };

      if (editingBanner) {
        await updateBanner.mutateAsync({ id: editingBanner.id, formData: dataToSubmit });
        toast.success("Banner atualizado com sucesso!");
      } else {
        await createBanner.mutateAsync(dataToSubmit);
        toast.success("Banner criado com sucesso!");
      }
      handleCloseForm();
    } catch (error) {
      toast.error("Erro ao salvar banner");
      console.error(error);
    }
  };

  const handleStatusChange = async (banner: DashboardBanner, newStatus: BannerStatus) => {
    if (newStatus === "active") {
      const currentActiveCount = banners?.filter(b => b.status === "active" && b.id !== banner.id).length || 0;
      const currentSponsoredCount = banners?.filter(b => b.status === "active" && b.is_sponsored && b.id !== banner.id).length || 0;

      if (currentActiveCount >= 6) {
        toast.error("Limite de 6 banners ativos atingido");
        return;
      }
      if (banner.is_sponsored && currentSponsoredCount >= 2) {
        toast.error("Limite de 2 banners patrocinados ativos atingido");
        return;
      }
    }

    try {
      await updateBanner.mutateAsync({ id: banner.id, formData: { status: newStatus } });
      toast.success(`Banner ${STATUS_CONFIG[newStatus].label.toLowerCase()}`);
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDuplicate = async (bannerId: string) => {
    try {
      await duplicateBanner.mutateAsync(bannerId);
      toast.success("Banner duplicado com sucesso!");
    } catch (error) {
      toast.error("Erro ao duplicar banner");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (!banners || index === 0) return;
    const newOrder = [...banners];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    try {
      await reorderBanners.mutateAsync(newOrder.map(b => b.id));
    } catch (error) {
      toast.error("Erro ao reordenar");
    }
  };

  const handleMoveDown = async (index: number) => {
    if (!banners || index === banners.length - 1) return;
    const newOrder = [...banners];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    try {
      await reorderBanners.mutateAsync(newOrder.map(b => b.id));
    } catch (error) {
      toast.error("Erro ao reordenar");
    }
  };

  const handleExport = async () => {
    try {
      await exportEvents.mutateAsync({ bannerId: selectedBannerForMetrics || undefined, days: metricsFilter });
      toast.success("Exportação concluída!");
    } catch (error) {
      toast.error("Erro ao exportar dados");
    }
  };

  const activeBanners = banners?.filter(b => b.status === "active") || [];
  const sponsoredActiveBanners = activeBanners.filter(b => b.is_sponsored);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with Stats */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Central de Novidades</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie os banners do carrossel do Dashboard dos lojistas
            </p>
          </div>
          <Button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Banner
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total de Banners</p>
            <p className="text-2xl font-bold">{banners?.length || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-green-600">{activeBanners.length}/6</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Patrocinados Ativos</p>
            <p className="text-2xl font-bold text-amber-600">{sponsoredActiveBanners.length}/2</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Rascunhos</p>
            <p className="text-2xl font-bold text-gray-600">
              {banners?.filter(b => b.status === "draft").length || 0}
            </p>
          </Card>
        </div>

        {/* Tabs for List and Metrics */}
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">Lista de Banners</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card>
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordem</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="w-24">Link</TableHead>
                      <TableHead className="w-24">Patrocinado</TableHead>
                      <TableHead className="w-40">Período</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banners?.map((banner, index) => (
                      <TableRow key={banner.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <span className="text-sm text-muted-foreground">{index + 1}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === banners.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", STATUS_CONFIG[banner.status].color)}>
                            {STATUS_CONFIG[banner.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <img
                              src={banner.image_desktop_url}
                              alt=""
                              className="w-10 h-10 rounded object-cover"
                            />
                            <span className="font-medium">{banner.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {banner.link_type === "internal" ? (
                            <Badge variant="outline" className="text-xs">
                              <LinkIcon className="h-3 w-3 mr-1" />
                              Interno
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Externo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {banner.is_sponsored ? (
                            <Badge className="bg-amber-100 text-amber-800 text-xs">Sim</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {banner.starts_at ? format(new Date(banner.starts_at), "dd/MM/yy", { locale: ptBR }) : "—"}
                            {" → "}
                            {banner.ends_at ? format(new Date(banner.ends_at), "dd/MM/yy", { locale: ptBR }) : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenForm(banner)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setEditingBanner(banner);
                                setIsPreviewOpen(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Pré-visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(banner.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              {banner.status === "active" ? (
                                <DropdownMenuItem onClick={() => handleStatusChange(banner, "paused")}>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pausar
                                </DropdownMenuItem>
                              ) : banner.status !== "archived" ? (
                                <DropdownMenuItem onClick={() => handleStatusChange(banner, "active")}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Ativar
                                </DropdownMenuItem>
                              ) : null}
                              {banner.status !== "archived" && (
                                <DropdownMenuItem onClick={() => handleStatusChange(banner, "archived")}>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Arquivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!banners || banners.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum banner cadastrado. Clique em "Novo Banner" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="metrics">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <Select
                    value={selectedBannerForMetrics || "all"}
                    onValueChange={(v) => setSelectedBannerForMetrics(v === "all" ? null : v)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Todos os banners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os banners</SelectItem>
                      {banners?.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={metricsFilter.toString()}
                    onValueChange={(v) => setMetricsFilter(parseInt(v))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={exportEvents.isPending}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>

              {selectedBannerForMetrics && selectedMetrics ? (
                <div className="grid grid-cols-3 gap-6">
                  <Card className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Impressões</p>
                    <p className="text-3xl font-bold text-primary">{selectedMetrics.impressions}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Cliques</p>
                    <p className="text-3xl font-bold text-green-600">{selectedMetrics.clicks}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">CTR</p>
                    <p className="text-3xl font-bold text-amber-600">{selectedMetrics.ctr}%</p>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um banner para ver suas métricas detalhadas</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? "Editar Banner" : "Novo Banner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value.slice(0, 60) }))}
                  placeholder="Título do banner (máx. 60 caracteres)"
                  maxLength={60}
                />
                <span className="text-xs text-muted-foreground">{formData.title.length}/60</span>
              </div>

              <div className="col-span-2">
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value.slice(0, 90) }))}
                  placeholder="Subtítulo opcional (máx. 90 caracteres)"
                  maxLength={90}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as BannerStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Prioridade/Ordem</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="col-span-2 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_sponsored}
                    onCheckedChange={(v) => setFormData(prev => ({ 
                      ...prev, 
                      is_sponsored: v,
                      badge_text: v ? "Patrocinado" : prev.badge_text,
                      badge_type: v ? "sponsored" : prev.badge_type,
                    }))}
                  />
                  <Label>Patrocinado</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="badge_text">Texto do Badge</Label>
                <Input
                  id="badge_text"
                  value={formData.badge_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, badge_text: e.target.value }))}
                  placeholder="Ex: NOVO, ATUALIZAÇÃO"
                />
              </div>

              <div>
                <Label htmlFor="badge_type">Tipo/Cor do Badge</Label>
                <Select
                  value={formData.badge_type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, badge_type: v as BannerBadgeType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGE_TYPES.map(bt => (
                      <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="link_type">Tipo de Link</Label>
                <Select
                  value={formData.link_type}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    link_type: v as BannerLinkType,
                    open_in_new_tab: v === "external",
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Link Interno</SelectItem>
                    <SelectItem value="external">Link Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.link_type === "internal" ? (
                <div>
                  <Label htmlFor="internal_route">Rota Interna *</Label>
                  <Select
                    value={formData.internal_route}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, internal_route: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERNAL_ROUTES.map(route => (
                        <SelectItem key={route.value} value={route.value}>{route.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label htmlFor="external_url">URL Externa *</Label>
                  <Input
                    id="external_url"
                    value={formData.external_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={formData.open_in_new_tab}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, open_in_new_tab: v }))}
                />
                <Label>Abrir em nova aba</Label>
              </div>

              <div className="col-span-2">
                <Label htmlFor="image_desktop_url">Imagem Desktop * (URL)</Label>
                <Input
                  id="image_desktop_url"
                  value={formData.image_desktop_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_desktop_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="image_mobile_url">Imagem Mobile (URL) - opcional</Label>
                <Input
                  id="image_mobile_url"
                  value={formData.image_mobile_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_mobile_url: e.target.value }))}
                  placeholder="https://... (se vazio, usará a imagem desktop)"
                />
              </div>

              <div>
                <Label htmlFor="starts_at">Início do Agendamento</Label>
                <Input
                  id="starts_at"
                  type="date"
                  value={formData.starts_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="ends_at">Fim do Agendamento</Label>
                <Input
                  id="ends_at"
                  type="date"
                  value={formData.ends_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                />
              </div>
            </div>

            {/* Preview within form */}
            {formData.image_desktop_url && (
              <div>
                <Label>Pré-visualização</Label>
                <div className="mt-2 border rounded-lg overflow-hidden" style={{ height: "160px" }}>
                  <div className="relative h-full">
                    <img
                      src={formData.image_desktop_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    {formData.badge_text && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="outline" className="bg-white/90 text-xs">
                          {formData.badge_text}
                        </Badge>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="font-semibold">{formData.title || "Título do banner"}</h3>
                      {formData.subtitle && (
                        <p className="text-sm text-white/80">{formData.subtitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseForm}>Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createBanner.isPending || updateBanner.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {editingBanner ? "Salvar Alterações" : "Criar Banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              Pré-visualização
              <div className="flex gap-2">
                <Button
                  variant={previewDevice === "desktop" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor className="h-4 w-4 mr-1" />
                  Desktop
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4 mr-1" />
                  Mobile
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {editingBanner && (
            <div 
              className={cn(
                "border rounded-lg overflow-hidden mx-auto",
                previewDevice === "mobile" ? "max-w-[320px]" : "w-full"
              )}
              style={{ height: previewDevice === "mobile" ? "200px" : "160px" }}
            >
              <div className="relative h-full">
                <img
                  src={
                    previewDevice === "mobile" && editingBanner.image_mobile_url
                      ? editingBanner.image_mobile_url
                      : editingBanner.image_desktop_url
                  }
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                {(editingBanner.badge_text || editingBanner.is_sponsored) && (
                  <div className="absolute top-3 left-3">
                    <Badge variant="outline" className="bg-white/90 text-xs">
                      {editingBanner.is_sponsored ? "Patrocinado" : editingBanner.badge_text}
                    </Badge>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-semibold">{editingBanner.title}</h3>
                  {editingBanner.subtitle && (
                    <p className="text-sm text-white/80">{editingBanner.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCommunication;
