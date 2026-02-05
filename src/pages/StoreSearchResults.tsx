import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import MiniCart from "@/components/store/MiniCart";
import ProductCard from "@/components/store/ProductCard";
import { MiniCartProvider } from "@/contexts/MiniCartContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface StoreData {
  id: string;
  store_name: string;
  store_slug: string;
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
  header_logo_position?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: any;
  stock: number;
}

const StoreSearchResultsContent = () => {
  const { getItemCount } = useCart();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const q = useMemo(() => (searchParams.get("q") || "").trim(), [searchParams]);

  // Get storeSlug from multiple sources for reliability
  const stateStoreSlug = (location.state as any)?.storeSlug as string | undefined;
  const storeSlug = useMemo(() => {
    const slug = stateStoreSlug || sessionStorage.getItem("vm_active_store_slug") || "";
    console.log("[StoreSearchResults] storeSlug resolved:", slug, "| q:", q);
    return slug;
  }, [stateStoreSlug, q]);

  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeSlug) {
        console.warn("[StoreSearchResults] No storeSlug available");
        setStoreData(null);
        setLoadingStore(false);
        return;
      }

      setLoadingStore(true);
      console.log("[StoreSearchResults] Fetching store for slug:", storeSlug);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .maybeSingle();

      if (error || !data) {
        console.error("[StoreSearchResults] Error fetching store:", error);
        setStoreData(null);
      } else {
        console.log("[StoreSearchResults] Store data loaded:", data.store_name);
        setStoreData(data as any);
      }

      setLoadingStore(false);
    };

    fetchStore();
  }, [storeSlug]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!storeSlug) {
        console.warn("[StoreSearchResults] Cannot search - no storeSlug");
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      if (!q) {
        console.log("[StoreSearchResults] No search term provided");
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      setLoadingProducts(true);
      console.log("[StoreSearchResults] Searching products with term:", q, "in store:", storeSlug);

      try {
        // Normalize search term for better matching
        const normalizedTerm = q.toLowerCase().trim();
        const like = `%${normalizedTerm}%`;
        
        console.log("[StoreSearchResults] Query:", { storeSlug, like });

        const { data, error } = await supabase
          .from("public_store_products")
          .select("id,name,price,promotional_price,image_url,images,stock")
          .eq("store_slug", storeSlug)
          .ilike("name", like)
          .order("created_at", { ascending: false })
          .limit(60);

        if (error) {
          console.error("[StoreSearchResults] Query error:", error);
          setProducts([]);
        } else {
          console.log("[StoreSearchResults] Found", data?.length || 0, "products");
          setProducts(
            (data || []).map((item: any) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              promotional_price: item.promotional_price,
              image_url: item.image_url,
              images: item.images,
              stock: item.stock ?? 999,
            }))
          );
        }
      } catch (err) {
        console.error("[StoreSearchResults] Exception:", err);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [storeSlug, q]);

  if (loadingStore) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-20 w-full" />
        <div className="container mx-auto p-4 space-y-6">
          <Skeleton className="h-10 w-80" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!storeSlug || !storeData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center px-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Busca indisponível</h1>
          <p className="text-muted-foreground">
            Para buscar produtos, acesse uma loja primeiro.
          </p>
          <Link to="/" className="inline-block mt-6">
            <Button variant="outline">Ir para o início</Button>
          </Link>
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

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader
        storeName={storeData.store_name}
        logoUrl={storeData.store_logo_url}
        primaryColor={storeData.primary_color}
        secondaryColor={storeData.secondary_color}
        backgroundColor={storeData.footer_text_color}
        storeOwnerId={storeData.id}
        storeSlug={storeSlug}
        cartItemCount={getItemCount()}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        logoPosition={(storeData.header_logo_position as "left" | "center" | "right") || "left"}
        searchTerm={q}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to={`/loja/${storeSlug}`}>
            <Button variant="ghost" className="mb-3 pl-0 hover:bg-transparent">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar para a loja
            </Button>
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {q ? `Resultados para: ${q}` : "Buscar produtos"}
          </h1>
          {q && !loadingProducts && (
            <p className="text-muted-foreground text-sm mt-1">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </p>
          )}
        </div>

        {!q ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Digite um termo e pressione Enter.</p>
          </div>
        ) : loadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
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
        storeSlug={storeSlug}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        buttonBorderStyle={buttonBorderStyle}
        primaryColor={storeData.primary_color}
      />
    </div>
  );
};

const StoreSearchResults = () => {
  return (
    <CartProvider>
      <MiniCartProvider>
        <StoreSearchResultsContent />
      </MiniCartProvider>
    </CartProvider>
  );
};

export default StoreSearchResults;
