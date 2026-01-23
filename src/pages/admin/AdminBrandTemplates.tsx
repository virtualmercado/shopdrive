import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Search,
  MoreHorizontal,
  Layers,
  CheckCircle2,
  Store,
  Package,
  Pencil,
  FolderOpen,
  Eye,
  Power,
  Copy,
  Trash2,
  ShieldCheck,
  Lock,
  Link2,
  QrCode,
  MessageCircle,
  ExternalLink,
  Check,
  MousePointerClick,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useBrandTemplates,
  useBrandTemplateStats,
  useCreateBrandTemplate,
  useDeleteBrandTemplate,
  useDuplicateBrandTemplate,
  useToggleBrandTemplateStatus,
  useToggleLinkStatus,
  BrandTemplate,
  BrandTemplateStatus,
  LinkStatusFilter,
  getTemplateActivationLink,
  getWhatsAppShareMessage,
} from '@/hooks/useBrandTemplates';
import TemplateDetailsModal from '@/components/admin/TemplateDetailsModal';
import QRCodeModal from '@/components/admin/QRCodeModal';
import MediaSelectorModal from '@/components/admin/MediaSelectorModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AdminBrandTemplates = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BrandTemplateStatus | 'all'>('all');
  const [linkStatusFilter, setLinkStatusFilter] = useState<LinkStatusFilter>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteTemplate, setDeleteTemplate] = useState<BrandTemplate | null>(null);
  const [detailsTemplate, setDetailsTemplate] = useState<BrandTemplate | null>(null);
  const [qrCodeTemplate, setQrCodeTemplate] = useState<BrandTemplate | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    status: 'draft' as BrandTemplateStatus,
    description: '',
  });

  const { data: templates, isLoading } = useBrandTemplates(statusFilter, searchTerm, linkStatusFilter);
  const { data: stats, isLoading: isLoadingStats } = useBrandTemplateStats();
  const createMutation = useCreateBrandTemplate();
  const deleteMutation = useDeleteBrandTemplate();
  const duplicateMutation = useDuplicateBrandTemplate();
  const toggleStatusMutation = useToggleBrandTemplateStatus();
  const toggleLinkMutation = useToggleLinkStatus();

  const resetForm = () => {
    setFormData({
      name: '',
      logo_url: '',
      status: 'draft',
      description: '',
    });
  };

  const handleLogoUpload = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    
    if (!validTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use JPG, PNG, WEBP ou SVG.');
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `brand-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media-library')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        toast.error(`Erro ao enviar imagem: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('media-library')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: urlData.publicUrl }));
      toast.success('Logo enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar a imagem');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
    e.target.value = '';
  };

  const handleCreateTemplate = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da marca é obrigatório');
      return;
    }

    await createMutation.mutateAsync(formData);
    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleDeleteTemplate = async () => {
    if (deleteTemplate) {
      await deleteMutation.mutateAsync(deleteTemplate.id);
      setDeleteTemplate(null);
    }
  };

  const handleCopyLink = async (template: BrandTemplate) => {
    const link = getTemplateActivationLink(template.template_slug);
    if (!link) {
      toast.error('Link não disponível');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinkId(template.id);
      toast.success('Link copiado!');
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleCopyWhatsAppMessage = async (template: BrandTemplate) => {
    const message = getWhatsAppShareMessage(template.name, template.template_slug);
    const link = getTemplateActivationLink(template.template_slug);
    const fullMessage = `Crie sua loja grátis já com os produtos da marca ${template.name}: ${link}`;
    
    try {
      await navigator.clipboard.writeText(fullMessage);
      toast.success('Mensagem para WhatsApp copiada!');
    } catch {
      // Fallback: open WhatsApp with message
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  const handleToggleLink = (template: BrandTemplate) => {
    toggleLinkMutation.mutate({
      id: template.id,
      currentLinkStatus: template.is_link_active,
    });
  };

  const getStatusBadge = (status: BrandTemplateStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Rascunho</Badge>;
    }
  };

  const getLinkBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        <Link2 className="h-3 w-3 mr-1" />
        Ativo
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">
        <Link2 className="h-3 w-3 mr-1" />
        Inativo
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Templates por Marca</h1>
            <p className="text-muted-foreground">
              Gerencie lojas prontas por marca para acelerar o onboarding de revendedores.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                Sistema Online
              </span>
              <span className="flex items-center gap-1">
                <Lock className="h-4 w-4 text-green-500" />
                SSL Ativo
              </span>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template de Marca
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Marcas</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-7 w-12" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalTemplates || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Templates Ativos</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-7 w-12" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.activeTemplates || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Store className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lojas Criadas</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-7 w-12" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalStoresCreated || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <MousePointerClick className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliques em Links</p>
                  {isLoadingStats ? (
                    <Skeleton className="h-7 w-12" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalLinkClicks || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">Lista de Templates</TabsTrigger>
            <TabsTrigger value="settings" disabled className="opacity-50">
              Configurações (Em breve)
            </TabsTrigger>
            <TabsTrigger value="metrics" disabled className="opacity-50">
              Métricas (Em breve)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar marca"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as BrandTemplateStatus | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="draft">Rascunhos</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={linkStatusFilter}
                onValueChange={(value) => setLinkStatusFilter(value as LinkStatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por link" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Links</SelectItem>
                  <SelectItem value="active">Link Ativo</SelectItem>
                  <SelectItem value="inactive">Link Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table / Empty State */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : templates && templates.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Produtos</TableHead>
                        <TableHead>Lojas Criadas</TableHead>
                        <TableHead>Link</TableHead>
                        <TableHead>Última Atualização</TableHead>
                        <TableHead className="w-[50px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div 
                              className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                              onClick={() => setDetailsTemplate(template)}
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={template.logo_url || undefined} alt={template.name} />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {getInitials(template.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium hover:underline">{template.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(template.status)}</TableCell>
                          <TableCell>
                            <span className="font-medium">{template.products_count}</span>
                            <span className="text-muted-foreground">/{template.max_products}</span>
                          </TableCell>
                          <TableCell>{template.stores_created}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getLinkBadge(template.is_link_active)}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopyLink(template)}
                                disabled={!template.template_slug}
                              >
                                {copiedLinkId === template.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(template.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/gestor/templates-marca/${template.id}/editar`)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar Template
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/gestor/templates-marca/${template.id}/catalogo`)}>
                                  <FolderOpen className="h-4 w-4 mr-2" />
                                  Gerenciar Catálogo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/gestor/templates-marca/${template.id}/preview`, '_blank')}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Visualizar Loja Modelo
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleCopyLink(template)}>
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Copiar link de ativação
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyWhatsAppMessage(template)}>
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Copiar mensagem WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setQrCodeTemplate(template)}>
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Gerar QR Code
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleLink(template)}>
                                  <Power className="h-4 w-4 mr-2" />
                                  {template.is_link_active ? 'Desativar link' : 'Ativar link'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => toggleStatusMutation.mutate({ id: template.id, currentStatus: template.status })}
                                >
                                  <Power className="h-4 w-4 mr-2" />
                                  {template.status === 'active' ? 'Desativar Template' : 'Ativar Template'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateMutation.mutate(template.id)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar Template
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTemplate(template)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir Template
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-4">
                  {templates.map((template) => (
                    <Card key={template.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div 
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => setDetailsTemplate(template)}
                          >
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={template.logo_url || undefined} alt={template.name} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(template.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <div className="flex gap-2 mt-1">
                                {getStatusBadge(template.status)}
                                {getLinkBadge(template.is_link_active)}
                              </div>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/gestor/templates-marca/${template.id}/editar`)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar Template
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/gestor/templates-marca/${template.id}/catalogo`)}>
                                <FolderOpen className="h-4 w-4 mr-2" />
                                Gerenciar Catálogo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/gestor/templates-marca/${template.id}/preview`, '_blank')}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar Loja Modelo
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCopyLink(template)}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Copiar link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyWhatsAppMessage(template)}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Mensagem WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setQrCodeTemplate(template)}>
                                <QrCode className="h-4 w-4 mr-2" />
                                QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleLink(template)}>
                                <Power className="h-4 w-4 mr-2" />
                                {template.is_link_active ? 'Desativar link' : 'Ativar link'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleStatusMutation.mutate({ id: template.id, currentStatus: template.status })}
                              >
                                <Power className="h-4 w-4 mr-2" />
                                {template.status === 'active' ? 'Desativar' : 'Ativar'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateMutation.mutate(template.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTemplate(template)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Produtos</p>
                            <p className="font-medium">
                              {template.products_count}/{template.max_products}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Lojas</p>
                            <p className="font-medium">{template.stores_created}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cliques</p>
                            <p className="font-medium">{template.link_clicks}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(template.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(template)}
                          >
                            {copiedLinkId === template.id ? (
                              <Check className="h-4 w-4 mr-1 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" />
                            )}
                            {copiedLinkId === template.id ? 'Copiado!' : 'Copiar link'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              /* Empty State */
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Layers className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Nenhum template de marca criado ainda.
                  </h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Clique em 'Novo Template de Marca' para começar.
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Template de Marca
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Template Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Template de Marca</DialogTitle>
            <DialogDescription>
              Preencha as informações para criar um novo template de loja por marca.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Marca *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Marca XYZ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo da Marca</Label>
              
              {/* Logo Preview */}
              {formData.logo_url && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <img 
                    src={formData.logo_url} 
                    alt="Preview do logo" 
                    className="h-12 w-12 object-contain rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{formData.logo_url}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                  >
                    Remover
                  </Button>
                </div>
              )}
              
              {/* Upload Options */}
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Hidden file input */}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.svg"
                  className="hidden"
                  onChange={handleLogoInputChange}
                  disabled={isUploadingLogo}
                />
                
                {/* Upload from device button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="flex-1"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Enviar do Dispositivo
                </Button>
                
                {/* Select from media library button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMediaSelectorOpen(true)}
                  className="flex-1"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Biblioteca de Mídia
                </Button>
              </div>
              
              {/* URL Input */}
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="Ou cole a URL da imagem aqui..."
                  className="flex-1"
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, WEBP, SVG
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status Inicial</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as BrandTemplateStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição Interna (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição para uso administrativo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={createMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template de marca?
              <br />
              <br />
              <strong>Essa ação não poderá ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Details Modal */}
      <TemplateDetailsModal
        template={detailsTemplate}
        open={!!detailsTemplate}
        onOpenChange={(open) => !open && setDetailsTemplate(null)}
        onGenerateQRCode={(template) => {
          setDetailsTemplate(null);
          setQrCodeTemplate(template);
        }}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        template={qrCodeTemplate}
        open={!!qrCodeTemplate}
        onOpenChange={(open) => !open && setQrCodeTemplate(null)}
      />

      {/* Media Selector Modal */}
      <MediaSelectorModal
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={(file) => {
          setFormData(prev => ({ ...prev, logo_url: file.url }));
          setIsMediaSelectorOpen(false);
        }}
        allowedTypes={['image']}
        title="Selecionar Logo da Marca"
      />
    </AdminLayout>
  );
};

export default AdminBrandTemplates;
