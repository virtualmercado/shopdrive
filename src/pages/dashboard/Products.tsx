import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
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
    const { data } = await supabase
      .from("product_categories")
      .select("*")
      .order("name");
    
    if (data) setCategories(data);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
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
    setSelectedProduct(null);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
            <Button 
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setSelectedProduct(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
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
              <Card key={product.id} className="overflow-hidden">
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
                <div className="p-4">
                  <h3 className="font-semibold mb-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="mb-2">
                    {product.promotional_price ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-muted-foreground line-through">
                          R$ {product.price.toFixed(2)}
                        </p>
                        <p className="text-xl font-bold text-black">
                          R$ {product.promotional_price.toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-black">
                        R$ {product.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-black mb-4">
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
                onClick={() => setFormOpen(true)}
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
      </div>
    </DashboardLayout>
  );
};

export default Products;