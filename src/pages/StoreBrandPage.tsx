import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import StoreTopBar from "@/components/store/StoreTopBar";
import ProductCard from "@/components/store/ProductCard";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import MiniCart from "@/components/store/MiniCart";
import { MiniCartProvider } from "@/contexts/MiniCartContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

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
  header_logo_position?: string;
  topbar_enabled?: boolean;
  topbar_bg_color?: string;
  topbar_text_color?: string;
  topbar_text?: string;
  topbar_link_type?: "none" | "content_page" | "category" | "sale" | "section" | "external";
  topbar_link_target?: string;
}

const StoreBrandContent = () => {
  const { storeSlug, brandId } = useParams<{ storeSlug: string; brandId: string }>();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { getItemCount } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      if (!storeSlug || !brandId) return;

      // Fetch store data
      const { data: store, error: storeError } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .single();

      if (storeError || !store) {
        setLoading(false);
        return;
      }

      setStoreData({
        ...store,
        topbar_link_type: (store.topbar_link_type as StoreData["topbar_link_type"]) || "none",
      });

      // Fetch brand data
      const { data: brandData, error: brandError } = await supabase
        .from("product_brands")
        .select("id, name, logo_url")
        .eq("id", brandId)
        .eq("user_id", store.id)
        .eq("is_active", true)
        .single();

      if (brandError) {
        if (import.meta.env.DEV) {
          console.error("Error fetching brand:", brandError);
        }
      } else {
        setBrand(brandData);
      }

      // Fetch products by brand
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", store.id)
        .eq("brand_id", brandId)
        .gt("stock", 0)
        .order("created_at", { ascending: false });

      if (productsError) {
        if (import.meta.env.DEV) {
          console.error("Error fetching brand products:", productsError);
        }
      } else {
        setProducts(productsData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, [storeSlug, brandId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-20 w-full" />
        <div className="container mx-auto p-4 space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
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

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Marca não encontrada</h1>
          <p className="text-muted-foreground">A marca que você procura não existe.</p>
          <Link to={`/loja/${storeSlug}`}>
            <Button className="mt-4">Voltar para a loja</Button>
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
      {/* Top Bar */}
      {storeData.topbar_enabled && storeData.topbar_text && (
        <StoreTopBar
          text={storeData.topbar_text}
          bgColor={storeData.topbar_bg_color || "#000000"}
          textColor={storeData.topbar_text_color || "#FFFFFF"}
          linkType={storeData.topbar_link_type || "none"}
          linkTarget={storeData.topbar_link_target || null}
          storeSlug={storeSlug || ""}
        />
      )}

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
        logoPosition={(storeData.header_logo_position as "left" | "center" | "right") || "left"}
      />

      <main className="container mx-auto px-4 py-8">
        {/* Back button and title */}
        <div className="mb-8">
          <Link to={`/loja/${storeSlug}`}>
            <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar para a loja
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-16 w-auto object-contain"
              />
            ) : (
              <div
                className="p-3 rounded-full"
                style={{ backgroundColor: storeData.primary_color + "20" }}
              >
                <Tag className="h-6 w-6" style={{ color: storeData.primary_color }} />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {brand.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {products.length} {products.length === 1 ? "produto" : "produtos"}
              </p>
            </div>
          </div>
        </div>

        {/* Products grid */}
        {products.length === 0 ? (
          <div className="text-center py-16">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Nenhum produto encontrado
            </h2>
            <p className="text-muted-foreground mb-6">
              Esta marca não possui produtos disponíveis no momento.
            </p>
            <Link to={`/loja/${storeSlug}`}>
              <Button
                style={{
                  backgroundColor: buttonBgColor,
                  color: buttonTextColor,
                }}
              >
                Ver todos os produtos
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        storeSlug={storeSlug || ""}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        buttonBorderStyle={buttonBorderStyle}
        primaryColor={storeData.primary_color}
      />
    </div>
  );
};

const StoreBrandPage = () => {
  return (
    <CartProvider>
      <MiniCartProvider>
        <StoreBrandContent />
      </MiniCartProvider>
    </CartProvider>
  );
};

export default StoreBrandPage;
