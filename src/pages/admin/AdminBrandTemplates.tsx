import { useState } from 'react';
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
  BrandTemplate,
  BrandTemplateStatus,
} from '@/hooks/useBrandTemplates';
import { toast } from 'sonner';

const AdminBrandTemplates = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BrandTemplateStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteTemplate, setDeleteTemplate] = useState<BrandTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    status: 'draft' as BrandTemplateStatus,
    description: '',
  });

  const { data: templates, isLoading } = useBrandTemplates(statusFilter, searchTerm);
  const { data: stats, isLoading: isLoadingStats } = useBrandTemplateStats();
  const createMutation = useCreateBrandTemplate();
  const deleteMutation = useDeleteBrandTemplate();
  const duplicateMutation = useDuplicateBrandTemplate();
  const toggleStatusMutation = useToggleBrandTemplateStatus();

  const resetForm = () => {
    setFormData({
      name: '',
      logo_url: '',
      status: 'draft',
      description: '',
    });
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
                <div className="p-2 rounded-lg bg-orange-100">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Limite de Produtos</p>
                  <p className="text-2xl font-bold">20</p>
                  <p className="text-xs text-muted-foreground">Plano Grátis por template</p>
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
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="draft">Rascunhos</SelectItem>
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
                        <TableHead>Produtos no Template</TableHead>
                        <TableHead>Lojas Criadas</TableHead>
                        <TableHead>Última Atualização</TableHead>
                        <TableHead className="w-[50px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={template.logo_url || undefined} alt={template.name} />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {getInitials(template.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{template.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(template.status)}</TableCell>
                          <TableCell>
                            <span className="font-medium">{template.products_count}</span>
                            <span className="text-muted-foreground">/{template.max_products}</span>
                          </TableCell>
                          <TableCell>{template.stores_created}</TableCell>
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
                                <DropdownMenuItem onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar Template
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                                  <FolderOpen className="h-4 w-4 mr-2" />
                                  Gerenciar Catálogo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Visualizar Loja Modelo
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
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={template.logo_url || undefined} alt={template.name} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(template.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <div className="mt-1">{getStatusBadge(template.status)}</div>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar Template
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                                <FolderOpen className="h-4 w-4 mr-2" />
                                Gerenciar Catálogo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar Loja Modelo
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
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Produtos</p>
                            <p className="font-medium">
                              {template.products_count}/{template.max_products}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Lojas Criadas</p>
                            <p className="font-medium">{template.stores_created}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Atualizado em {format(new Date(template.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
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
              <Label htmlFor="logo_url">Logo da Marca (URL)</Label>
              <Input
                id="logo_url"
                value={formData.logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Cole a URL da imagem ou use a Biblioteca de Mídia
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
    </AdminLayout>
  );
};

export default AdminBrandTemplates;
