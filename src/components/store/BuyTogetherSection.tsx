import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/contexts/CartContext";
import { useMiniCart } from "@/contexts/MiniCartContext";
import { trackStoreEvent } from "@/hooks/useStoreEvents";

interface BuyTogetherProduct {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: any;
  stock: number;
  weight?: number | null;
  height?: number | null;
  width?: number | null;
  length?: number | null;
}

interface BuyTogetherSectionProps {
  storeOwnerId: string;
  storeSlug: string;
  currentProductId: string;
  categoryId: string | null;
  primaryColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonBorderStyle?: string;
  productBorderStyle?: string;
  maxItems?: number;
}

const BASE_SELECT =
  "id, name, price, promotional_price, image_url, images, stock, weight, height, width, length, category_id, popularity_score, created_at";

const BuyTogetherSection = ({
  storeOwnerId,
  storeSlug,
  currentProductId,
  categoryId,
  buttonBgColor = "#6a1b9a",
  buttonTextColor = "#FFFFFF",
  buttonBorderStyle = "rounded",
  productBorderStyle = "rounded",
  maxItems = 4,
}: BuyTogetherSectionProps) => {
  const { addToCart } = useCart();
  const { openMiniCart, setLastAddedItem } = useMiniCart();
  const [products, setProducts] = useState<BuyTogetherProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const buttonRadius = buttonBorderStyle === "straight" ? "rounded-none" : "rounded-lg";
  const cardRadius = productBorderStyle === "straight" ? "rounded-none" : "rounded-lg";

  useEffect(() => {
    let cancelled = false;

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const collected: BuyTogetherProduct[] = [];
        const seen = new Set<string>([currentProductId]);

        // Phase 1: Same category, ordered by popularity then recency
        if (categoryId) {
          const { data } = await supabase
            .from("products")
            .select(BASE_SELECT)
            .eq("user_id", storeOwnerId)
            .eq("is_active", true)
            .eq("category_id", categoryId)
            .neq("id", currentProductId)
            .gt("stock", 0)
            .order("popularity_score", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(maxItems);

          if (data) {
            for (const p of data) {
              if (!seen.has(p.id)) {
                collected.push(p as BuyTogetherProduct);
                seen.add(p.id);
              }
            }
          }
        }

        // Phase 2 (fallback): Store-wide best-sellers / newest
        if (collected.length < maxItems) {
          const remaining = maxItems - collected.length;
          const excludeIds = Array.from(seen);
          const { data } = await supabase
            .from("products")
            .select(BASE_SELECT)
            .eq("user_id", storeOwnerId)
            .eq("is_active", true)
            .gt("stock", 0)
            .not("id", "in", `(${excludeIds.map((id) => `"${id}"`).join(",")})`)
            .order("popularity_score", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(remaining);

          if (data) {
            for (const p of data) {
              if (!seen.has(p.id)) {
                collected.push(p as BuyTogetherProduct);
                seen.add(p.id);
              }
            }
          }
        }

        if (!cancelled) setProducts(collected.slice(0, maxItems));
      } catch (err) {
        if (import.meta.env.DEV) console.error("BuyTogether fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [storeOwnerId, currentProductId, categoryId, maxItems]);

  const getImage = (p: BuyTogetherProduct): string => {
    if (p.image_url) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0 && p.images[0]) return p.images[0];
    return "/placeholder.svg";
  };

  const handleAdd = (e: React.MouseEvent, p: BuyTogetherProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (p.stock <= 0) return;

    const item = {
      id: p.id,
      name: p.name,
      price: p.price,
      promotional_price: p.promotional_price,
      image_url: getImage(p),
      weight: p.weight,
      shipping_weight: (p as any).shipping_weight,
      height: p.height,
      width: p.width,
      length: p.length,
    };

    addToCart(item);
    trackStoreEvent(storeOwnerId, "add_to_cart", p.id);
    setLastAddedItem({ ...item, quantity: 1 });
    openMiniCart();
  };

  if (loading) {
    return (
      <section className="mt-10 pt-8 border-t">
        <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
          Aproveite e compre junto
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-10 pt-8 border-t">
      <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
        Aproveite e compre junto
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((p) => {
          const finalPrice = p.promotional_price || p.price;
          return (
            <div
              key={p.id}
              className={`bg-card overflow-hidden ${cardRadius} border border-border flex flex-col`}
            >
              <Link to={`/${storeSlug}/produto/${p.id}`} className="block aspect-square overflow-hidden bg-muted">
                <img
                  src={getImage(p)}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </Link>
              <div className="p-3 flex flex-col flex-1 gap-2">
                <Link to={`/${storeSlug}/produto/${p.id}`}>
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 min-h-[2.5rem] hover:underline">
                    {p.name}
                  </h3>
                </Link>
                <div className="flex flex-col">
                  {p.promotional_price ? (
                    <>
                      <span className="text-base font-bold text-foreground">
                        R$ {p.promotional_price.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        R$ {p.price.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-bold text-foreground">
                      R$ {finalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
                <Button
                  onClick={(e) => handleAdd(e, p)}
                  disabled={p.stock <= 0}
                  size="sm"
                  className={`w-full mt-auto ${buttonRadius} transition-all hover:opacity-90`}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default BuyTogetherSection;
