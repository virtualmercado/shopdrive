import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tag } from "lucide-react";

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
      // First, get all brands for this store owner
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

      // Get product counts for each brand
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

  // Don't render if no brands with products
  if (loading || brands.length === 0) {
    return null;
  }

  return (
    <section className="py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 
            className="text-lg sm:text-xl font-bold"
            style={{ color: primaryColor }}
          >
            Escolha por Marca
          </h2>
          {selectedBrandId && (
            <button
              onClick={() => onBrandSelect(null)}
              className="text-sm hover:underline"
              style={{ color: primaryColor }}
            >
              Ver todas
            </button>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {brands.map((brand) => {
            const isSelected = selectedBrandId === brand.id;
            
            return (
              <button
                key={brand.id}
                onClick={() => onBrandSelect(isSelected ? null : brand.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 min-w-[100px] ${
                  isSelected ? "shadow-md" : "hover:shadow-sm"
                }`}
                style={{
                  borderColor: isSelected ? buttonBgColor : "transparent",
                  backgroundColor: isSelected ? `${buttonBgColor}10` : "hsl(var(--card))",
                }}
              >
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="h-12 w-12 object-contain rounded"
                  />
                ) : (
                  <div 
                    className="h-12 w-12 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${buttonBgColor}20` }}
                  >
                    <Tag 
                      className="h-6 w-6" 
                      style={{ color: buttonBgColor }}
                    />
                  </div>
                )}
                <span 
                  className="text-xs font-medium text-center line-clamp-2"
                  style={{ color: isSelected ? buttonBgColor : undefined }}
                >
                  {brand.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {brand.product_count} produto{brand.product_count !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
