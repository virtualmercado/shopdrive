import { useState, useEffect, useRef } from "react";
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
import { Plus, Search, Edit, Trash2, Package, Tag, FolderTree, ArrowDownAZ, ChevronLeft, ChevronRight, LayoutGrid, List, Printer, FileDown, Percent } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandManagementModal } from "@/components/products/BrandManagementModal";
import { CategoryManagementModal } from "@/components/products/CategoryManagementModal";
import { BulkPriceAdjustModal } from "@/components/products/BulkPriceAdjustModal";
import { exportPriceListPDF, printPriceList } from "@/lib/productsExport";
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
  brand_id?: string | null;
  is_featured?: boolean;
  is_new?: boolean;
  variations?: any;
  weight?: number | null;
  length?: number | null;
  height?: number | null;
  width?: number | null;
}

interface Category {
  id: string;
  name: string;
}

const PRODUCTS_PER_PAGE = 30;

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
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [storeName, setStoreName] = useState<string>("Loja");
  const gridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { plan, limits, loading: planLoading, productCount, canAddProduct, refetch: refetchPlan } = useMerchantPlan();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchStoreName();
  }, []);

  const fetchStoreName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("store_name, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setStoreName((data as any).store_name || (data as any).full_name || "Loja");
  };

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

    if (newActive && planLoading) {
      toast({
        title: "Aguarde",
        description: "Estamos confirmando seu plano antes de publicar o produto.",
      });
      return;
    }

    // UX hint only. The definitive validation happens atomically in the backend.
    if (newActive && limits.maxProducts !== null && productCount >= limits.maxProducts) {
        toast({
          title: "Limite do plano atingido",
          description: "Você atingiu o limite de produtos ativos do seu plano. Faça upgrade para publicar mais produtos.",
          variant: "destructive",
        });
        return;
    }

    try {
      const { data, error } = await (supabase.rpc as any)('activate_product_with_plan_validation', {
        p_product_id: productId,
        p_active: newActive,
      });

      if (error) throw error;

      const result = data as { success?: boolean; message?: string; reason?: string } | null;
      if (result?.success === false) {
        toast({
          title: result.reason === 'plan_limit' ? "Limite do plano atingido" : "Não foi possível alterar o produto",
          description: result.message || "Não foi possível alterar o status do produto.",
          variant: "destructive",
        });
        return;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: newActive } : p))
      );
      void refetchPlan();

      toast({
        title: newActive ? "Produto ativado" : "Produto desativado",
        description: newActive
          ? "Produto visível na loja online"
          : "Produto oculto da loja online",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao alterar status do produto",
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

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const visibleProducts = filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortBy]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    gridRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getPaginationPages = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Plan limit indicator */}
        {limits.maxProducts !== null && (
          <div className="text-sm text-muted-foreground">
            Produtos ativos: <strong>{productCount}</strong> / {limits.maxProducts}
            {products.filter(p => !p.is_active).length > 0 && (
              <span className="ml-2">({products.filter(p => !p.is_active).length} inativos)</span>
            )}
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
            <div className="flex gap-2 flex-wrap">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px] gap-2">
                  <ArrowDownAZ className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Alfabética: A → Z</SelectItem>
                  <SelectItem value="name-desc">Alfabética: Z → A</SelectItem>
                  <SelectItem value="newest">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="price-desc">Maior preço</SelectItem>
                  <SelectItem value="price-asc">Menor preço</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setCategoryModalOpen(true)}
              >
                <FolderTree className="h-4 w-4" />
                Gerenciar Categorias
              </Button>
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
                Todas ({products.length})
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  className="rounded-lg transition-all whitespace-nowrap"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name} ({categoryCounts[category.id] || 0})
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle + bulk actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-background p-0.5">
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4" /> Cards
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" /> Lista
              </Button>
            </div>
            {selectedIds.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selecionado(s)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const list = (selectedIds.length > 0
                  ? filteredProducts.filter((p) => selectedIds.includes(p.id))
                  : filteredProducts
                ).map((p) => ({ name: p.name, price: p.price, promotional_price: p.promotional_price }));
                printPriceList({ storeName, products: list });
              }}
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const list = (selectedIds.length > 0
                  ? filteredProducts.filter((p) => selectedIds.includes(p.id))
                  : filteredProducts
                ).map((p) => ({ name: p.name, price: p.price, promotional_price: p.promotional_price }));
                exportPriceListPDF({ storeName, products: list });
              }}
            >
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setBulkModalOpen(true)}
            >
              <Percent className="h-4 w-4" /> Reajustar preços
            </Button>
          </div>
        </div>

        {/* Products Grid */}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="space-y-8">
            {viewMode === "cards" ? (
            <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {visibleProducts.map((product) => (
              <Card key={product.id} className={`overflow-hidden relative transition-opacity flex flex-col ${!product.is_active ? 'opacity-60' : ''}`}>
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <Switch
                      checked={product.is_active}
                      onCheckedChange={() => handleToggleActive(product.id, product.is_active)}
                      className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                    />
                  </div>
                  {!product.is_active && (
                    <div className="absolute top-2.5 left-2.5 z-10 bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded">
                      Inativo
                    </div>
                  )}
                  <div className="w-full h-[160px] sm:h-[220px] flex items-center justify-center overflow-hidden px-2 pt-2">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-contain scale-105"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="px-4 pt-3 pb-1 flex-1 flex flex-col">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-4 mb-1.5">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <div className="px-4 pb-4 mt-auto">
                    <div className="mb-1.5">
                      {product.promotional_price ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-muted-foreground line-through">
                            R$ {product.price.toFixed(2)}
                          </p>
                          <p className="text-base font-bold text-foreground">
                            R$ {product.promotional_price.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-base font-bold text-foreground">
                          R$ {product.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-foreground mb-2.5">
                      Estoque: <span className="font-bold">{product.stock}</span> un.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 border-primary h-9"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg h-9 w-9 p-0"
                        onClick={() => openDeleteDialog(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            ) : (
            <div ref={gridRef} className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={visibleProducts.length > 0 && visibleProducts.every(p => selectedIds.includes(p.id))}
                        onCheckedChange={(v) => {
                          const ids = visibleProducts.map(p => p.id);
                          setSelectedIds(prev => v ? Array.from(new Set([...prev, ...ids])) : prev.filter(id => !ids.includes(id)));
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-14">Imagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="hidden md:table-cell">SKU</TableHead>
                    <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                    <TableHead className="hidden lg:table-cell">Unid.</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Estoque</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleProducts.map((product) => {
                    const cat = categories.find(c => c.id === product.category_id);
                    const checked = selectedIds.includes(product.id);
                    return (
                      <TableRow key={product.id} className={!product.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => setSelectedIds(prev => v ? [...prev, product.id] : prev.filter(id => id !== product.id))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-[280px]">
                          <div className="truncate">{product.name}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">—</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{cat?.name || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">—</TableCell>
                        <TableCell className="hidden md:table-cell text-right">{product.stock}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {product.promotional_price ? (
                            <div className="flex flex-col items-end leading-tight">
                              <span className="text-xs line-through text-muted-foreground">R$ {product.price.toFixed(2)}</span>
                              <span className="font-semibold">R$ {product.promotional_price.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="font-semibold">R$ {product.price.toFixed(2)}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Switch
                            checked={product.is_active}
                            onCheckedChange={() => handleToggleActive(product.id, product.is_active)}
                            className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => openDeleteDialog(product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            )}


            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {getPaginationPages().map((page, idx) =>
                  page === "ellipsis" ? (
                    <span key={`e-${idx}`} className="px-2 text-muted-foreground select-none">…</span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className={`min-w-[36px] rounded-lg ${currentPage === page ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  )
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
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

        <CategoryManagementModal
          open={categoryModalOpen}
          onOpenChange={setCategoryModalOpen}
          onCategoryChange={fetchCategories}
        />

        <PlanLimitReachedModal
          open={limitModalOpen}
          onOpenChange={setLimitModalOpen}
          resourceName="produtos"
          currentCount={productCount}
          maxAllowed={limits.maxProducts ?? 0}
          planName={PLAN_DISPLAY_NAMES[plan]}
        />

        <BulkPriceAdjustModal
          open={bulkModalOpen}
          onOpenChange={setBulkModalOpen}
          allProducts={products}
          filteredProducts={filteredProducts}
          selectedIds={selectedIds}
          categories={categories}
          onApplied={() => {
            fetchProducts();
            setSelectedIds([]);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default Products;
