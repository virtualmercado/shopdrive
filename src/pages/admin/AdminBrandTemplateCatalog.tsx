import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Package, Image, X, Save, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AdminLayout from '@/components/layout/AdminLayout';
import MediaSelectorModal from '@/components/admin/MediaSelectorModal';
import { useBrandTemplate, useBrandTemplateProducts, useCreateTemplateProduct, useUpdateTemplateProduct, useDeleteTemplateProduct } from '@/hooks/useBrandTemplateProducts';
import type { BrandTemplateProduct, BrandTemplateProductFormData } from '@/hooks/useBrandTemplateProducts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_PRODUCTS = 20;

const AdminBrandTemplateCatalog = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  
  const { data: template, isLoading: templateLoading } = useBrandTemplate(templateId || '');
  const { data: products = [], isLoading: productsLoading } = useBrandTemplateProducts(templateId || '');
  
  const createProduct = useCreateTemplateProduct();
  const updateProduct = useUpdateTemplateProduct();
  const deleteProduct = useDeleteTemplateProduct();

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BrandTemplateProduct | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<BrandTemplateProductFormData>({
    name: '',
    description: '',
    category: '',
    price: 0,
    sku: '',
    images: [],
    is_active: true,
  });
  const [imageInput, setImageInput] = useState('');
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = templateLoading || productsLoading;
  const canAddProduct = products.length < MAX_PRODUCTS;

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      price: 0,
      sku: '',
      images: [],
      is_active: true,
    });
    setImageInput('');
    setEditingProduct(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: BrandTemplateProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price: product.price,
      sku: product.sku || '',
      images: product.images || [],
      is_active: product.is_active,
    });
    setIsProductModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) return;

    if (editingProduct) {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        templateId,
        product: formData,
      });
    } else {
      await createProduct.mutateAsync({
        templateId,
        product: formData,
      });
    }
    
    setIsProductModalOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deletingProductId || !templateId) return;
    
    await deleteProduct.mutateAsync({
      id: deletingProductId,
      templateId,
    });
    
    setIsDeleteDialogOpen(false);
    setDeletingProductId(null);
  };

  const addImage = () => {
    if (imageInput.trim() && formData.images && formData.images.length < 5) {
      setFormData({
        ...formData,
        images: [...(formData.images || []), imageInput.trim()],
      });
      setImageInput('');
    }
  };

  const removeImage = (index: number) => {
    setFormData({
      ...formData,
      images: formData.images?.filter((_, i) => i !== index) || [],
    });
  };

  const handleMediaSelect = (file: { url: string }) => {
    if (formData.images && formData.images.length < 5) {
      setFormData({
        ...formData,
        images: [...(formData.images || []), file.url],
      });
    }
    setIsMediaSelectorOpen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentImagesCount = formData.images?.length || 0;
    const availableSlots = 5 - currentImagesCount;
    
    if (availableSlots <= 0) {
      toast.error('Limite de 5 imagens atingido');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);
    setIsUploadingImage(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} não é uma imagem válida`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede 5MB`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `brand-templates/${templateId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrlData.publicUrl);
      }

      if (uploadedUrls.length > 0) {
        setFormData({
          ...formData,
          images: [...(formData.images || []), ...uploadedUrls],
        });
        toast.success(`${uploadedUrls.length} imagem(ns) enviada(s)`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload das imagens');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!template) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Template não encontrado</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/gestor/templates-marca')}
          >
            Voltar
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/gestor/templates-marca')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gerenciar Catálogo</h1>
              <p className="text-muted-foreground">
                {template.name} • {products.length}/{MAX_PRODUCTS} produtos
              </p>
            </div>
          </div>
          <Button 
            onClick={openCreateModal}
            disabled={!canAddProduct}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>

        {/* Info Banner */}
        <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
          <p className="text-sm text-blue-800">
            <strong>Catálogo Base:</strong> Estes produtos serão copiados como snapshot ao criar uma loja.
            Alterações aqui não afetam lojas já existentes.
          </p>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos do Template
            </CardTitle>
            <CardDescription>
              Limite de {MAX_PRODUCTS} produtos (Plano Grátis)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum produto cadastrado neste template
                </p>
                <Button onClick={openCreateModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Produto
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.images?.[0] ? (
                              <img 
                                src={product.images[0]} 
                                alt={product.name}
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Image className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{product.category || '-'}</TableCell>
                        <TableCell>
                          R$ {product.price.toFixed(2).replace('.', ',')}
                        </TableCell>
                        <TableCell>{product.sku || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? 'default' : 'secondary'}>
                            {product.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingProductId(product.id);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? 'Atualize as informações do produto no template'
                : 'Adicione um novo produto ao catálogo base do template'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nome do Produto *</Label>
              <Input
                id="product-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Camiseta Premium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category">Categoria</Label>
              <Input
                id="product-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Vestuário"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price">Preço Sugerido (R$) *</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Código interno"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Descrição</Label>
              <Textarea
                id="product-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto..."
                rows={3}
              />
            </div>

            {/* Images */}
            <div className="space-y-3">
              <Label>Imagens do Produto (máx. 5)</Label>
              
              {/* Upload Options */}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={(formData.images?.length || 0) >= 5 || isUploadingImage}
                >
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Enviar do Dispositivo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMediaSelectorOpen(true)}
                  disabled={(formData.images?.length || 0) >= 5}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Biblioteca de Mídia
                </Button>
              </div>

              {/* URL Input (alternative) */}
              <div className="flex gap-2">
                <Input
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  placeholder="Ou cole a URL da imagem"
                  disabled={(formData.images?.length || 0) >= 5}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addImage}
                  disabled={(formData.images?.length || 0) >= 5 || !imageInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Image Previews */}
              {formData.images && formData.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={url} 
                        alt={`Imagem ${index + 1}`}
                        className="h-16 w-16 rounded object-cover border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                {formData.images?.length || 0}/5 imagens • Formatos: JPG, PNG, WebP • Máx: 5MB cada
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Produto Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Produtos inativos não serão copiados para novas lojas
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={createProduct.isPending || updateProduct.isPending}
              >
                {(createProduct.isPending || updateProduct.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingProduct ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este produto do template?
              Esta ação não afeta lojas já criadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media Selector Modal */}
      <MediaSelectorModal
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={handleMediaSelect}
        allowedTypes={['image']}
        title="Selecionar Imagem do Produto"
      />
    </AdminLayout>
  );
};

export default AdminBrandTemplateCatalog;
