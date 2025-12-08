import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useMiniCart } from "@/contexts/MiniCartContext";
import { Link } from "react-router-dom";

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
  storeSlug?: string;
  primaryColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonBorderStyle?: string;
  productImageFormat?: string;
  productBorderStyle?: string;
  productTextAlignment?: string;
  productButtonDisplay?: string;
}

const ProductCard = ({ 
  product, 
  storeSlug,
  primaryColor = "#6a1b9a",
  buttonBgColor = "#6a1b9a",
  buttonTextColor = "#FFFFFF",
  buttonBorderStyle = "rounded",
  productImageFormat = "square",
  productBorderStyle = "rounded",
  productTextAlignment = "left",
  productButtonDisplay = "below"
}: ProductCardProps) => {
  const { addToCart } = useCart();
  const { openMiniCart, setLastAddedItem } = useMiniCart();
  const [isHovered, setIsHovered] = useState(false);
  
  const aspectRatio = productImageFormat === 'rectangular' ? 'aspect-[3/4]' : 'aspect-square';
  const borderRadius = productBorderStyle === 'straight' ? 'rounded-none' : 'rounded-lg';
  const textAlign = productTextAlignment === 'center' ? 'text-center' : 'text-left';
  const buttonRadius = buttonBorderStyle === 'straight' ? 'rounded-none' : 'rounded-lg';

  // Get images array
  const getProductImages = (): string[] => {
    const images: string[] = [];
    
    // Add main image_url first if exists
    if (product.image_url) {
      images.push(product.image_url);
    }
    
    // Add images from images array
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: string) => {
        if (img && !images.includes(img)) {
          images.push(img);
        }
      });
    }
    
    return images.length > 0 ? images : ["/placeholder.svg"];
  };

  const productImages = getProductImages();
  const primaryImage = productImages[0];
  const secondaryImage = productImages.length > 1 ? productImages[1] : primaryImage;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (product.stock <= 0) {
      return;
    }

    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      promotional_price: product.promotional_price,
      image_url: primaryImage,
    };

    addToCart(cartItem);
    setLastAddedItem({
      ...cartItem,
      quantity: 1,
    });
    openMiniCart();
  };

  const finalPrice = product.promotional_price || product.price;

  const productLink = storeSlug ? `/loja/${storeSlug}/produto/${product.id}` : '#';

  return (
    <div className={`bg-card overflow-hidden shadow-md hover:shadow-lg transition-shadow ${borderRadius}`}>
      <Link 
        to={productLink} 
        className={`block ${aspectRatio} overflow-hidden bg-muted relative group`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Primary Image */}
        <img
          src={primaryImage}
          alt={product.name}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110 ${
            isHovered && secondaryImage !== primaryImage ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {/* Secondary Image (shown on hover) */}
        {secondaryImage !== primaryImage && (
          <img
            src={secondaryImage}
            alt={`${product.name} - alternate view`}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </Link>
      <div className={`p-4 space-y-3 ${textAlign}`}>
        <Link to={productLink}>
          <h3 className="font-semibold text-foreground line-clamp-2 min-h-[3rem] hover:underline">
            {product.name}
          </h3>
        </Link>
        <div className={`flex items-center gap-2 ${productTextAlignment === 'center' ? 'justify-center' : ''}`}>
          {product.promotional_price ? (
            <>
              <span className="text-lg font-bold" style={{ color: '#000000' }}>
                R$ {product.promotional_price.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground line-through">
                R$ {product.price.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold" style={{ color: '#000000' }}>
              R$ {product.price.toFixed(2)}
            </span>
          )}
        </div>
        {productButtonDisplay === 'below' && (
          <Button
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            className={`w-full ${buttonRadius} transition-all hover:opacity-90`}
            size="sm"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {product.stock <= 0 ? "Sem estoque" : "Adicionar"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;