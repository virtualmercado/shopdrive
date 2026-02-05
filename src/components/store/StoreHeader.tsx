import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  logoPosition?: "left" | "center" | "right";
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
  logoPosition = "left",
}: StoreHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchDebounceRef = useRef<number | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  // Use button color or fall back to primary color for accents
  const accentColor = buttonBgColor || primaryColor || "#6a1b9a";

  // Keep current store context for /buscar route
  useEffect(() => {
    if (storeSlug) {
      sessionStorage.setItem("vm_active_store_slug", storeSlug);
    }
  }, [storeSlug]);

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

  const executeSearch = (term: string, options?: { replace?: boolean }) => {
    const q = term.trim();
    if (!q) return;

    if (storeSlug) {
      sessionStorage.setItem("vm_active_store_slug", storeSlug);
    }

    navigate(`/buscar?q=${encodeURIComponent(q)}`, {
      replace: options?.replace ?? false,
      state: { storeSlug },
    });
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);

    // Keep compatibility with pages that do local filtering while typing
    if (onSearchChange) {
      onSearchChange(value);
    }

    // Live update only on /buscar (update query param with replace)
    if (location.pathname === "/buscar") {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = window.setTimeout(() => {
        if (value.trim()) {
          executeSearch(value, { replace: true });
        }
      }, 250);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    executeSearch(localSearchTerm);
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
          /* Mobile touch optimization */
          .store-search-input {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            cursor: text;
            /* Ensure input is always interactive */
            pointer-events: auto !important;
            user-select: text !important;
            -webkit-user-select: text !important;
          }
          .mobile-search-container {
            position: relative;
            z-index: 30;
            isolation: isolate;
          }
          .mobile-search-container input {
            position: relative;
            z-index: 10;
          }
          /* Ensure search icon doesn't block touches */
          .mobile-search-icon {
            pointer-events: none !important;
            z-index: 20;
          }
          .mobile-search-container button {
            z-index: 20;
          }
          /* Ensure desktop header is hidden on mobile */
          @media (max-width: 767px) {
            .desktop-header-grid {
              display: none !important;
              visibility: hidden !important;
              pointer-events: none !important;
              height: 0 !important;
              overflow: hidden !important;
            }
          }
          @media (min-width: 768px) {
            .desktop-header-grid {
              display: grid !important;
            }
          }
          .header-grid-left {
            grid-template-columns: auto 1fr auto;
            grid-template-areas: "logo search actions";
          }
          .header-grid-center {
            grid-template-columns: 1fr auto 1fr;
            grid-template-areas: "search logo actions";
          }
          .header-grid-right {
            grid-template-columns: auto 1fr auto;
            grid-template-areas: "actions search logo";
          }
          .header-logo { grid-area: logo; }
          .header-search { grid-area: search; }
          .header-actions { grid-area: actions; }
        `}
      </style>
      <div className="container mx-auto px-4">
        {/* Desktop Header with Grid Layout */}
        <div 
          className={`desktop-header-grid items-center h-20 gap-6 ${
            logoPosition === "left" ? "header-grid-left" : 
            logoPosition === "center" ? "header-grid-center" : 
            "header-grid-right"
          }`}
        >
          {/* Logo */}
          <Link 
            to={`/loja/${storeSlug}`} 
            className={`header-logo flex-shrink-0 ${
              logoPosition === "left" ? "justify-self-start" : 
              logoPosition === "center" ? "justify-self-center" : 
              "justify-self-end"
            }`}
          >
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={storeName} 
                className="h-12 w-auto object-contain max-w-[250px] cursor-pointer hover:opacity-90 transition-opacity" 
              />
            ) : (
              <span className="text-2xl font-bold cursor-pointer hover:opacity-90 transition-opacity" style={{ color: backgroundColor }}>
                {storeName}
              </span>
            )}
          </Link>

          {/* Search */}
          <div className={`header-search w-full max-w-lg ${
            logoPosition === "left" ? "justify-self-center" : 
            logoPosition === "center" ? "justify-self-start" : 
            "justify-self-center"
          }`}>
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: backgroundColor }} />
              <Input
                type="search"
                placeholder="Buscar produtos..."
                value={localSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 pr-10 w-full store-search-input"
                style={searchInputStyle}
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Actions */}
          <div className={`header-actions flex items-center gap-4 ${
            logoPosition === "right" ? "justify-self-start" : "justify-self-end"
          }`}>
            <Link 
              to={`/loja/${storeSlug}/conta`}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              <User className="h-5 w-5" style={{ color: backgroundColor }} />
              <span className="text-sm font-medium" style={{ color: backgroundColor }}>Entrar</span>
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
        </div>

        {/* Mobile Header - Two Lines Layout */}
        <div className="md:hidden">
          {/* Line 1: Logo + Actions */}
          <div className={`flex items-center h-16 relative ${
            logoPosition === "right" ? "flex-row-reverse" : ""
          }`}>
            {/* Logo */}
            <Link to={`/loja/${storeSlug}`} className={`flex-shrink-0 ${
              logoPosition === "center" ? "flex-1 flex justify-center" : ""
            }`}>
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={storeName} 
                  className="h-8 w-auto object-contain max-w-[160px] cursor-pointer hover:opacity-90 transition-opacity" 
                />
              ) : (
                <span className="text-xl font-bold cursor-pointer hover:opacity-90 transition-opacity" style={{ color: backgroundColor }}>
                  {storeName}
                </span>
              )}
            </Link>
            
            {/* Spacer for non-center positions */}
            {logoPosition !== "center" && <div className="flex-1" />}
            
            {/* Mobile Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" style={{ color: backgroundColor }} /> : <Menu className="h-6 w-6" style={{ color: backgroundColor }} />}
              </Button>
            </div>
          </div>

          {/* Line 2: Search - Mobile */}
          <div className="pb-3 mobile-search-container">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 mobile-search-icon" style={{ color: backgroundColor }} />
              <Input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Buscar produtos..."
                value={localSearchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  handleSearchChange(value);
                }}
                onFocus={(e) => {
                  // Ensure input stays focused on mobile
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="pl-10 pr-10 w-full store-search-input"
                style={searchInputStyle}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                readOnly={false}
                disabled={false}
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>
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
