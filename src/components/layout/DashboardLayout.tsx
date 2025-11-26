import { ReactNode, useState, useEffect } from "react";
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
  MessageCircle
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    const fetchStoreUrl = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_slug")
        .eq("id", user.id)
        .single();

      if (profile?.store_slug) {
        const url = `${window.location.origin}/loja/${profile.store_slug}`;
        setStoreUrl(url);
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
    { icon: ShoppingCart, label: "Pedidos", path: "/lojista/orders" },
    { icon: Store, label: "Minha Loja", path: "/lojista/store" },
    { icon: Palette, label: "Personalizar", path: "/lojista/customize" },
    { icon: MessageCircle, label: "Mensagens", path: "/lojista/messages" },
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
          "fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground z-50 transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Store className="h-6 w-6" />
              {sidebarOpen && <span className="font-bold">VirtualMercado</span>}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-0 right-0 px-4">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent",
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
                    className="text-sm text-primary hover:underline font-medium"
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
                    <Button variant="outline" className="gap-2">
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