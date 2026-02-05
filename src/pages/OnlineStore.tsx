import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import StoreBanner from "@/components/store/StoreBanner";
import StoreTopBar from "@/components/store/StoreTopBar";
import ProductCarousel from "@/components/store/ProductCarousel";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import MiniCart from "@/components/store/MiniCart";
import MiniBannerSection from "@/components/store/MiniBannerSection";
import { BrandSection } from "@/components/store/BrandSection";
import HomeVideoSection from "@/components/store/HomeVideoSection";
import { StoreLayoutContent } from "@/components/store/StoreLayoutContent";
import { CatalogProductList } from "@/components/store/CatalogProductList";
import { MiniCartProvider } from "@/contexts/MiniCartContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { getEffectiveBanners } from "@/lib/defaultBanners";

type StoreModelType = "loja_virtual" | "catalogo_digital";

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
  // New minibanner fields for 2-image system
  minibanner_1_img2_url?: string | null;
  minibanner_2_img2_url?: string | null;
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
  is_maintenance_mode?: boolean;
  header_logo_position?: string;
  // Top Bar fields
  topbar_enabled?: boolean;
  topbar_bg_color?: string;
  topbar_text_color?: string;
  topbar_text?: string;
  topbar_link_type?: "none" | "content_page" | "category" | "sale" | "section" | "external";
  topbar_link_target?: string;
  // YouTube video fields
  home_video_enabled?: boolean;
  home_video_id?: string | null;
  home_video_title?: string | null;
  home_video_description?: string | null;
  // Store layout
  store_layout?: "layout_01" | "layout_02" | "layout_03";
  // Store model
  store_model?: StoreModelType;
}

const OnlineStoreContent = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Initialize search term from URL parameter
  const initialSearchTerm = searchParams.get("busca") || "";
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeSearchTerm, setActiveSearchTerm] = useState(initialSearchTerm);
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
        if (import.meta.env.DEV) {
          console.error("Error fetching store:", error);
        }
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
        topbar_link_type: (data.topbar_link_type as StoreData["topbar_link_type"]) || "none",
        // YouTube video fields
        home_video_enabled: (data as any).home_video_enabled || false,
        home_video_id: (data as any).home_video_id || null,
        home_video_title: (data as any).home_video_title || null,
        home_video_description: (data as any).home_video_description || null,
        // Store layout
        store_layout: (data.store_layout as StoreData["store_layout"]) || "layout_01",
        // Store model
        store_model: ((data as any).store_model as StoreModelType) || "loja_virtual",
      });
      setLoading(false);
    };

    fetchStoreData();
  }, [storeSlug]);

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    // Update URL parameter for shareability
    if (term.trim()) {
      setSearchParams({ busca: term.trim() });
    } else {
      setSearchParams({});
    }
  };

  // Sync search term when URL parameter changes (e.g., from navigation)
  useEffect(() => {
    const urlSearchTerm = searchParams.get("busca") || "";
    if (urlSearchTerm !== searchTerm) {
      setSearchTerm(urlSearchTerm);
      setActiveSearchTerm(urlSearchTerm);
    }
  }, [searchParams]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setActiveSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

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

  // Show maintenance page if maintenance mode is enabled
  if (storeData.is_maintenance_mode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center px-6 max-w-md">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-3">
              Loja em Manutenção
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              A loja está temporariamente em manutenção. Por favor, volte mais tarde.
            </p>
          </div>
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

  const isSearching = activeSearchTerm.trim().length > 0;
  const isCatalogMode = storeData.store_model === "catalogo_digital";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar - shown in both modes */}
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
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        logoPosition={(storeData.header_logo_position as "left" | "center" | "right") || "left"}
      />
      
      {/* Banner - only shown in Loja Virtual mode */}
      {!isCatalogMode && (() => {
        const customDesktopUrls = storeData.banner_desktop_urls !== undefined
          ? (storeData.banner_desktop_urls ?? [])
          : storeData.banner_desktop_url
          ? [storeData.banner_desktop_url]
          : [];
        
        const customMobileUrls = storeData.banner_mobile_urls !== undefined
          ? (storeData.banner_mobile_urls ?? [])
          : storeData.banner_mobile_url
          ? [storeData.banner_mobile_url]
          : [];
        
        const effectiveBanners = getEffectiveBanners(customDesktopUrls, customMobileUrls);
        
        return (
          <StoreBanner
            desktopBannerUrls={effectiveBanners.desktopBanners}
            mobileBannerUrls={effectiveBanners.mobileBanners}
          />
        );
      })()}

      <main className="container mx-auto px-4 py-8 space-y-12">
        {isCatalogMode ? (
          // Catalog Mode: Show simple product listing with pagination
          <CatalogProductList
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
            selectedCategory={selectedCategory}
            searchTerm={activeSearchTerm}
          />
        ) : isSearching ? (
          // Show search results section when searching
          <ProductCarousel
            title={`Resultados para "${activeSearchTerm}"`}
            subtitle="Produtos encontrados na busca"
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
            searchTerm={activeSearchTerm}
            selectedCategory={selectedCategory}
            showAllOnSearch={true}
          />
        ) : (
          // Show normal carousels based on selected layout
          <StoreLayoutContent
            storeData={storeData}
            storeSlug={storeSlug}
            buttonBgColor={buttonBgColor}
            buttonTextColor={buttonTextColor}
            buttonBorderStyle={buttonBorderStyle}
            productImageFormat={productImageFormat}
            productBorderStyle={productBorderStyle}
            productTextAlignment={productTextAlignment}
            productButtonDisplay={productButtonDisplay}
            selectedCategory={selectedCategory}
          />
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

const OnlineStore = () => {
  return (
    <CartProvider>
      <MiniCartProvider>
        <OnlineStoreContent />
      </MiniCartProvider>
    </CartProvider>
  );
};

export default OnlineStore;
