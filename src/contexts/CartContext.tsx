import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  id: string;
  // Unique key per id+variations combination (used for update/remove operations)
  cartKey: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string;
  quantity: number;
  // Selected product variations (e.g. { Aroma: "Açaí", Tamanho: "80ml" })
  variations?: Record<string, string> | null;
  // Product dimensions for shipping calculations
  weight?: number | null;
  shipping_weight?: number | null;
  height?: number | null;
  width?: number | null;
  length?: number | null;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity" | "cartKey">) => void;
  removeFromCart: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "virtualmercado_cart";

const buildCartKey = (productId: string, variations?: Record<string, string> | null): string => {
  if (!variations || Object.keys(variations).length === 0) return productId;
  // Stable, sorted serialization so {A:1,B:2} === {B:2,A:1}
  const sorted = Object.keys(variations)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = variations[k];
      return acc;
    }, {});
  return `${productId}::${JSON.stringify(sorted)}`;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as CartItem[];
          // Backfill cartKey for legacy items in storage
          return parsed.map((it) => ({
            ...it,
            cartKey: it.cartKey || buildCartKey(it.id, it.variations || null),
          }));
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: Omit<CartItem, "quantity" | "cartKey">) => {
    const cartKey = buildCartKey(item.id, item.variations || null);
    setCart((prevCart) => {
      const existingItem = prevCart.find((i) => i.cartKey === cartKey);
      if (existingItem) {
        return prevCart.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevCart, { ...item, cartKey, quantity: 1 }];
    });
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartKey !== cartKey));
  };

  const updateQuantity = (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartKey);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.cartKey === cartKey ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.promotional_price || item.price;
      return total + price * item.quantity;
    }, 0);
  };

  const getItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
