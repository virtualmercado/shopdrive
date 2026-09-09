import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useParams } from "react-router-dom";

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
  /** Tenant this cart belongs to (store slug). */
  cartStoreKey: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * MULTITENANCY: the cart is persisted per store.
 *
 * All public storefronts live under the same origin (shopdrive.com.br/<slug>),
 * so localStorage is shared across stores. A single global key therefore leaked
 * cart contents between tenants. Each store now owns its own namespaced entry:
 *   shopdrive-cart-v2:<storeSlug>
 * and the persisted payload also records the storeKey so a mismatched payload is
 * never trusted.
 */
const CART_KEY_PREFIX = "shopdrive-cart-v2:";
const LEGACY_CART_KEY = "virtualmercado_cart";

interface PersistedCart {
  version: 2;
  storeKey: string;
  items: CartItem[];
}

const storageKeyFor = (storeKey: string) => `${CART_KEY_PREFIX}${storeKey}`;

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

const sanitizeItems = (items: unknown): CartItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((it): it is CartItem => !!it && typeof (it as CartItem).id === "string")
    .map((it) => ({
      ...it,
      cartKey: it.cartKey || buildCartKey(it.id, it.variations || null),
    }));
};

/**
 * Loads the cart for a single store. Legacy global state (pre-tenant format) is
 * considered untrusted: its origin store is unknown, so it is discarded instead
 * of being handed to whichever store happens to open first.
 */
const loadCart = (storeKey: string): CartItem[] => {
  if (typeof window === "undefined" || !storeKey) return [];
  try {
    localStorage.removeItem(LEGACY_CART_KEY);
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(storageKeyFor(storeKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedCart;
    if (!parsed || parsed.storeKey !== storeKey) return [];
    return sanitizeItems(parsed.items);
  } catch {
    return [];
  }
};

export const CartProvider = ({
  children,
  storeKey: storeKeyProp,
}: {
  children: ReactNode;
  storeKey?: string;
}) => {
  const params = useParams<{ storeSlug?: string }>();
  const storeKey = useMemo(() => {
    const fromProp = storeKeyProp?.trim();
    if (fromProp) return fromProp;
    const fromRoute = params.storeSlug?.trim();
    if (fromRoute) return fromRoute;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("vm_active_store_slug")?.trim() || "";
    }
    return "";
  }, [storeKeyProp, params.storeSlug]);

  const [cart, setCart] = useState<CartItem[]>(() => loadCart(storeKey));
  const [hydratedFor, setHydratedFor] = useState<string>(storeKey);

  // Reacts to tenant changes (SPA navigation between stores): drop the previous
  // store's state and load the cart that belongs to the new store.
  useEffect(() => {
    if (storeKey === hydratedFor) return;
    setCart(loadCart(storeKey));
    setHydratedFor(storeKey);
  }, [storeKey, hydratedFor]);

  useEffect(() => {
    if (!storeKey || storeKey !== hydratedFor) return;
    const payload: PersistedCart = { version: 2, storeKey, items: cart };
    try {
      localStorage.setItem(storageKeyFor(storeKey), JSON.stringify(payload));
    } catch {
      /* ignore quota errors */
    }
  }, [cart, storeKey, hydratedFor]);

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

  // While the tenant is being resolved / switched, expose a neutral empty cart so
  // no other store's items can flash in the header or drawer.
  const visibleCart = storeKey && storeKey === hydratedFor ? cart : [];

  return (
    <CartContext.Provider
      value={{
        cart: visibleCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotal: () =>
          visibleCart.reduce(
            (total, item) => total + (item.promotional_price || item.price) * item.quantity,
            0
          ),
        getItemCount: () => visibleCart.reduce((count, item) => count + item.quantity, 0),
        cartStoreKey: storeKey,
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
