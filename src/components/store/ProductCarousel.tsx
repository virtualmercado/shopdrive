import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  images: any;
}

interface ProductCarouselProps {
  title: string;
  subtitle: string;
  storeOwnerId: string;
  featured?: boolean;
  newest?: boolean;
}

const ProductCarousel = ({
  title,
  subtitle,
  storeOwnerId,
  featured,
  newest,
}: ProductCarouselProps) => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("user_id", storeOwnerId)
        .gt("stock", 0)
        .limit(9);

      if (featured) {
        query = query.eq("is_featured", true);
      } else if (newest) {
        query = query.eq("is_new", true).order("created_at", { ascending: false });
      } else {
        // Se não tiver filtros, mostra todos ordenados por mais recente
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query;
      if (data) setProducts(data);
    };

    fetchProducts();
  }, [storeOwnerId, featured, newest]);

  if (products.length === 0) {
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
          {products.map((product) => (
            <CarouselItem key={product.id} className="md:basis-1/2 lg:basis-1/3">
              <div className="p-2">
                <div className="bg-card rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={
                        product.image_url ||
                        (product.images && product.images[0]) ||
                        "/placeholder.svg"
                      }
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-foreground line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {product.promotional_price ? (
                        <>
                          <span className="text-lg font-bold text-primary">
                            R$ {product.promotional_price.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            R$ {product.price.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-primary">
                          R$ {product.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
