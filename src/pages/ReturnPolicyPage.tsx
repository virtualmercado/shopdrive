import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import MiniCart from "@/components/store/MiniCart";
import { MiniCartProvider } from "@/contexts/MiniCartContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";

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
  return_policy_text?: string;
  email?: string;
  phone?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip_code?: string;
  instagram_url?: string;
  facebook_url?: string;
  x_url?: string;
  youtube_url?: string;
  cpf_cnpj?: string;
  header_logo_position?: string;
}

const ReturnPolicyPageContent = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const { getItemCount } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      if (!storeSlug) return;

      const { data: store } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .single();

      if (store) {
        setStoreData(store);
      }

      setLoading(false);
    };

    fetchData();
  }, [storeSlug]);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left">
            Política de trocas e devoluções
          </h1>
          
          <div className="text-left text-foreground whitespace-pre-wrap leading-relaxed">
            {storeData.return_policy_text || (
              <p className="text-muted-foreground italic">
                O lojista ainda não cadastrou a política de trocas e devoluções.
              </p>
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

const ReturnPolicyPage = () => {
  return (
    <CartProvider>
      <MiniCartProvider>
        <ReturnPolicyPageContent />
      </MiniCartProvider>
    </CartProvider>
  );
};

export default ReturnPolicyPage;
