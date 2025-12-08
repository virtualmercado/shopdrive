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
  variations: any;
  category_name?: string;
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

// Normalize text: remove accents, convert to lowercase, handle plurals
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();
};

// Levenshtein distance for typo tolerance
const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Extract variations text for search
const getVariationsText = (variations: any): string => {
  if (!variations || !Array.isArray(variations)) return "";
  return variations
    .map((v: any) => {
      const name = v.name || v.group || "";
      const values = (v.values || v.options || []).join(" ");
      return `${name} ${values}`;
    })
    .join(" ");
};

// Calculate similarity score (fuzzy matching with typo tolerance)
const calculateSimilarity = (product: Product, search: string): number => {
  const normalizedSearch = normalizeText(search);
  if (!normalizedSearch) return 0;

  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);
  if (searchWords.length === 0) return 0;
  
  // Build searchable text from product fields
  const searchableTexts = [
    product.name || "",
    product.description || "",
    product.category_name || "",
    getVariationsText(product.variations),
  ].filter(Boolean);
  
  const combinedText = normalizeText(searchableTexts.join(" "));
  const textWords = combinedText.split(/\s+/).filter(w => w.length > 0);
  
  let totalScore = 0;
  let matchedWords = 0;
  
  for (const searchWord of searchWords) {
    let bestWordScore = 0;
    
    // Check if search word is contained in combined text directly
    if (combinedText.includes(searchWord)) {
      bestWordScore = 1;
    } else {
      // Check word by word
      for (const textWord of textWords) {
        // Exact match or contains
        if (textWord.includes(searchWord) || searchWord.includes(textWord)) {
          bestWordScore = Math.max(bestWordScore, 1);
          break;
        }
        
        // Prefix matching (for partial typing)
        if (searchWord.length >= 2 && textWord.startsWith(searchWord.substring(0, Math.min(3, searchWord.length)))) {
          bestWordScore = Math.max(bestWordScore, 0.8);
        }
        
        // Typo tolerance using Levenshtein distance
        if (searchWord.length >= 3 && textWord.length >= 3) {
          const distance = levenshteinDistance(searchWord, textWord);
          const maxLen = Math.max(searchWord.length, textWord.length);
          const similarity = 1 - (distance / maxLen);
          
          // Accept if similarity is above threshold (allows ~2 typos in longer words)
          if (similarity >= 0.5) {
            bestWordScore = Math.max(bestWordScore, similarity * 0.7);
          }
        }
      }
    }
    
    if (bestWordScore > 0) {
      matchedWords++;
      totalScore += bestWordScore;
    }
  }
  
  // Return score even if not all words matched (partial matching)
  // Give bonus for matching more words
  const matchRatio = matchedWords / searchWords.length;
  if (matchRatio === 0) return 0;
  
  // Allow partial matches but rank them lower
  return (totalScore / searchWords.length) * (0.5 + matchRatio * 0.5);
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
      // When searching, fetch ALL products (not filtered by featured/newest)
      // to ensure complete search results
      const isSearching = searchTerm && searchTerm.trim().length > 0;
      
      let query = supabase
        .from("products")
        .select("*, product_categories(name)")
        .eq("user_id", storeOwnerId)
        .gt("stock", 0);

      if (!isSearching) {
        // Only apply featured/newest filters when NOT searching
        if (featured) {
          query = query.eq("is_featured", true);
        } else if (newest) {
          query = query.eq("is_new", true).order("created_at", { ascending: false });
        } else {
          query = query.order("created_at", { ascending: false });
        }
      } else {
        // When searching, fetch all products ordered by created_at
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query;
      if (data) {
        const productsWithCategory = data.map((p: any) => ({
          ...p,
          category_name: p.product_categories?.name || null,
        }));
        setProducts(productsWithCategory);
      }
    };

    fetchProducts();
  }, [storeOwnerId, featured, newest, searchTerm]);

  // Filter products based on search term and category
  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    // Filter by category
    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }
    
    // Filter and sort by search term (fuzzy search)
    if (searchTerm && searchTerm.trim()) {
      const searchResults = result
        .map(product => ({
          product,
          score: calculateSimilarity(product, searchTerm),
        }))
        .filter(item => item.score > 0.2) // Lower threshold for more results
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);
      
      result = searchResults;
    }
    
    return result.slice(0, 12);
  }, [products, searchTerm, selectedCategory]);

  if (filteredProducts.length === 0) {
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