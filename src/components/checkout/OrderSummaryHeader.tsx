import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Tag, X } from "lucide-react";
import { CartItem } from "@/contexts/CartContext";

interface OrderSummaryHeaderProps {
  cart: CartItem[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  couponCode: string;
  setCouponCode: (code: string) => void;
  appliedCoupon: { isValid: boolean; discount: number } | null;
  couponLoading: boolean;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  subtotal: number;
  couponDiscount: number;
  pixDiscountAmount: number;
  pixDiscountPercent: number;
  deliveryFee: number;
  total: number;
  primaryColor: string;
  deliveryDefined: boolean;
}

export const OrderSummaryHeader = ({
  cart,
  updateQuantity,
  removeFromCart,
  couponCode,
  setCouponCode,
  appliedCoupon,
  couponLoading,
  onApplyCoupon,
  onRemoveCoupon,
  subtotal,
  couponDiscount,
  pixDiscountAmount,
  pixDiscountPercent,
  deliveryFee,
  total,
  primaryColor,
  deliveryDefined,
}: OrderSummaryHeaderProps) => {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm mb-6">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          📦 Resumo do Pedido
        </h2>

        {/* Products List */}
        <div className="space-y-4 mb-6">
          {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 py-3 border-b border-border last:border-0"
            >
              <img
                src={item.image_url}
                alt={item.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  R$ {(item.promotional_price || item.price).toFixed(2)} / unidade
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (item.quantity > 1) {
                      updateQuantity(item.id, item.quantity - 1);
                    }
                  }}
                  disabled={item.quantity <= 1}
                  style={{ borderColor: primaryColor }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  style={{ borderColor: primaryColor }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Item Total */}
              <div className="text-right min-w-[80px]">
                <p className="font-semibold">
                  R$ {((item.promotional_price || item.price) * item.quantity).toFixed(2)}
                </p>
              </div>

              {/* Remove Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => removeFromCart(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Coupon and Totals Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
          {/* Coupon Section */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Código do cupom
            </p>
            {appliedCoupon?.isValid ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700">{couponCode}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-700 hover:text-green-900 hover:bg-green-100"
                  onClick={onRemoveCoupon}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 font-mono uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  style={{ 
                    borderColor: primaryColor, 
                    color: primaryColor 
                  }}
                >
                  {couponLoading ? "..." : "Aplicar"}
                </Button>
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto (cupom)</span>
                <span>-R$ {couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {pixDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto PIX ({pixDiscountPercent}%)</span>
                <span>-R$ {pixDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Frete</span>
              <span className={deliveryFee === 0 ? "text-green-600 font-medium" : ""}>
                {!deliveryDefined ? (
                  <span className="text-muted-foreground text-xs">Definido na entrega</span>
                ) : deliveryFee === 0 ? (
                  "Grátis"
                ) : (
                  `R$ ${deliveryFee.toFixed(2)}`
                )}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-lg font-bold">Total</span>
              <span 
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
