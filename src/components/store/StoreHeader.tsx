import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, User, ShoppingCart, Menu, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface StoreHeaderProps {
  storeName: string;
  logoUrl?: string;
  primaryColor: string;
  storeOwnerId: string;
  storeSlug: string;
  cartItemCount: number;
}

interface Category {
  id: string;
  name: string;
}

const StoreHeader = ({ storeName, logoUrl, primaryColor, storeOwnerId, storeSlug, cartItemCount }: StoreHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("user_id", storeOwnerId);

      if (data) setCategories(data);
    };

    fetchCategories();
  }, [storeOwnerId]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-10 md:h-12 object-contain" />
            ) : (
              <span className="text-xl md:text-2xl font-bold" style={{ color: primaryColor }}>
                {storeName}
              </span>
            )}
          </div>

          {/* Search - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="search"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Icons - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="icon" className="hover:bg-muted">
              <User className="h-5 w-5" />
            </Button>
            <Link to={`/loja/${storeSlug}/checkout`}>
              <Button variant="ghost" size="icon" className="hover:bg-muted relative">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Search - Mobile */}
        <div className="md:hidden pb-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="search"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-6 py-3 border-t overflow-x-auto">
          <Link
            to="#"
            className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
          >
            Home
          </Link>
          <Link
            to="#"
            className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
          >
            Produtos
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              to="#"
              className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-white">
          <nav className="container mx-auto px-4 py-4 space-y-4">
            <Link
              to="#"
              className="block text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="#"
              className="block text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Produtos
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                to="#"
                className="block text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {category.name}
              </Link>
            ))}
            <div className="pt-4 border-t flex gap-4">
              <Button variant="outline" className="flex-1">
                <User className="h-4 w-4 mr-2" />
                Entrar
              </Button>
              <Link to={`/loja/${storeSlug}/checkout`} className="flex-1">
                <Button variant="outline" className="w-full relative">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Carrinho ({cartItemCount})
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default StoreHeader;
