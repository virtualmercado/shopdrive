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
  secondaryColor?: string;
  backgroundColor?: string;
  storeOwnerId: string;
  storeSlug: string;
  cartItemCount: number;
  buttonBgColor?: string;
  buttonTextColor?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  selectedCategory?: string | null;
  onCategoryChange?: (categoryId: string | null) => void;
}

interface Category {
  id: string;
  name: string;
}

const StoreHeader = ({ 
  storeName, 
  logoUrl, 
  primaryColor, 
  secondaryColor = "#FFFFFF",
  backgroundColor = "#000000",
  storeOwnerId, 
  storeSlug, 
  cartItemCount,
  buttonBgColor,
  buttonTextColor,
  searchTerm = "",
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: StoreHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Use button color or fall back to primary color for accents
  const accentColor = buttonBgColor || primaryColor || "#6a1b9a";

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

  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
  };

  const handleSearchSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(localSearchTerm);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit(e);
    }
  };

  const handleCategoryClick = (categoryId: string | null) => {
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
    setMobileMenuOpen(false);
  };

  // Custom style for search input with merchant's accent color
  const searchInputStyle = {
    '--search-focus-color': accentColor,
  } as React.CSSProperties;

  return (
    <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: secondaryColor }}>
      <style>
        {`
          .store-search-input:focus {
            border-color: var(--search-focus-color) !important;
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--search-focus-color) 20%, transparent) !important;
            outline: none !important;
          }
          .store-search-input:hover {
            border-color: var(--search-focus-color) !important;
          }
        `}
      </style>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo - Clickable to store home */}
          <Link to={`/loja/${storeSlug}`} className="flex-shrink-0">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={storeName} 
                className="h-8 md:h-12 w-auto object-contain max-w-[160px] md:max-w-[250px] cursor-pointer hover:opacity-90 transition-opacity" 
              />
            ) : (
              <span className="text-xl md:text-2xl font-bold cursor-pointer hover:opacity-90 transition-opacity" style={{ color: backgroundColor }}>
                {storeName}
              </span>
            )}
          </Link>

          {/* Search - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: backgroundColor }} />
              <Input
                type="search"
                placeholder="Buscar produtos..."
                value={localSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 w-full store-search-input"
                style={searchInputStyle}
              />
            </form>
          </div>

          {/* Icons - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <Link to={`/loja/${storeSlug}/conta`}>
              <Button variant="ghost" size="icon" className="hover:bg-gray-300 transition-colors">
                <User className="h-5 w-5" style={{ color: backgroundColor }} />
              </Button>
            </Link>
            <Link to={`/loja/${storeSlug}/checkout`}>
              <Button variant="ghost" size="icon" className="hover:bg-gray-300 transition-colors relative">
                <ShoppingCart className="h-5 w-5" style={{ color: backgroundColor }} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs rounded-full h-5 w-5 flex items-center justify-center"
                    style={{ backgroundColor: accentColor, color: buttonTextColor || '#FFFFFF' }}>
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
            {mobileMenuOpen ? <X className="h-6 w-6" style={{ color: backgroundColor }} /> : <Menu className="h-6 w-6" style={{ color: backgroundColor }} />}
          </Button>
        </div>

        {/* Search - Mobile */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: backgroundColor }} />
            <Input
              type="search"
              placeholder="Buscar produtos..."
              value={localSearchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 w-full store-search-input"
              style={searchInputStyle}
            />
          </form>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-6 py-3 border-t overflow-x-auto">
          <Link
            to={`/loja/${storeSlug}/produtos`}
            className="text-sm font-medium transition-colors whitespace-nowrap hover:opacity-70"
            style={{ 
              color: selectedCategory === null ? accentColor : backgroundColor,
              fontWeight: selectedCategory === null ? 600 : 500,
            }}
          >
            Todos
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/loja/${storeSlug}/categoria/${category.id}`}
              className="text-sm font-medium transition-colors whitespace-nowrap hover:opacity-70"
              style={{ 
                color: selectedCategory === category.id ? accentColor : backgroundColor,
                fontWeight: selectedCategory === category.id ? 600 : 500,
              }}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t" style={{ backgroundColor: secondaryColor }}>
          <nav className="container mx-auto px-4 py-4 space-y-4">
            <Link
              to={`/loja/${storeSlug}/produtos`}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium transition-colors w-full text-left hover:opacity-70"
              style={{ 
                color: selectedCategory === null ? accentColor : backgroundColor,
                fontWeight: selectedCategory === null ? 600 : 500,
              }}
            >
              Todos os Produtos
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/loja/${storeSlug}/categoria/${category.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium transition-colors w-full text-left hover:opacity-70"
                style={{ 
                  color: selectedCategory === category.id ? accentColor : backgroundColor,
                  fontWeight: selectedCategory === category.id ? 600 : 500,
                }}
              >
                {category.name}
              </Link>
            ))}
            <div className="pt-4 border-t flex gap-4">
              <Link to={`/loja/${storeSlug}/conta`} className="flex-1">
                <Button variant="outline" className="w-full hover:bg-gray-300 transition-colors">
                  <User className="h-4 w-4 mr-2" />
                  Minha Conta
                </Button>
              </Link>
              <Link to={`/loja/${storeSlug}/checkout`} className="flex-1">
                <Button variant="outline" className="w-full hover:bg-gray-300 transition-colors relative">
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
