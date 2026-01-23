import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/components/layout/AdminLayout';
import { useBrandTemplate } from '@/hooks/useBrandTemplateProducts';
import { useUpdateBrandTemplate } from '@/hooks/useBrandTemplates';
import { toast } from 'sonner';
import type { BrandTemplateStatus } from '@/hooks/useBrandTemplates';

const AdminBrandTemplateEdit = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  
  const { data: template, isLoading } = useBrandTemplate(templateId || '');
  const updateTemplate = useUpdateBrandTemplate();

  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    status: 'draft' as BrandTemplateStatus,
    description: '',
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        logo_url: template.logo_url || '',
        status: template.status as BrandTemplateStatus,
        description: template.description || '',
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!templateId) return;

    if (!formData.name.trim()) {
      toast.error('O nome da marca é obrigatório');
      return;
    }

    try {
      await updateTemplate.mutateAsync({
        id: templateId,
        ...formData,
      });
      navigate('/gestor/templates-marca');
    } catch (error) {
      console.error('Error updating template:', error);
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/gestor/templates-marca')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar Template</h1>
            <p className="text-muted-foreground">
              Configure as informações estruturais do template da marca
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Template</CardTitle>
              <CardDescription>
                Edite apenas dados estruturais. Para gerenciar produtos, use "Gerenciar Catálogo".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Nome da Marca */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Marca *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Marca Premium"
                  required
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-2">
                <Label htmlFor="logo_url">URL do Logo</Label>
                <div className="flex gap-3">
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  {formData.logo_url && (
                    <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center overflow-hidden">
                      <img 
                        src={formData.logo_url} 
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {!formData.logo_url && (
                    <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center">
                      <Image className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status do Template</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: BrandTemplateStatus) => 
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Apenas templates ativos podem ser usados para criar novas lojas
                </p>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição Interna</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notas administrativas sobre este template..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Visível apenas para administradores
                </p>
              </div>

              {/* Info Box */}
              <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  <strong>Importante:</strong> Alterações neste template não afetam lojas já criadas.
                  O template serve apenas como base para novas lojas.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/gestor/templates-marca')}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateTemplate.isPending}
                >
                  {updateTemplate.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminBrandTemplateEdit;
