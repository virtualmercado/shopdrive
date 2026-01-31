import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CatalogProductListProps {
  storeOwnerId: string;
  storeSlug: string | undefined;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonBorderStyle: string;
  productImageFormat: string;
  productBorderStyle: string;
  productTextAlignment: string;
  productButtonDisplay: string;
  selectedCategory: string | null;
  searchTerm?: string;
  primaryColor?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  images: string[] | null;
  image_url: string | null;
  stock: number;
  weight?: number | null;
  height?: number | null;
  width?: number | null;
  length?: number | null;
}

const PRODUCTS_PER_PAGE = 20;

export const CatalogProductList = ({
  storeOwnerId,
  storeSlug,
  buttonBgColor,
  buttonTextColor,
  buttonBorderStyle,
  productImageFormat,
  productBorderStyle,
  productTextAlignment,
  productButtonDisplay,
  selectedCategory,
  searchTerm,
  primaryColor,
}: CatalogProductListProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);

  const fetchProducts = useCallback(async () => {
    if (!storeSlug) return;

    setLoading(true);
    try {
      const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
      const to = from + PRODUCTS_PER_PAGE - 1;

      // Cast to any to avoid TypeScript deep instantiation error
      const client = supabase as any;
      const response = await client
        .from("public_store_products")
        .select("*", { count: "exact" })
        .eq("store_slug", storeSlug)
        .order("created_at", { ascending: false })
        .range(from, to);

      const data = response.data as any[] | null;
      const count = response.count as number | null;

      const productsData: Product[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        promotional_price: item.promotional_price,
        images: item.images,
        image_url: item.image_url,
        stock: item.stock ?? 999,
        weight: item.weight,
        height: item.height,
        width: item.width,
        length: item.length,
      }));

      setProducts(productsData);
      setTotalProducts(count || 0);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [storeSlug, currentPage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 aspect-square rounded-lg mb-2" />
              <div className="h-4 bg-gray-200 rounded mb-1" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {searchTerm
            ? `Nenhum produto encontrado para "${searchTerm}"`
            : selectedCategory
            ? "Nenhum produto nesta categoria"
            : "Nenhum produto disponível no momento"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
              promotional_price: product.promotional_price,
              image_url: product.image_url,
              images: product.images,
              stock: product.stock ?? 999,
              weight: product.weight,
              height: product.height,
              width: product.width,
              length: product.length,
            }}
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
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 2) return true;
                return false;
              })
              .map((page, index, array) => {
                const prevPage = array[index - 1];
                const showEllipsis = prevPage && page - prevPage > 1;

                return (
                  <div key={page} className="flex items-center gap-1">
                    {showEllipsis && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="min-w-[36px]"
                      style={
                        currentPage === page
                          ? {
                              backgroundColor: buttonBgColor,
                              color: buttonTextColor,
                            }
                          : undefined
                      }
                    >
                      {page}
                    </Button>
                  </div>
                );
              })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CatalogProductList;
