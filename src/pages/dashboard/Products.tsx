import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ProductForm } from "@/components/ProductForm";
import { Plus, Search, Edit, Trash2, Package, Tag, ArrowDownAZ } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandManagementModal } from "@/components/products/BrandManagementModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ImageAdjustments } from "@/components/ImageEditor";
import { useMerchantPlan } from "@/hooks/useMerchantPlan";
import { PlanLimitReachedModal } from "@/components/plan";
import { PLAN_DISPLAY_NAMES } from "@/lib/planLimits";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  stock: number;
  image_url: string | null;
  images: any;
  category_id: string | null;
  image_adjustments?: ImageAdjustments[];
  is_active: boolean;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
}

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name-asc");
  const { toast } = useToast();

  const { plan, limits, productCount, canAddProduct, refetch: refetchPlan } = useMerchantPlan();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts((data ?? []) as unknown as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCategories([]);
      return;
    }
    
    const { data } = await supabase
      .from("product_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    
    if (data) setCategories(data);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormOpen(true);
  };

  const handleNewProduct = () => {
    if (!canAddProduct) {
      setLimitModalOpen(true);
      return;
    }
    setSelectedProduct(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso",
      });

      fetchProducts();
      refetchPlan();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir produto",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleFormSuccess = () => {
    fetchProducts();
    refetchPlan();
    setSelectedProduct(null);
  };

  const handleImagesPersisted = (productId: string, images: string[], mainImage: string | null) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, images, image_url: mainImage } : p))
    );
  };

  const handleToggleActive = async (productId: string, currentActive: boolean) => {
    const newActive = !currentActive;
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_active: newActive } : p))
    );
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newActive })
        .eq('id', productId);
      if (error) throw error;
      toast({
        title: newActive ? "Produto ativado" : "Produto desativado",
        description: newActive
          ? "Produto visível na loja online"
          : "Produto oculto da loja online",
      });
    } catch (error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: currentActive } : p))
      );
      toast({
        title: "Erro",
        description: "Erro ao alterar status do produto",
        variant: "destructive",
      });
    }
  };

  const getSortedProducts = (list: Product[]) => {
    const copy = [...list];
    switch (sortBy) {
      case "name-desc":
        return copy.sort((a, b) => (b.name || "").trim().localeCompare((a.name || "").trim(), "pt-BR", { sensitivity: "base", numeric: true }));
      case "newest":
        return copy.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      case "oldest":
        return copy.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      case "price-desc":
        return copy.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      case "price-asc":
        return copy.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      case "name-asc":
      default:
        return copy.sort((a, b) => (a.name || "").trim().localeCompare((b.name || "").trim(), "pt-BR", { sensitivity: "base", numeric: true }));
    }
  };

  const categoryCounts = products.reduce<Record<string, number>>((acc, p) => {
    const catId = p.category_id || "__none__";
    acc[catId] = (acc[catId] || 0) + 1;
    return acc;
  }, {});

  const filteredProducts = getSortedProducts(
    products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    })
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Plan limit indicator */}
        {limits.maxProducts !== null && (
          <div className="text-sm text-muted-foreground">
            Produtos: <strong>{productCount}</strong> / {limits.maxProducts}
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="gap-2"
                onClick={() => setBrandModalOpen(true)}
              >
                <Tag className="h-4 w-4" />
                Gerenciar Marcas
              </Button>
              <Button 
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleNewProduct}
              >
                <Plus className="h-4 w-4" />
                Novo Produto
              </Button>
            </div>
          </div>

          {/* Categories Filter */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === "" ? "default" : "outline"}
                size="sm"
                className="rounded-lg transition-all"
                onClick={() => setSelectedCategory("")}
              >
                Todas
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  className="rounded-lg transition-all"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 2xl:gap-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className={`overflow-hidden relative transition-opacity flex flex-col h-full ${!product.is_active ? 'opacity-60' : ''}`}>
                <div className="absolute top-2 right-2 z-10">
                  <Switch
                    checked={product.is_active}
                    onCheckedChange={() => handleToggleActive(product.id, product.is_active)}
                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                  />
                </div>
                {!product.is_active && (
                  <div className="absolute top-2 left-2 z-10 bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded">
                    Inativo
                  </div>
                )}
                <div className="aspect-square bg-muted">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {/* Top section: title + description — stretches to fill */}
                <div className="p-4 flex-1">
                  <h3 className="font-semibold mb-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {product.description}
                    </p>
                  )}
                </div>
                {/* Bottom section: price, stock, actions — always pinned */}
                <div className="px-4 pb-4 mt-auto">
                  <div className="mb-2">
                    {product.promotional_price ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-muted-foreground line-through">
                          R$ {product.price.toFixed(2)}
                        </p>
                        <p className="text-xl font-bold text-foreground">
                          R$ {product.promotional_price.toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-foreground">
                        R$ {product.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-4">
                    Estoque: <span className="font-bold">{product.stock}</span> unidades
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg"
                      onClick={() => openDeleteDialog(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Tente buscar por outro termo" 
                : "Comece adicionando seus primeiros produtos"
              }
            </p>
            {!searchTerm && (
              <Button 
                onClick={handleNewProduct}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Adicionar Produto
              </Button>
            )}
          </Card>
        )}

        <ProductForm
          open={formOpen}
          onOpenChange={setFormOpen}
          product={selectedProduct}
          onSuccess={handleFormSuccess}
          onImagesPersisted={handleImagesPersisted}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BrandManagementModal
          open={brandModalOpen}
          onOpenChange={setBrandModalOpen}
        />

        <PlanLimitReachedModal
          open={limitModalOpen}
          onOpenChange={setLimitModalOpen}
          resourceName="produtos"
          currentCount={productCount}
          maxAllowed={limits.maxProducts ?? 0}
          planName={PLAN_DISPLAY_NAMES[plan]}
        />
      </div>
    </DashboardLayout>
  );
};

export default Products;
