import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import StoreBanner from "@/components/store/StoreBanner";
import ProductCarousel from "@/components/store/ProductCarousel";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/useCart";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string;
  store_logo_url: string;
  primary_color: string;
  secondary_color: string;
  banner_desktop_url: string;
  banner_mobile_url: string;
  banner_rect_1_url: string;
  banner_rect_2_url: string;
  footer_bg_color: string;
  footer_text_color: string;
  whatsapp_number: string;
}

const OnlineStore = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
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

      setStoreData(data);
      setLoading(false);
    };

    fetchStoreData();
  }, [storeSlug]);

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

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader 
        storeName={storeData.store_name}
        logoUrl={storeData.store_logo_url}
        primaryColor={storeData.primary_color}
        storeOwnerId={storeData.id}
        storeSlug={storeSlug || ""}
        cartItemCount={getItemCount()}
      />
      
      <StoreBanner
        desktopBannerUrl={storeData.banner_desktop_url}
        mobileBannerUrl={storeData.banner_mobile_url}
      />

      <main className="container mx-auto px-4 py-8 space-y-12">
        <ProductCarousel
          title="Destaques"
          subtitle="Confira os produtos em destaque"
          storeOwnerId={storeData.id}
          featured={true}
        />

        <ProductCarousel
          title="Novidades"
          subtitle="Confira os produtos mais recentes"
          storeOwnerId={storeData.id}
          newest={true}
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
        />
      )}
    </div>
  );
};

export default OnlineStore;
