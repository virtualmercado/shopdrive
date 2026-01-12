import { ReactNode, useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Palette, 
  Settings, 
  Store,
  Menu,
  X,
  LogOut,
  Copy,
  Check,
  MessageCircle,
  Ticket,
  Truck,
  Users,
  CreditCard,
  FileText,
  Wallet,
  HeadphonesIcon
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { primaryColor, buttonBgColor, buttonTextColor, loading: themeLoading } = useTheme();

  useEffect(() => {
    const fetchStoreUrl = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_slug, store_logo_url")
        .eq("id", user.id)
        .single();

      if (profile?.store_slug) {
        const url = `${window.location.origin}/loja/${profile.store_slug}`;
        setStoreUrl(url);
      }
      
      if (profile?.store_logo_url) {
        setLogoUrl(profile.store_logo_url);
      }
    };

    fetchStoreUrl();
  }, [user]);

  const handleCopyLink = async () => {
    if (!storeUrl) return;
    
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar link");
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/lojista" },
    { icon: Package, label: "Produtos", path: "/lojista/products" },
    { icon: Ticket, label: "Cupons", path: "/lojista/coupons" },
    { icon: ShoppingCart, label: "Pedidos", path: "/lojista/orders" },
    { icon: Users, label: "Clientes", path: "/lojista/customers" },
    { icon: Truck, label: "Editar Frete", path: "/lojista/shipping" },
    { icon: CreditCard, label: "Formas de Pagamento", path: "/lojista/payment-methods" },
    { icon: FileText, label: "Catálogo PDF", path: "/lojista/catalog-pdf" },
    { icon: Store, label: "Minha Loja", path: "/lojista/store" },
    { icon: Palette, label: "Personalizar", path: "/lojista/customize" },
    { icon: MessageCircle, label: "Mensagens", path: "/lojista/messages" },
    { icon: Wallet, label: "Financeiro", path: "/lojista/financeiro" },
    { icon: HeadphonesIcon, label: "Suporte / Tickets", path: "/lojista/support" },
    { icon: Settings, label: "Configurações", path: "/lojista/settings" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full text-white z-50 transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-20"
        )}
        style={{ backgroundColor: themeLoading ? '#6a1b9a' : primaryColor }}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <Link to="/" className="flex items-center gap-2">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="Logo" 
                    className="h-8 w-auto object-contain max-w-[50px] md:max-w-[70px]"
                  />
                ) : (
                  <>
                    <Store className="h-6 w-6" />
                    <span className="font-bold">VirtualMercado</span>
                  </>
                )}
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:bg-white/10"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-white",
                    isActive 
                      ? "bg-white/20 font-medium" 
                      : "hover:bg-white/10"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              "w-full justify-start gap-3 text-white hover:bg-white/10",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className={cn(
          "transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {menuItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
              </h1>
              
              {/* Store Link Badge */}
              {storeUrl && (
                <div className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-black">Seu Link:</span>
                  <a 
                    href={storeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm hover:opacity-70 font-medium transition-opacity"
                    style={{ color: primaryColor }}
                  >
                    {storeUrl}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyLink}
                    className="h-8 w-8 hover:bg-gray-100 transition-colors"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-600" />
                    )}
                  </Button>
                </div>
              )}

              {storeUrl && (
                <div className="flex items-center gap-4">
                  <Link to={`/loja/${storeUrl.split('/loja/')[1]}`}>
                    <Button 
                      variant="outline" 
                      className="gap-2 transition-all hover:opacity-90"
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderColor: buttonBgColor }}
                    >
                      <Store className="h-4 w-4" />
                      Ver Loja
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;