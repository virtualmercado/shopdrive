import { X, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useMiniCart } from "@/contexts/MiniCartContext";
import { useNavigate } from "react-router-dom";

interface MiniCartProps {
  storeSlug: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonBorderStyle?: string;
  primaryColor?: string;
}

const MiniCart = ({ 
  storeSlug, 
  buttonBgColor = "#6a1b9a", 
  buttonTextColor = "#FFFFFF",
  buttonBorderStyle = "rounded",
  primaryColor = "#6a1b9a"
}: MiniCartProps) => {
  const { cart, updateQuantity, removeFromCart, getTotal } = useCart();
  const { isOpen, closeMiniCart } = useMiniCart();
  const navigate = useNavigate();

  const buttonRadius = buttonBorderStyle === 'straight' ? 'rounded-none' : 'rounded-lg';

  const handleContinueShopping = () => {
    closeMiniCart();
  };

  const handleCheckout = () => {
    closeMiniCart();
    navigate(`/loja/${storeSlug}/checkout`);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeMiniCart();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex justify-end"
      onClick={handleOverlayClick}
    >
      <div className="bg-background w-full max-w-md h-full shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: primaryColor + '20' }}
        >
          <h2 className="text-lg font-semibold text-foreground">Carrinho de Compras</h2>
          <button
            onClick={closeMiniCart}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground">Seu carrinho está vazio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.id} 
                className="flex gap-3 p-3 bg-muted/30 rounded-lg border border-border"
              >
                {/* Product Image */}
                <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                  <img
                    src={item.image_url || "/placeholder.svg"}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-medium text-sm text-foreground line-clamp-2">
                    {item.name}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground">
                    Valor unitário: R$ {(item.promotional_price || item.price).toFixed(2)}
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        style={{ color: primaryColor }}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        style={{ color: primaryColor }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Item Subtotal */}
                  <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                    Subtotal: R$ {((item.promotional_price || item.price) * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-4 bg-background">
            {/* Cart Total */}
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-foreground">Subtotal:</span>
              <span className="text-xl font-bold" style={{ color: primaryColor }}>
                R$ {getTotal().toFixed(2)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={handleCheckout}
                className={`w-full ${buttonRadius} transition-all hover:opacity-90`}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                Finalizar Compra
              </Button>
              <Button
                onClick={handleContinueShopping}
                variant="outline"
                className={`w-full ${buttonRadius} transition-all`}
                style={{ 
                  borderColor: buttonBgColor, 
                  color: buttonBgColor,
                }}
              >
                Continuar Comprando
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MiniCart;
