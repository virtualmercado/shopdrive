import { useState, useEffect } from "react";
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
  selectedBrandId: string | null;
  onBrandSelect: (brandId: string | null) => void;
  primaryColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
}

export const BrandSection = ({
  storeOwnerId,
  selectedBrandId,
  onBrandSelect,
  primaryColor = "#6a1b9a",
  buttonBgColor = "#6a1b9a",
  buttonTextColor = "#FFFFFF",
}: BrandSectionProps) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

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
            {brands.map((brand) => {
              const isSelected = selectedBrandId === brand.id;
              
              return (
                <button
                  key={brand.id}
                  onClick={() => onBrandSelect(isSelected ? null : brand.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 ${
                    isSelected ? "ring-2" : "hover:opacity-80"
                  }`}
                  style={{
                    outlineColor: isSelected ? buttonBgColor : "transparent",
                    outlineWidth: isSelected ? "2px" : "0",
                    outlineStyle: isSelected ? "solid" : "none",
                  }}
                >
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="h-14 w-auto object-contain"
                    />
                  ) : (
                    <div 
                      className="h-14 w-14 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${buttonBgColor}20` }}
                    >
                      <Tag 
                        className="h-6 w-6" 
                        style={{ color: buttonBgColor }}
                      />
                    </div>
                  )}
                  <span 
                    className="text-[10px] text-center line-clamp-1"
                    style={{ color: isSelected ? buttonBgColor : "#666060" }}
                  >
                    {brand.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Clear filter button */}
          {selectedBrandId && (
            <button
              onClick={() => onBrandSelect(null)}
              className="text-xs hover:underline flex-shrink-0"
              style={{ color: primaryColor }}
            >
              Ver todas
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
