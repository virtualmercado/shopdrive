import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { MiniCartProvider, useMiniCart } from "@/contexts/MiniCartContext";

interface StoreLayoutProps {
  children: ReactNode;
}

// Inner component that has access to MiniCart context
const StoreLayoutInner = ({ children }: StoreLayoutProps) => {
  const { closeMiniCart, isOpen } = useMiniCart();
  const location = useLocation();

  // Close MiniCart when navigating to checkout or any route change
  useEffect(() => {
    if (isOpen) {
      closeMiniCart();
    }
  }, [location.pathname]);

  return <>{children}</>;
};

const StoreLayout = ({ children }: StoreLayoutProps) => {
  return (
    <CartProvider>
      <MiniCartProvider>
        <StoreLayoutInner>
          {children}
        </StoreLayoutInner>
      </MiniCartProvider>
    </CartProvider>
  );
};

export default StoreLayout;
