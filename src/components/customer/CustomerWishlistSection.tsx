import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Heart, Trash2, ShoppingCart } from "lucide-react";

interface WishlistItem {
  id: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    price: number;
    promotional_price: number | null;
    image_url: string | null;
    stock: number;
  } | null;
}

interface CustomerWishlistSectionProps {
  storeProfile: any;
  storeSlug: string;
  userId: string;
}

const CustomerWishlistSection = ({ storeProfile, storeSlug, userId }: CustomerWishlistSectionProps) => {
  const { toast } = useToast();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, [userId, storeProfile?.id]);

  const fetchWishlist = async () => {
    if (!userId || !storeProfile?.id) return;

    const { data } = await supabase
      .from('customer_favorites')
      .select(`
        id,
        product_id,
        product:products (
          id,
          name,
          price,
          promotional_price,
          image_url,
          stock
        )
      `)
      .eq('customer_id', userId)
      .eq('store_owner_id', storeProfile.id);

    if (data) {
      // Fix the type mapping
      const mappedData = data.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product: item.product as WishlistItem['product']
      }));
      setWishlist(mappedData);
    }
    setLoading(false);
  };

  const handleRemoveFromWishlist = async (favoriteId: string) => {
    const { error } = await supabase
      .from('customer_favorites')
      .delete()
      .eq('id', favoriteId);

    if (error) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Removido da lista de desejos",
      });
      fetchWishlist();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lista de Desejos</h1>

      {wishlist.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">Sua lista está vazia</h3>
          <p className="text-muted-foreground mb-4">
            Você ainda não adicionou nenhum produto à sua lista de desejos.
          </p>
          <Link to={`/loja/${storeSlug}`}>
            <Button
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
            >
              Explorar produtos
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <p className="text-sm text-muted-foreground">
              {wishlist.length} {wishlist.length === 1 ? 'produto' : 'produtos'} na sua lista
            </p>
          </div>
          
          <div className="divide-y">
            {wishlist.map((item) => (
              <div key={item.id} className="p-4 flex gap-4">
                <Link 
                  to={`/loja/${storeSlug}/produto/${item.product_id}`}
                  className="flex-shrink-0"
                >
                  {item.product?.image_url ? (
                    <img 
                      src={item.product.image_url} 
                      alt={item.product?.name || 'Produto'}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground opacity-30" />
                    </div>
                  )}
                </Link>
                
                <div className="flex-1 min-w-0">
                  <Link 
                    to={`/loja/${storeSlug}/produto/${item.product_id}`}
                    className="font-medium hover:underline line-clamp-2"
                  >
                    {item.product?.name || 'Produto não disponível'}
                  </Link>
                  
                  {item.product && (
                    <div className="mt-1">
                      {item.product.promotional_price ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-through text-muted-foreground">
                            {formatCurrency(item.product.price)}
                          </span>
                          <span className="font-bold" style={{ color: buttonBgColor }}>
                            {formatCurrency(item.product.promotional_price)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold">
                          {formatCurrency(item.product.price)}
                        </span>
                      )}
                      
                      {item.product.stock <= 0 && (
                        <p className="text-sm text-red-600 mt-1">Produto indisponível</p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleRemoveFromWishlist(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  {item.product && item.product.stock > 0 && (
                    <Link to={`/loja/${storeSlug}/produto/${item.product_id}`}>
                      <Button
                        size="sm"
                        style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerWishlistSection;
