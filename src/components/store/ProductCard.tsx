import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    promotional_price: number | null;
    image_url: string | null;
    images: any;
    stock: number;
  };
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error("Produto sem estoque");
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      promotional_price: product.promotional_price,
      image_url: product.image_url || (product.images && product.images[0]) || "/placeholder.svg",
    });

    toast.success("Produto adicionado ao carrinho!");
  };

  const finalPrice = product.promotional_price || product.price;

  return (
    <div className="bg-card rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      <div className="aspect-square overflow-hidden bg-muted">
        <img
          src={product.image_url || (product.images && product.images[0]) || "/placeholder.svg"}
          alt={product.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform"
        />
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground line-clamp-2 min-h-[3rem]">
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
        <Button
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
          className="w-full"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {product.stock <= 0 ? "Sem estoque" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
