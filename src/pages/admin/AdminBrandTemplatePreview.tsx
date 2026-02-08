import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, ShoppingCart, Eye, Loader2, Package, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useBrandTemplate, useBrandTemplateProducts } from '@/hooks/useBrandTemplateProducts';

const AdminBrandTemplatePreview = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  
  const { data: template, isLoading: templateLoading } = useBrandTemplate(templateId || '');
  const { data: products = [], isLoading: productsLoading } = useBrandTemplateProducts(templateId || '');

  const isLoading = templateLoading || productsLoading;
  const activeProducts = products.filter(p => p.is_active);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Template não encontrado</p>
        <Button 
          variant="outline"
          onClick={() => navigate('/gestor/templates-marca')}
        >
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Banner */}
      <div className="bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Eye className="h-4 w-4" />
        MODO PREVIEW — Esta é uma visualização da loja modelo. Nenhuma ação funcional está disponível.
      </div>

      {/* Admin Back Button */}
      <div className="bg-white border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/gestor/templates-marca')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Painel Master
        </Button>
      </div>

      {/* Store Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {template.logo_url ? (
                <img 
                  src={template.logo_url} 
                  alt={template.name}
                  className="h-12 w-12 rounded-lg object-contain bg-gray-100"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{template.name}</h1>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Bem-vindo à {template.name}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Esta é uma prévia de como ficará a loja dos revendedores que usarem este template.
            O catálogo base contém {activeProducts.length} produto(s).
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold">Produtos</h3>
            <p className="text-muted-foreground">
              {activeProducts.length} produto(s) disponível(is)
            </p>
          </div>
        </div>

        {activeProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum produto cadastrado no catálogo base deste template
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate(`/gestor/templates-marca/${templateId}/catalogo`)}
            >
              Gerenciar Catálogo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {activeProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="aspect-square relative bg-gray-100">
                  {product.images?.[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  {product.category && (
                    <Badge 
                      variant="secondary" 
                      className="absolute top-2 left-2"
                    >
                      {product.category}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-1 line-clamp-2">{product.name}</h4>
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </span>
                    <Button size="sm" disabled>
                      Comprar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            {template.logo_url ? (
              <img 
                src={template.logo_url} 
                alt={template.name}
                className="h-8 w-8 rounded object-contain bg-white"
              />
            ) : (
              <Store className="h-6 w-6" />
            )}
            <span className="font-semibold">{template.name}</span>
          </div>
          <p className="text-gray-400 text-sm">
            Loja modelo criada com ShopDrive
          </p>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <Badge variant="outline" className="text-amber-400 border-amber-400">
              MODO PREVIEW — Ambiente de demonstração
            </Badge>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminBrandTemplatePreview;
