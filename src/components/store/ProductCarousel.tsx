import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
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
}

interface ProductCarouselProps {
  title: string;
  subtitle: string;
  storeOwnerId: string;
  storeSlug?: string;
  featured?: boolean;
  newest?: boolean;
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
}

// Normalize text: remove accents, convert to lowercase
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, ""); // Remove punctuation
};

// Calculate similarity score (simple fuzzy matching)
const calculateSimilarity = (text: string, search: string): number => {
  const normalizedText = normalizeText(text);
  const normalizedSearch = normalizeText(search);
  
  // Exact match
  if (normalizedText.includes(normalizedSearch)) {
    return 1;
  }
  
  // Check if all words in search are present in text
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);
  const textWords = normalizedText.split(/\s+/).filter(w => w.length > 0);
  
  let matchedWords = 0;
  for (const searchWord of searchWords) {
    for (const textWord of textWords) {
      if (textWord.includes(searchWord) || searchWord.includes(textWord)) {
        matchedWords++;
        break;
      }
    }
  }
  
  if (searchWords.length > 0 && matchedWords === searchWords.length) {
    return 0.9;
  }
  
  // Partial word matching with tolerance for typos
  for (const searchWord of searchWords) {
    if (searchWord.length < 3) continue;
    for (const textWord of textWords) {
      // Check if first 3 chars match (handles typos at end)
      if (textWord.startsWith(searchWord.substring(0, 3))) {
        return 0.7;
      }
      // Check if last 3 chars match (handles typos at start)
      if (searchWord.length >= 3 && textWord.endsWith(searchWord.substring(searchWord.length - 3))) {
        return 0.6;
      }
    }
  }
  
  return 0;
};

const ProductCarousel = ({
  title,
  subtitle,
  storeOwnerId,
  storeSlug,
  featured,
  newest,
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
}: ProductCarouselProps) => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("user_id", storeOwnerId)
        .gt("stock", 0);

      if (featured) {
        query = query.eq("is_featured", true);
      } else if (newest) {
        query = query.eq("is_new", true).order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query;
      if (data) setProducts(data);
    };

    fetchProducts();
  }, [storeOwnerId, featured, newest]);

  // Filter products based on search term and category
  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    // Filter by category
    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }
    
    // Filter and sort by search term
    if (searchTerm.trim()) {
      const searchResults = result
        .map(product => {
          const nameSimilarity = calculateSimilarity(product.name, searchTerm);
          const descSimilarity = product.description 
            ? calculateSimilarity(product.description, searchTerm) * 0.5 
            : 0;
          return {
            product,
            score: Math.max(nameSimilarity, descSimilarity),
          };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);
      
      result = searchResults;
    }
    
    return result.slice(0, 9);
  }, [products, searchTerm, selectedCategory]);

  if (filteredProducts.length === 0) {
    // Only show "no results" message for the main carousel if searching/filtering
    if ((searchTerm || selectedCategory) && !featured && !newest) {
      return (
        <section className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
            <p className="text-muted-foreground mt-2">{subtitle}</p>
          </div>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: 4000,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent>
          {filteredProducts.map((product) => (
            <CarouselItem key={product.id} className="md:basis-1/2 lg:basis-1/3">
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
    </section>
  );
};

export default ProductCarousel;
