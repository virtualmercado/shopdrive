import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Search, Package, Store as StoreIcon } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
}

interface StoreProfile {
  store_name: string | null;
  store_slug: string | null;
  store_description: string | null;
  store_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

const Store = () => {
  const { storeSlug } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { addToCart, getTotalItems } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    fetchStoreData();
  }, [storeSlug]);

  const fetchStoreData = async () => {
    try {
      // Fetch store profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("store_name, store_slug, store_description, store_logo_url, primary_color, secondary_color, id")
        .eq("store_slug", storeSlug)
        .single();

      if (profileError) throw profileError;
      setStoreProfile(profileData);

      // Fetch products for this store
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", profileData.id)
        .gt("stock", 0)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: "Loja não encontrada",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock: product.stock,
    });
    toast({
      title: "Adicionado ao carrinho",
      description: `${product.name} foi adicionado ao carrinho`,
    });
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando loja...</p>
      </div>
    );
  }

  if (!storeProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <StoreIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Loja não encontrada</h2>
          <p className="text-muted-foreground">
            A loja que você está procurando não existe.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {storeProfile.store_logo_url && (
                <img
                  src={storeProfile.store_logo_url}
                  alt={storeProfile.store_name || "Logo"}
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{storeProfile.store_name}</h1>
                {storeProfile.store_description && (
                  <p className="text-sm text-muted-foreground">
                    {storeProfile.store_description}
                  </p>
                )}
              </div>
            </div>
            <Link to={`/store/${storeSlug}/cart`}>
              <Button variant="outline" className="relative gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrinho
                {getTotalItems() > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center">
                    {getTotalItems()}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1 line-clamp-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-bold text-primary">
                      R$ {product.price.toFixed(2)}
                    </p>
                    <Badge variant="secondary">{product.stock} em estoque</Badge>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock === 0}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto disponível"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Tente buscar por outro termo"
                : "Esta loja ainda não possui produtos cadastrados"}
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Store;
