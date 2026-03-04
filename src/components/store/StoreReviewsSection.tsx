import { useState, useEffect } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Review {
  id: string;
  customer_name: string;
  customer_city: string;
  comment: string;
  stars: number;
  product_id: string | null;
  is_verified: boolean;
  product?: { name: string; images: any } | null;
}

interface StoreReviewsSectionProps {
  storeOwnerId: string;
  storeSlug: string;
  primaryColor: string;
  sectionTitle?: string;
}

const StoreReviewsSection = ({ storeOwnerId, storeSlug, primaryColor, sectionTitle }: StoreReviewsSectionProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [title, setTitle] = useState(sectionTitle || "Avaliações dos nossos clientes");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchReviews = async () => {
      const [reviewsRes, profileRes] = await Promise.all([
        supabase
          .from("store_reviews")
          .select("*, products(name, images)")
          .eq("store_owner_id", storeOwnerId)
          .order("display_order"),
        supabase
          .from("profiles")
          .select("reviews_section_title")
          .eq("id", storeOwnerId)
          .single(),
      ]);

      if (reviewsRes.data) {
        const mapped = reviewsRes.data.map((r: any) => ({
          ...r,
          product: r.products || null,
        }));
        setReviews(mapped);
      }
      if (profileRes.data && (profileRes.data as any).reviews_section_title) {
        setTitle((profileRes.data as any).reviews_section_title);
      }
    };

    fetchReviews();
  }, [storeOwnerId]);

  // Only show when exactly 4 complete reviews exist
  const completeReviews = reviews.filter(r => r.customer_name && r.comment);
  if (completeReviews.length < 4) return null;

  const displayReviews = completeReviews.slice(0, 4);

  const getProductImage = (review: Review) => {
    if (!review.product?.images) return null;
    const images = Array.isArray(review.product.images) ? review.product.images : [];
    return images[0] || null;
  };

  return (
    <section className="py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayReviews.map((review) => (
          <div
            key={review.id}
            className="bg-card border rounded-xl p-5 flex flex-col gap-3"
            style={{
              boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
              transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            }}
            onMouseEnter={(e) => { if (window.innerWidth >= 768) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.15)'; }}}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; }}
          >
            {/* Stars */}
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${s <= review.stars ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`}
                />
              ))}
            </div>

            {/* Comment */}
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">
              "{review.comment}"
            </p>

            {/* Product thumbnail */}
            {review.product_id && getProductImage(review) && (
              <div
                className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => navigate(`/loja/${storeSlug}/produto/${review.product_id}`)}
              >
                <img
                  src={getProductImage(review)!}
                  alt={review.product?.name || ""}
                  className="w-10 h-10 object-cover rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{review.product?.name}</p>
                  <p className="text-xs" style={{ color: primaryColor }}>ver produto</p>
                </div>
              </div>
            )}

            {/* Customer info */}
            <div className="border-t pt-3">
              <p className="text-sm font-semibold text-foreground">{review.customer_name}</p>
              <p className="text-xs text-muted-foreground">{review.customer_city}</p>
              {review.is_verified && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">Cliente verificado</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StoreReviewsSection;
