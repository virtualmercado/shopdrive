import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tag, CheckCircle2 } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  product_count: number;
}

interface BrandSectionProps {
  storeOwnerId: string;
  storeSlug: string;
  primaryColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
}

export const BrandSection = ({
  storeOwnerId,
  storeSlug,
  primaryColor = "#6a1b9a",
  buttonBgColor = "#6a1b9a",
}: BrandSectionProps) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBrandsWithProducts();
  }, [storeOwnerId]);

  const fetchBrandsWithProducts = async () => {
    try {
      const { data: brandsData, error: brandsError } = await supabase
        .from("product_brands")
        .select("id, name, logo_url")
        .eq("user_id", storeOwnerId)
        .eq("is_active", true);

      if (brandsError) throw brandsError;

      if (!brandsData || brandsData.length === 0) {
        setBrands([]);
        setLoading(false);
        return;
      }

      const brandsWithCounts: Brand[] = [];
      
      for (const brand of brandsData) {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("user_id", storeOwnerId)
          .eq("brand_id", brand.id);

        if (count && count > 0) {
          brandsWithCounts.push({
            ...brand,
            product_count: count,
          });
        }
      }

      setBrands(brandsWithCounts);
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandClick = (brandId: string) => {
    navigate(`/loja/${storeSlug}/marca/${brandId}`);
  };

  if (loading || brands.length === 0) {
    return null;
  }

  return (
    <section className="py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          {/* Title on the left with icon */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 
              className="h-6 w-6 flex-shrink-0" 
              style={{ color: primaryColor }}
            />
            <h2 
              className="text-sm sm:text-base font-bold uppercase leading-tight"
              style={{ color: primaryColor }}
            >
              ESCOLHA<br />
              <span className="font-normal">POR MARCA</span>
            </h2>
          </div>

          {/* Brands inline, same row */}
          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide flex-1">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => handleBrandClick(brand.id)}
                className="flex-shrink-0 p-2 rounded-lg transition-opacity duration-200 hover:opacity-70"
              >
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="h-16 w-auto object-contain"
                  />
                ) : (
                  <div 
                    className="h-16 w-16 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${buttonBgColor}20` }}
                  >
                    <Tag 
                      className="h-7 w-7" 
                      style={{ color: buttonBgColor }}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
