import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowLeft, Ruler, Heart, Share2 } from "lucide-react";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { useMiniCart, MiniCartProvider } from "@/contexts/MiniCartContext";
import MiniCart from "@/components/store/MiniCart";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: string[] | null;
  stock: number;
  category_id: string | null;
  variations: any[] | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
}

interface Category {
  id: string;
  name: string;
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
  button_bg_color?: string;
  button_text_color?: string;
  button_border_style?: string;
  product_image_format?: string;
  product_border_style?: string;
  font_family?: string;
  font_weight?: number;
  whatsapp_number?: string;
  instagram_url?: string;
  facebook_url?: string;
  x_url?: string;
  youtube_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip_code?: string;
  return_policy_text?: string;
  cpf_cnpj?: string;
  header_logo_position?: string;
}

const ProductDetailContent = () => {
  const { storeSlug, productId } = useParams();
  const navigate = useNavigate();
  const { addToCart, getItemCount } = useCart();
  const { openMiniCart, setLastAddedItem } = useMiniCart();
  const { user } = useCustomerAuth();
  const { toast } = useToast();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!storeSlug || !productId) return;

      // Fetch store profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
        .maybeSingle();

      if (profileData) {
        setStoreData(profileData);

        // Fetch product
        const { data: productData } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("user_id", profileData.id)
          .maybeSingle();

        if (productData) {
          const parsedImages = Array.isArray(productData.images) 
            ? productData.images 
            : typeof productData.images === 'string' 
              ? JSON.parse(productData.images) 
              : [];
          
          const parsedVariations = Array.isArray(productData.variations)
            ? productData.variations
            : typeof productData.variations === 'string'
              ? JSON.parse(productData.variations)
              : [];

          setProduct({
            ...productData,
            images: parsedImages,
            variations: parsedVariations
          });

          // Fetch category if exists
          if (productData.category_id) {
            const { data: categoryData } = await supabase
              .from("product_categories")
              .select("id, name")
              .eq("id", productData.category_id)
              .maybeSingle();
            
            if (categoryData) {
              setCategory(categoryData);
            }
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [storeSlug, productId]);

  // Check if product is favorited
  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !productId) return;
      
      const { data } = await supabase
        .from("customer_favorites")
        .select("id")
        .eq("customer_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      
      setIsFavorite(!!data);
    };

    checkFavorite();
  }, [user, productId]);

  const handleToggleFavorite = async () => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para salvar favoritos.",
        variant: "destructive",
      });
      navigate(`/loja/${storeSlug}/conta`);
      return;
    }

    if (!product || !storeData) return;

    setFavoriteLoading(true);
    
    if (isFavorite) {
      // Remove from favorites
      const { error } = await supabase
        .from("customer_favorites")
        .delete()
        .eq("customer_id", user.id)
        .eq("product_id", product.id);

      if (!error) {
        setIsFavorite(false);
        toast({
          title: "Removido dos favoritos",
          description: "Produto removido da sua lista de favoritos.",
        });
      }
    } else {
      // Add to favorites
      const { error } = await supabase
        .from("customer_favorites")
        .insert({
          customer_id: user.id,
          product_id: product.id,
          store_owner_id: storeData.id,
        });

      if (!error) {
        setIsFavorite(true);
        toast({
          title: "Adicionado aos favoritos",
          description: "Produto salvo na sua lista de favoritos.",
        });
      }
    }
    
    setFavoriteLoading(false);
  };

  const handleShareProduct = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado!",
        description: "O link do produto foi copiado para a área de transferência.",
      });
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const handleAddToCart = () => {
    if (!product || product.stock <= 0) return;

    const variationsString = Object.entries(selectedVariations)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      promotional_price: product.promotional_price,
      image_url: product.image_url || (product.images && product.images[0]) || "/placeholder.svg",
      weight: product.weight,
      height: product.height,
      width: product.width,
      length: product.length,
    };

    for (let i = 0; i < quantity; i++) {
      addToCart(cartItem);
    }

    setLastAddedItem({
      ...cartItem,
      quantity,
      variations: variationsString || undefined
    });

    openMiniCart();
  };

  const handleVariationSelect = (groupName: string, value: string) => {
    setSelectedVariations(prev => ({
      ...prev,
      [groupName]: value
    }));
  };

  // Style configurations
  const primaryColor = storeData?.primary_color || "#6a1b9a";
  const buttonBgColor = storeData?.button_bg_color || primaryColor;
  const buttonTextColor = storeData?.button_text_color || "#FFFFFF";
  const buttonBorderStyle = storeData?.button_border_style || "rounded";
  const productImageFormat = storeData?.product_image_format || "square";
  const productBorderStyle = storeData?.product_border_style || "rounded";
  const fontFamily = storeData?.font_family || "Inter";
  const fontWeight = storeData?.font_weight || 400;

  const buttonRadius = buttonBorderStyle === 'straight' ? 'rounded-none' : 'rounded-lg';
  const imageRadius = productBorderStyle === 'straight' ? 'rounded-none' : 'rounded-lg';
  const aspectRatio = productImageFormat === 'rectangular' ? 'aspect-[3/4]' : 'aspect-square';

  const finalPrice = product?.promotional_price || product?.price || 0;
  const totalPrice = finalPrice * quantity;

  // Get unique images (fix duplicate issue)
  const allImages = product ? 
    [...new Set([product.image_url, ...(product.images || [])].filter(Boolean))] as string[] 
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background" style={{ fontFamily, fontWeight }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-96 w-full mb-6" />
          <Skeleton className="h-10 w-1/3 mb-4" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!product || !storeData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={{ fontFamily, fontWeight }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Produto não encontrado</h1>
          <Button onClick={() => navigate(`/loja/${storeSlug}`)}>
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily, fontWeight }}>
      <StoreHeader
        storeName={storeData.store_name}
        logoUrl={storeData.store_logo_url}
        primaryColor={primaryColor}
        secondaryColor={storeData.secondary_color}
        backgroundColor={storeData.footer_text_color}
        storeOwnerId={storeData.id}
        storeSlug={storeSlug || ""}
        cartItemCount={getItemCount()}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        logoPosition={(storeData.header_logo_position as "left" | "center" | "right") || "left"}
      />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">
        {/* Back Button */}
        <Link 
          to={`/loja/${storeSlug}`}
          className="inline-flex items-center gap-2 text-foreground/90 hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a loja
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Image Section */}
          <div className="space-y-4">
            <div className={`${aspectRatio} overflow-hidden bg-muted ${imageRadius}`}>
              <img
                src={allImages[selectedImageIndex] || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Thumbnail Gallery */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, index) => (
                  <button
                    key={`thumb-${index}-${img}`}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 overflow-hidden ${imageRadius} border-2 transition-all ${
                      selectedImageIndex === index 
                        ? 'border-opacity-100' 
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ 
                      borderColor: selectedImageIndex === index ? buttonBgColor : 'transparent' 
                    }}
                  >
                    <img
                      src={img}
                      alt={`${product.name} - ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Technical Info - Moved below thumbnails */}
            {(product.weight || product.length || product.height || product.width) && (
              <div className="pt-4 border-t">
                <h2 className="text-sm font-semibold text-foreground/90 mb-3 flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Informações Técnicas
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {product.weight && (
                    <div className="flex justify-between">
                      <span className="text-foreground/90">Peso:</span>
                      <span className="text-foreground">{product.weight} kg</span>
                    </div>
                  )}
                  {product.length && (
                    <div className="flex justify-between">
                      <span className="text-foreground/90">Comprimento:</span>
                      <span className="text-foreground">{product.length} cm</span>
                    </div>
                  )}
                  {product.width && (
                    <div className="flex justify-between">
                      <span className="text-foreground/90">Largura:</span>
                      <span className="text-foreground">{product.width} cm</span>
                    </div>
                  )}
                  {product.height && (
                    <div className="flex justify-between">
                      <span className="text-foreground/90">Altura:</span>
                      <span className="text-foreground">{product.height} cm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Customer Actions: Favorite & Share */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
                className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors"
              >
                <Heart 
                  className={`h-5 w-5 transition-all ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} 
                />
                <span>{isFavorite ? 'Salvo como favorito' : 'Salvar como favorito'}</span>
              </button>
              
              <button
                onClick={handleShareProduct}
                className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors"
              >
                <Share2 className="h-5 w-5" />
                <span>Compartilhar produto</span>
              </button>
            </div>
          </div>

          {/* Product Info Section */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {product.name}
              </h1>
              {category && (
                <p className="text-sm text-foreground/90">
                  {category.name}
                </p>
              )}
              <p className="text-xs text-foreground/90 mt-1">
                Ref: {product.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            {/* Price */}
            <div className="space-y-1">
              {product.promotional_price ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-foreground">
                    R$ {product.promotional_price.toFixed(2)}
                  </span>
                  <span className="text-lg text-muted-foreground line-through">
                    R$ {product.price.toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-foreground">
                  R$ {product.price.toFixed(2)}
                </span>
              )}
              {quantity > 1 && (
                <p className="text-sm text-muted-foreground">
                  Total: R$ {totalPrice.toFixed(2)} ({quantity} unidades)
                </p>
              )}
            </div>

            {/* Variations */}
            {product.variations && product.variations.length > 0 && (
              <div className="space-y-4">
                {product.variations.map((variation: any, index: number) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {variation.name || variation.group}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(variation.values || variation.options || []).map((value: string, vIndex: number) => {
                        const groupName = variation.name || variation.group;
                        const isSelected = selectedVariations[groupName] === value;
                        return (
                          <button
                            key={vIndex}
                            onClick={() => handleVariationSelect(groupName, value)}
                            className={`px-4 py-2 text-sm border transition-all ${buttonRadius}`}
                            style={{
                              backgroundColor: isSelected ? buttonBgColor : 'transparent',
                              color: isSelected ? buttonTextColor : 'inherit',
                              borderColor: isSelected ? buttonBgColor : '#e5e7eb'
                            }}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Quantidade
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className={`w-10 h-10 flex items-center justify-center border ${buttonRadius} hover:bg-muted transition-colors`}
                >
                  -
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className={`w-10 h-10 flex items-center justify-center border ${buttonRadius} hover:bg-muted transition-colors`}
                >
                  +
                </button>
                <span className="text-sm text-foreground/90">
                  {product.stock} disponíveis
                </span>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className={`w-full h-14 text-lg ${buttonRadius} transition-all hover:opacity-90`}
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {product.stock <= 0 ? "Produto Indisponível" : "Adicionar ao Carrinho"}
            </Button>

          </div>
        </div>

        {/* Description - Centered and optimized for readability */}
        {product.description && (
          <div className="mt-10 pt-8 border-t">
            <div className="max-w-2xl mx-auto px-4 md:px-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
                Descrição do Produto
              </h2>
              <p className="text-foreground/90 leading-7 whitespace-pre-line text-justify">
                {product.description}
              </p>
            </div>
          </div>
        )}
      </main>

      <StoreFooter storeData={storeData} />

      {storeData.whatsapp_number && (
        <WhatsAppButton 
          phoneNumber={storeData.whatsapp_number} 
          storeOwnerId={storeData.id}
          storeName={storeData.store_name}
          primaryColor={primaryColor}
        />
      )}

      <MiniCart
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        buttonBorderStyle={buttonBorderStyle}
        primaryColor={primaryColor}
        storeSlug={storeSlug || ""}
      />
    </div>
  );
};

const ProductDetail = () => {
  return (
    <CartProvider>
      <MiniCartProvider>
        <ProductDetailContent />
      </MiniCartProvider>
    </CartProvider>
  );
};

export default ProductDetail;
