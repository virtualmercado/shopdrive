import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { User, Heart, Package, ChevronRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerAccountDropdownProps {
  storeSlug: string;
  storeOwnerId: string;
  textColor: string;
  accentColor: string;
}

interface FavoriteProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
}

interface RecentOrder {
  id: string;
  order_number: string | null;
  created_at: string;
  total_amount: number;
}

const CustomerAccountDropdown = ({
  storeSlug,
  storeOwnerId,
  textColor,
  accentColor,
}: CustomerAccountDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeout = useRef<number | null>(null);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setLoaded(false); // reset data on auth change
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data lazily when dropdown opens
  useEffect(() => {
    if (!isOpen || loaded || !userId) return;
    setLoading(true);

    const fetchData = async () => {
      // Fetch favorites with product info
      const { data: favData } = await supabase
        .from("customer_favorites")
        .select("id, product_id")
        .eq("customer_id", userId)
        .eq("store_owner_id", storeOwnerId)
        .order("created_at", { ascending: false })
        .limit(4);

      let mappedFavs: FavoriteProduct[] = [];
      if (favData && favData.length > 0) {
        const productIds = favData.map((f) => f.product_id);
        const { data: products } = await supabase
          .from("products")
          .select("id, name, images")
          .in("id", productIds);

        const productMap = new Map(products?.map((p) => [p.id, p]) || []);
        mappedFavs = favData.map((f) => {
          const p = productMap.get(f.product_id);
          return {
            id: f.id,
            product_id: f.product_id,
            product_name: p?.name || "Produto",
            product_image: p?.images?.[0] || null,
          };
        });
      }

      // Fetch recent orders
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, order_number, created_at, total_amount")
        .eq("customer_id", userId)
        .eq("store_owner_id", storeOwnerId)
        .order("created_at", { ascending: false })
        .limit(4);

      setFavorites(mappedFavs);
      setOrders(orderData || []);
      setLoaded(true);
      setLoading(false);
    };

    fetchData();
  }, [isOpen, loaded, userId, storeOwnerId]);

  const handleMouseEnter = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeout.current = window.setTimeout(() => setIsOpen(false), 200);
  };

  // Close on click outside (mobile)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const isLoggedIn = !!userId;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <Link
        to={`/loja/${storeSlug}/conta`}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-black/5 transition-colors cursor-pointer"
        onClick={(e) => {
          // On mobile, toggle dropdown instead of navigating
          if (window.innerWidth < 768) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full border-2"
          style={{ borderColor: textColor }}
        >
          <User className="h-4 w-4" style={{ color: textColor }} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs" style={{ color: textColor }}>
            Olá, bem-vindo(a)
          </span>
          {!isLoggedIn && (
            <span className="text-xs font-semibold" style={{ color: textColor }}>
              <span className="underline">Entre</span>{" "}
              <span className="font-normal">ou</span>{" "}
              <span className="underline">Cadastre-se</span>
            </span>
          )}
        </div>
      </Link>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-[60] w-[300px] overflow-hidden"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {!isLoggedIn ? (
            /* Not logged in state */
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Faça login para ver seus favoritos e pedidos.
              </p>
              <Link
                to={`/loja/${storeSlug}/conta`}
                className="block w-full text-center text-sm font-semibold py-2 rounded-md text-white transition-colors"
                style={{ backgroundColor: accentColor }}
                onClick={() => setIsOpen(false)}
              >
                Entrar ou Cadastrar
              </Link>
            </div>
          ) : (
            /* Logged in state */
            <div>
              {/* Favorites Section */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4" style={{ color: accentColor }} />
                  <span className="text-sm font-semibold text-gray-800">Meus favoritos</span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-10 w-10 rounded" />
                        <Skeleton className="h-4 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : favorites.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Você ainda não adicionou produtos aos favoritos.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {favorites.map((fav) => (
                      <Link
                        key={fav.id}
                        to={`/loja/${storeSlug}/produto/${fav.product_id}`}
                        className="flex items-center gap-2 hover:bg-gray-50 rounded p-1 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="h-10 w-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                          {fav.product_image ? (
                            <img
                              src={fav.product_image}
                              alt={fav.product_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-300">
                              <Heart className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-700 line-clamp-2 flex-1">
                          {fav.product_name}
                        </span>
                      </Link>
                    ))}
                    <Link
                      to={`/loja/${storeSlug}/conta`}
                      className="flex items-center justify-between text-xs font-medium pt-1"
                      style={{ color: accentColor }}
                      onClick={() => setIsOpen(false)}
                    >
                      Ver todos os favoritos
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Orders Section */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4" style={{ color: accentColor }} />
                  <span className="text-sm font-semibold text-gray-800">Meus pedidos</span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-10 w-full rounded" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Você ainda não realizou compras nesta loja.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <Link
                        key={order.id}
                        to={`/loja/${storeSlug}/conta`}
                        className="block hover:bg-gray-50 rounded p-2 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">
                            Pedido #{order.order_number || order.id.slice(0, 6)}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: accentColor }}>
                            {formatCurrency(order.total_amount)}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {formatDate(order.created_at)}
                        </span>
                      </Link>
                    ))}
                    <Link
                      to={`/loja/${storeSlug}/conta`}
                      className="flex items-center justify-between text-xs font-medium pt-1"
                      style={{ color: accentColor }}
                      onClick={() => setIsOpen(false)}
                    >
                      Ver todos os pedidos
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Sair
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerAccountDropdown;
