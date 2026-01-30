import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: any;
  stock: number;
  category_id: string | null;
  description: string | null;
  variations: any;
  category_name?: string;
}

interface ProductCarouselProps {
  title: string;
  subtitle?: string;
  storeOwnerId: string;
  storeSlug?: string;
  featured?: boolean;
  newest?: boolean;
  promotional?: boolean;
  primaryColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonBorderStyle?: string;
  productImageFormat?: string;
  productBorderStyle?: string;
  productTextAlignment?: string;
  productButtonDisplay?: string;
  searchTerm?: string;
  selectedCategory?: string | null;
  selectedBrandId?: string | null;
  showAllOnSearch?: boolean;
}

// Simple text normalization: remove accents, lowercase
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .trim();
};

// Extract variations text for search
const getVariationsText = (variations: any): string => {
  if (!variations || !Array.isArray(variations)) return "";
  return variations
    .map((v: any) => {
      const name = v.name || v.group || "";
      const values = Array.isArray(v.values) ? v.values.join(" ") : 
                     Array.isArray(v.options) ? v.options.join(" ") : "";
      return `${name} ${values}`;
    })
    .join(" ");
};

// Simple substring matching - more reliable than fuzzy matching
const matchesSearch = (product: Product, searchTerm: string): boolean => {
  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch) return true;

  // Build searchable text from all product fields
  const searchableFields = [
    product.name || "",
    product.description || "",
    product.category_name || "",
    getVariationsText(product.variations),
  ];

  const combinedText = normalizeText(searchableFields.join(" "));
  
  // Split search term into words and check if ALL words are found
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);
  
  // For single word search, check if it's contained anywhere
  if (searchWords.length === 1) {
    return combinedText.includes(searchWords[0]);
  }
  
  // For multi-word search, all words must be found
  return searchWords.every(word => combinedText.includes(word));
};

const ProductCarousel = ({
  title,
  subtitle,
  storeOwnerId,
  storeSlug,
  featured,
  newest,
  promotional,
  primaryColor = "#6a1b9a",
  buttonBgColor = "#6a1b9a",
  buttonTextColor = "#FFFFFF",
  buttonBorderStyle = "rounded",
  productImageFormat = "square",
  productBorderStyle = "rounded",
  productTextAlignment = "left",
  productButtonDisplay = "below",
  searchTerm = "",
  selectedCategory = null,
  selectedBrandId = null,
  showAllOnSearch = false,
}: ProductCarouselProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  // Determine if autoplay should be enabled
  // Featured and Promotional: NO autoplay
  // All Products (newest or default): YES autoplay
  const shouldAutoplay = !featured && !promotional;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      
      let query = supabase
        .from("products")
        .select("*, product_categories(name)")
        .eq("user_id", storeOwnerId)
        .gt("stock", 0);

      // When showAllOnSearch is true, fetch ALL products without filters
      if (showAllOnSearch) {
        query = query.order("created_at", { ascending: false });
      } else if (selectedBrandId) {
        // Filter by brand
        query = query.eq("brand_id", selectedBrandId).order("created_at", { ascending: false });
      } else if (promotional) {
        // Filter only products with promotional price
        query = query.gt("promotional_price", 0).order("created_at", { ascending: false });
      } else {
        // Apply featured/newest filters
        if (featured) {
          query = query.eq("is_featured", true);
        } else if (newest) {
          query = query.eq("is_new", true).order("created_at", { ascending: false });
        } else {
          query = query.order("created_at", { ascending: false });
        }
      }

      const { data, error } = await query;
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching products:", error);
        }
        setLoading(false);
        return;
      }

      if (data) {
        const productsWithCategory = data.map((p: any) => ({
          ...p,
          category_name: p.product_categories?.name || null,
        }));
        setProducts(productsWithCategory);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [storeOwnerId, featured, newest, promotional, selectedBrandId, showAllOnSearch]);

  // Filter products based on search term and category
  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    // Filter by category
    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }
    
    // Filter by search term using simple substring matching
    if (searchTerm && searchTerm.trim()) {
      result = result.filter(product => matchesSearch(product, searchTerm));
    }
    
    // Limit results
    return result.slice(0, showAllOnSearch ? 50 : 12);
  }, [products, searchTerm, selectedCategory, showAllOnSearch]);

  // Track carousel state for dots
  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Handle dot click
  const scrollTo = useCallback((index: number) => {
    api?.scrollTo(index);
  }, [api]);

  // Show "no results" message when searching
  if (showAllOnSearch && !loading && filteredProducts.length === 0) {
    return (
      <section className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            Nenhum produto encontrado para "{searchTerm}"
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Tente buscar por outro termo
          </p>
        </div>
      </section>
    );
  }

  if (filteredProducts.length === 0) {
    return null;
  }

  // Calculate number of dots based on items per view
  // Desktop: 4 items, Tablet: 2 items, Mobile: 1 item
  // For simplicity, we use the carousel's scroll snap count

  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
      </div>

      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: filteredProducts.length > 3,
        }}
        plugins={shouldAutoplay ? [
          Autoplay({
            delay: 5000,
            stopOnInteraction: false,
            stopOnMouseEnter: true,
            playOnInit: true,
          }),
        ] : []}
        className="w-full"
      >
        <CarouselContent>
          {filteredProducts.map((product) => (
            <CarouselItem key={product.id} className="md:basis-1/2 lg:basis-1/4">
              <div className="p-2">
                <ProductCard 
                  product={product} 
                  storeSlug={storeSlug}
                  primaryColor={primaryColor}
                  buttonBgColor={buttonBgColor}
                  buttonTextColor={buttonTextColor}
                  buttonBorderStyle={buttonBorderStyle}
                  productImageFormat={productImageFormat}
                  productBorderStyle={productBorderStyle}
                  productTextAlignment={productTextAlignment}
                  productButtonDisplay={productButtonDisplay}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>

      {/* Navigation Dots */}
      {count > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {Array.from({ length: count }).map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === current
                  ? "w-6"
                  : "w-2.5 hover:opacity-70"
              }`}
              style={{
                backgroundColor: index === current 
                  ? primaryColor 
                  : "hsl(var(--muted-foreground) / 0.3)",
              }}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductCarousel;
