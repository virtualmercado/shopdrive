import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, ShoppingCart, Eye, Loader2, Package, Image, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Preview da Loja Modelo — lê dados DIRETAMENTE do perfil-fonte (profiles + products),
 * que é a mesma fonte atualizada pelo editor. Não usa snapshots de brand_template_products.
 */
const AdminBrandTemplatePreview = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  // 1) Buscar template e seu source_profile_id
  const { data: template, isLoading: templateLoading, error: templateError } = useQuery({
    queryKey: ['brand-template-preview-live', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from('brand_templates')
        .select('id, name, logo_url, source_profile_id, updated_at, status')
        .eq('id', templateId)
        .single();
      if (error) throw error;

      console.info('[TemplatePreview] template loaded', {
        templateId: data.id,
        sourceProfileId: data.source_profile_id,
        templateUpdatedAt: data.updated_at,
      });

      return data;
    },
    enabled: !!templateId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const sourceProfileId = template?.source_profile_id;

  // 2) Buscar perfil-fonte (dados visuais da loja)
  const { data: sourceProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['brand-template-source-profile', sourceProfileId],
    queryFn: async () => {
      if (!sourceProfileId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, store_name, store_logo_url, store_slug, updated_at')
        .eq('id', sourceProfileId)
        .single();
      if (error) throw error;

      console.info('[TemplatePreview] source profile loaded', {
        profileId: data.id,
        storeName: data.store_name,
        storeSlug: data.store_slug,
        profileUpdatedAt: data.updated_at,
      });

      return data;
    },
    enabled: !!sourceProfileId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // 3) Buscar produtos DIRETAMENTE da tabela products do perfil-fonte (fonte de verdade)
  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['brand-template-live-products', sourceProfileId],
    queryFn: async () => {
      if (!sourceProfileId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price, images, is_active, created_at')
        .eq('user_id', sourceProfileId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      console.info('[TemplatePreview] live products loaded', {
        count: data.length,
        sourceProfileId,
      });

      return data;
    },
    enabled: !!sourceProfileId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const isLoading = templateLoading || profileLoading || productsLoading;
  const activeProducts = products.filter((p: any) => p.is_active !== false);
  const hasError = templateError || profileError || productsError;

  // Error state
  if (hasError) {
    const errorMsg = (templateError || profileError || productsError) as Error;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium text-center">
          Erro ao carregar preview: {errorMsg?.message || 'Erro desconhecido'}
        </p>
        <Button variant="outline" onClick={() => navigate('/gestor/templates-marca')}>
          Voltar
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Template não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/gestor/templates-marca')}>
          Voltar
        </Button>
      </div>
    );
  }

  // No source profile linked — cannot show live data
  if (!sourceProfileId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-muted-foreground text-center">
          Este template não possui um perfil-fonte vinculado.<br />
          Recrie o template para usar o editor e gerar um perfil de loja modelo.
        </p>
        <Button variant="outline" onClick={() => navigate('/gestor/templates-marca')}>
          Voltar
        </Button>
      </div>
    );
  }

  const displayName = sourceProfile?.store_name || template.name;
  const displayLogo = sourceProfile?.store_logo_url || template.logo_url;

  // Helper to extract first image URL from products.images (jsonb)
  const getFirstImage = (images: any): string | null => {
    if (!images) return null;
    if (Array.isArray(images) && images.length > 0) return images[0];
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      } catch { /* ignore */ }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Preview Banner */}
      <div className="bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Eye className="h-4 w-4" />
        MODO PREVIEW — Dados lidos diretamente do perfil-fonte (versão ao vivo).
      </div>

      {/* Admin Back Button */}
      <div className="bg-card border-b px-4 py-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/gestor/templates-marca')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Painel Master
        </Button>
        <span className="text-xs text-muted-foreground">
          Atualizado: {new Date(template.updated_at).toLocaleString('pt-BR')}
        </span>
      </div>

      {/* Store Header */}
      <header className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt={displayName}
                  className="h-12 w-12 rounded-lg object-contain bg-muted"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
                <p className="text-sm text-muted-foreground">Loja Modelo</p>
              </div>
            </div>
            <Button variant="outline" disabled className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrinho (0)
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">Template de Marca</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Bem-vindo à {displayName}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Esta é uma prévia ao vivo de como ficará a loja dos revendedores.
            O catálogo contém {activeProducts.length} produto(s) do perfil-fonte.
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold text-foreground">Produtos</h3>
            <p className="text-muted-foreground">
              {activeProducts.length} produto(s) disponível(is) — fonte: perfil do editor
            </p>
          </div>
        </div>

        {activeProducts.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum produto encontrado no perfil-fonte deste template.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Abra o Painel de Edição para cadastrar produtos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {activeProducts.map((product: any) => {
              const firstImage = getFirstImage(product.images);
              return (
                <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="aspect-square relative bg-muted">
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-1 line-clamp-2 text-foreground">{product.name}</h4>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        R$ {Number(product.price).toFixed(2).replace('.', ',')}
                      </span>
                      <Button size="sm" disabled>
                        Comprar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            {displayLogo ? (
              <img
                src={displayLogo}
                alt={displayName}
                className="h-8 w-8 rounded object-contain bg-white"
              />
            ) : (
              <Store className="h-6 w-6" />
            )}
            <span className="font-semibold">{displayName}</span>
          </div>
          <p className="text-gray-400 text-sm">
            Loja modelo criada com ShopDrive
          </p>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Badge variant="outline" className="text-amber-400 border-amber-400">
              MODO PREVIEW — Dados ao vivo do perfil-fonte
            </Badge>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminBrandTemplatePreview;
