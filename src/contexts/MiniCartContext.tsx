import { createContext, useContext, useState, ReactNode } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string;
  quantity: number;
  variations?: string;
}

interface MiniCartContextType {
  isOpen: boolean;
  openMiniCart: () => void;
  closeMiniCart: () => void;
  lastAddedItem: CartItem | null;
  setLastAddedItem: (item: CartItem | null) => void;
}

const MiniCartContext = createContext<MiniCartContextType>({
  isOpen: false,
  openMiniCart: () => {},
  closeMiniCart: () => {},
  lastAddedItem: null,
  setLastAddedItem: () => {},
});

export const useMiniCart = () => useContext(MiniCartContext);

export const MiniCartProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);

  const openMiniCart = () => setIsOpen(true);
  const closeMiniCart = () => setIsOpen(false);

  return (
    <MiniCartContext.Provider value={{ isOpen, openMiniCart, closeMiniCart, lastAddedItem, setLastAddedItem }}>
      {children}
    </MiniCartContext.Provider>
  );
};
