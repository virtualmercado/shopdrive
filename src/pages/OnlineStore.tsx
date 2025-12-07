import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import StoreBanner from "@/components/store/StoreBanner";
import ProductCarousel from "@/components/store/ProductCarousel";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import MiniCart from "@/components/store/MiniCart";
import { MiniCartProvider } from "@/contexts/MiniCartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/useCart";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string;
  store_logo_url: string;
  primary_color: string;
  secondary_color: string;
  footer_text_color: string;
  banner_desktop_url: string;
  banner_mobile_url: string;
  banner_desktop_urls?: string[];
  banner_mobile_urls?: string[];
  banner_rect_1_url: string;
  banner_rect_2_url: string;
  footer_bg_color: string;
  whatsapp_number: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  button_bg_color?: string;
  button_text_color?: string;
  button_border_style?: string;
  product_image_format?: string;
  product_border_style?: string;
  product_text_alignment?: string;
  product_button_display?: string;
}

const OnlineStoreContent = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { getItemCount } = useCart();

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!storeSlug) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .single();

      if (error) {
        console.error("Error fetching store:", error);
        setLoading(false);
        return;
      }

      const desktopUrls = Array.isArray(data.banner_desktop_urls) 
        ? data.banner_desktop_urls.filter((url): url is string => typeof url === 'string')
        : [];
      
      const mobileUrls = Array.isArray(data.banner_mobile_urls)
        ? data.banner_mobile_urls.filter((url): url is string => typeof url === 'string')
        : [];

      setStoreData({
        ...data,
        banner_desktop_urls: desktopUrls,
        banner_mobile_urls: mobileUrls,
      });
      setLoading(false);
    };

    fetchStoreData();
  }, [storeSlug]);

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  };

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-20 w-full" />
        <div className="container mx-auto p-4 space-y-8">
          <Skeleton className="h-64 w-full" />
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
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />
      
      <StoreBanner
        desktopBannerUrls={
          storeData.banner_desktop_urls && storeData.banner_desktop_urls.length > 0
            ? storeData.banner_desktop_urls
            : storeData.banner_desktop_url
            ? [storeData.banner_desktop_url]
            : []
        }
        mobileBannerUrls={
          storeData.banner_mobile_urls && storeData.banner_mobile_urls.length > 0
            ? storeData.banner_mobile_urls
            : storeData.banner_mobile_url
            ? [storeData.banner_mobile_url]
            : []
        }
      />

      <main className="container mx-auto px-4 py-8 space-y-12">
        <ProductCarousel
          title="Destaques"
          subtitle="Confira os produtos em destaque"
          storeOwnerId={storeData.id}
          storeSlug={storeSlug}
          featured={true}
          primaryColor={storeData.primary_color}
          buttonBgColor={buttonBgColor}
          buttonTextColor={buttonTextColor}
          buttonBorderStyle={buttonBorderStyle}
          productImageFormat={productImageFormat}
          productBorderStyle={productBorderStyle}
          productTextAlignment={productTextAlignment}
          productButtonDisplay={productButtonDisplay}
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
        />

        <ProductCarousel
          title="Novidades"
          subtitle="Confira os últimos lançamentos"
          storeOwnerId={storeData.id}
          storeSlug={storeSlug}
          newest
          primaryColor={storeData.primary_color}
          buttonBgColor={buttonBgColor}
          buttonTextColor={buttonTextColor}
          buttonBorderStyle={buttonBorderStyle}
          productImageFormat={productImageFormat}
          productBorderStyle={productBorderStyle}
          productTextAlignment={productTextAlignment}
          productButtonDisplay={productButtonDisplay}
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
        />

        <ProductCarousel
          title="Todos os Produtos"
          subtitle="Navegue por todo o catálogo"
          storeOwnerId={storeData.id}
          storeSlug={storeSlug}
          primaryColor={storeData.primary_color}
          buttonBgColor={buttonBgColor}
          buttonTextColor={buttonTextColor}
          buttonBorderStyle={buttonBorderStyle}
          productImageFormat={productImageFormat}
          productBorderStyle={productBorderStyle}
          productTextAlignment={productTextAlignment}
          productButtonDisplay={productButtonDisplay}
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storeData.banner_rect_1_url && (
            <img
              src={storeData.banner_rect_1_url}
              alt="Banner promocional"
              className="w-full h-48 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            />
          )}
          {storeData.banner_rect_2_url && (
            <img
              src={storeData.banner_rect_2_url}
              alt="Banner promocional"
              className="w-full h-48 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            />
          )}
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

const OnlineStore = () => {
  return (
    <MiniCartProvider>
      <OnlineStoreContent />
    </MiniCartProvider>
  );
};

export default OnlineStore;
