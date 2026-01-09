import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import MiniCart from "@/components/store/MiniCart";
import { useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/store/ProductCard";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string;
  store_logo_url: string;
  primary_color: string;
  secondary_color: string;
  footer_text_color: string;
  footer_bg_color: string;
  whatsapp_number: string;
  button_bg_color?: string;
  button_text_color?: string;
  button_border_style?: string;
  product_image_format?: string;
  product_border_style?: string;
  product_text_alignment?: string;
  product_button_display?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: any;
  stock: number;
  category_id: string | null;
  description: string | null;
  variations: any;
  category_name?: string;
}

// Normalize text for search
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/s\b/g, "");
};

// Levenshtein distance for typo tolerance
const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Extract variations text
const getVariationsText = (variations: any): string => {
  if (!variations || !Array.isArray(variations)) return "";
  return variations
    .map((v: any) => `${v.name || v.group || ""} ${(v.values || v.options || []).join(" ")}`)
    .join(" ");
};

// Calculate similarity score
const calculateSimilarity = (product: Product, search: string): number => {
  const normalizedSearch = normalizeText(search);
  if (!normalizedSearch) return 1;

  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);
  const combinedText = normalizeText(
    [product.name, product.description || "", product.category_name || "", getVariationsText(product.variations)].join(" ")
  );
  const textWords = combinedText.split(/\s+/).filter(w => w.length > 0);

  let matchedWords = 0;
  let totalScore = 0;

  for (const searchWord of searchWords) {
    let bestWordScore = 0;
    for (const textWord of textWords) {
      if (textWord.includes(searchWord) || searchWord.includes(textWord)) {
        bestWordScore = Math.max(bestWordScore, 1);
        continue;
      }
      if (searchWord.length >= 3 && textWord.length >= 3) {
        const distance = levenshteinDistance(searchWord, textWord);
        const similarity = 1 - distance / Math.max(searchWord.length, textWord.length);
        if (similarity >= 0.6) bestWordScore = Math.max(bestWordScore, similarity * 0.8);
      }
      if (textWord.startsWith(searchWord.substring(0, Math.min(3, searchWord.length)))) {
        bestWordScore = Math.max(bestWordScore, 0.7);
      }
    }
    if (bestWordScore > 0) {
      matchedWords++;
      totalScore += bestWordScore;
    }
  }

  if (matchedWords < searchWords.length) return 0;
  return totalScore / searchWords.length;
};

const StoreCategoryPage = () => {
  const { storeSlug, categoryId } = useParams<{ storeSlug: string; categoryId?: string }>();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryId || null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showPromotionsOnly, setShowPromotionsOnly] = useState(false);
  const { getItemCount } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      if (!storeSlug) return;

      // Fetch store data
      const { data: store } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .single();

      if (!store) {
        setLoading(false);
        return;
      }

      setStoreData(store);

      // Fetch categories
      const { data: cats } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("user_id", store.id);

      setCategories(cats || []);

      // Fetch all products
      const { data: prods } = await supabase
        .from("products")
        .select("*, product_categories(name)")
        .eq("user_id", store.id)
        .gt("stock", 0)
        .order("created_at", { ascending: false });

      if (prods) {
        setProducts(
          prods.map((p: any) => ({
            ...p,
            category_name: p.product_categories?.name || null,
          }))
        );
      }

      setLoading(false);
    };

    fetchData();
  }, [storeSlug]);

  useEffect(() => {
    if (categoryId) setSelectedCategory(categoryId);
  }, [categoryId]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }

    // Filter by promotional price if enabled
    if (showPromotionsOnly) {
      result = result.filter(p => p.promotional_price != null && p.promotional_price > 0);
    }

    if (searchTerm.trim()) {
      result = result
        .map(p => ({ product: p, score: calculateSimilarity(p, searchTerm) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);
    }

    return result;
  }, [products, searchTerm, selectedCategory, showPromotionsOnly]);

  const handleCategoryClick = (catId: string | null) => {
    setSelectedCategory(catId);
    setMobileSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-20 w-full" />
        <div className="container mx-auto p-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!storeData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">A loja que você procura não existe.</p>
        </div>
      </div>
    );
  }

  const buttonBgColor = storeData.button_bg_color || "#6a1b9a";
  const buttonTextColor = storeData.button_text_color || "#FFFFFF";
  const buttonBorderStyle = storeData.button_border_style || "rounded";
  const productImageFormat = storeData.product_image_format || "square";
  const productBorderStyle = storeData.product_border_style || "rounded";
  const productTextAlignment = storeData.product_text_alignment || "left";
  const productButtonDisplay = storeData.product_button_display || "below";
  const accentColor = buttonBgColor || storeData.primary_color || "#6a1b9a";

  const selectedCategoryName = selectedCategory
    ? categories.find(c => c.id === selectedCategory)?.name || "Categoria"
    : "Todos os Produtos";

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader
        storeName={storeData.store_name}
        logoUrl={storeData.store_logo_url}
        primaryColor={storeData.primary_color}
        secondaryColor={storeData.secondary_color}
        backgroundColor={storeData.footer_text_color}
        storeOwnerId={storeData.id}
        storeSlug={storeSlug || ""}
        cartItemCount={getItemCount()}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryClick}
      />

      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-card rounded-lg border p-4">
              <h3 className="font-semibold text-foreground mb-4">Categorias</h3>
              <nav className="space-y-2">
                <button
                  onClick={() => handleCategoryClick(null)}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                  style={{
                    backgroundColor: selectedCategory === null ? `${accentColor}15` : "transparent",
                    color: selectedCategory === null ? accentColor : "inherit",
                    fontWeight: selectedCategory === null ? 600 : 400,
                  }}
                >
                  Todos os Produtos
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                    style={{
                      backgroundColor: selectedCategory === cat.id ? `${accentColor}15` : "transparent",
                      color: selectedCategory === cat.id ? accentColor : "inherit",
                      fontWeight: selectedCategory === cat.id ? 600 : 400,
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </nav>

              {/* Promotional filter */}
              <div className="mt-6 pt-4 border-t border-border">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={showPromotionsOnly}
                    onChange={(e) => setShowPromotionsOnly(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    style={{ accentColor: accentColor }}
                  />
                  <span className="text-sm text-foreground leading-tight group-hover:text-muted-foreground transition-colors">
                    Produtos em promoção dessa categoria
                  </span>
                </label>
              </div>
            </div>
          </aside>

          {/* Mobile sidebar toggle */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden fixed bottom-20 left-4 z-40 shadow-lg"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-4 w-4 mr-2" />
            Categorias
          </Button>

          {/* Mobile sidebar overlay */}
          {mobileSidebarOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileSidebarOpen(false)}>
              <aside
                className="absolute left-0 top-0 h-full w-64 bg-background shadow-xl p-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Categorias</h3>
                  <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <nav className="space-y-2">
                  <button
                    onClick={() => handleCategoryClick(null)}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                    style={{
                      backgroundColor: selectedCategory === null ? `${accentColor}15` : "transparent",
                      color: selectedCategory === null ? accentColor : "inherit",
                      fontWeight: selectedCategory === null ? 600 : 400,
                    }}
                  >
                    Todos os Produtos
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat.id)}
                      className="block w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                      style={{
                        backgroundColor: selectedCategory === cat.id ? `${accentColor}15` : "transparent",
                        color: selectedCategory === cat.id ? accentColor : "inherit",
                        fontWeight: selectedCategory === cat.id ? 600 : 400,
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </nav>

                {/* Promotional filter - Mobile */}
                <div className="mt-6 pt-4 border-t border-border">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showPromotionsOnly}
                      onChange={(e) => {
                        setShowPromotionsOnly(e.target.checked);
                      }}
                      className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      style={{ accentColor: accentColor }}
                    />
                    <span className="text-sm text-foreground leading-tight group-hover:text-muted-foreground transition-colors">
                      Produtos em promoção dessa categoria
                    </span>
                  </label>
                </div>
              </aside>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{selectedCategoryName}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {filteredProducts.length} {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}
              </p>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum produto encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    storeSlug={storeSlug}
                    primaryColor={storeData.primary_color}
                    buttonBgColor={buttonBgColor}
                    buttonTextColor={buttonTextColor}
                    buttonBorderStyle={buttonBorderStyle}
                    productImageFormat={productImageFormat}
                    productBorderStyle={productBorderStyle}
                    productTextAlignment={productTextAlignment}
                    productButtonDisplay={productButtonDisplay}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <StoreFooter storeData={storeData} />

      {storeData.whatsapp_number && (
        <WhatsAppButton
          phoneNumber={storeData.whatsapp_number}
          storeOwnerId={storeData.id}
          storeName={storeData.store_name}
          primaryColor={storeData.primary_color}
        />
      )}

      <MiniCart
        storeSlug={storeSlug || ""}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        buttonBorderStyle={buttonBorderStyle}
        primaryColor={storeData.primary_color}
      />
    </div>
  );
};

export default StoreCategoryPage;
