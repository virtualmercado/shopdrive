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
  Truck,
  Users,
  CreditCard,
  FileText,
  Wallet,
  HeadphonesIcon,
  Megaphone,
  Globe,
  Save,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomDomainWizard } from "@/components/domain";
import { GlobalBillingAlert } from "@/components/billing/GlobalBillingAlert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// VM Official Logo for Dashboard
import vmLogo from "@/assets/logo-vm-dashboard.png";

// VM Official Colors - Fixed for the dashboard
const VM_PRIMARY_COLOR = '#6a1b9a';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [domainWizardOpen, setDomainWizardOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [searchParams] = useSearchParams();

  // Template editor mode detection
  const templateId = searchParams.get('templateId');
  const mode = searchParams.get('mode');
  const isTemplateEditorMode = mode === 'template-editor' && !!templateId;

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

  // Fetch template name when in editor mode
  useEffect(() => {
    const fetchTemplateName = async () => {
      if (!templateId) return;
      
      const { data } = await supabase
        .from('brand_templates')
        .select('name')
        .eq('id', templateId)
        .single();
      
      if (data) {
        setTemplateName(data.name);
      }
    };

    if (isTemplateEditorMode) {
      fetchTemplateName();
    }
  }, [templateId, isTemplateEditorMode]);

  const handleSaveTemplate = async () => {
    if (!templateId) return;
    
    setIsSavingTemplate(true);
    
    try {
      const { error } = await supabase
        .rpc('sync_template_from_profile', { p_template_id: templateId });

      if (error) throw error;
      
      toast.success('Template salvo com sucesso! Snapshot atualizado.');
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(`Erro ao salvar template: ${error.message}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleExitTemplateMode = () => {
    sessionStorage.removeItem('templateEditorContext');
    
    if (window.opener) {
      window.close();
    } else {
      navigate('/gestor/templates-marca');
    }
  };

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
    { icon: Users, label: "Clientes", path: "/lojista/customers" },
    { icon: Truck, label: "Editar Frete", path: "/lojista/shipping" },
    { icon: CreditCard, label: "Formas de Pagamento", path: "/lojista/payment-methods" },
    { icon: FileText, label: "Catálogo PDF", path: "/lojista/catalog-pdf" },
    { icon: Store, label: "Minha Loja", path: "/lojista/store" },
    { icon: Palette, label: "Personalizar", path: "/lojista/customize" },
    { icon: Megaphone, label: "Marketing", path: "/lojista/marketing" },
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
      {/* Sidebar - Always uses VM official purple color */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full text-white z-50 transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-20"
        )}
        style={{ backgroundColor: VM_PRIMARY_COLOR }}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <Link to="/" className="flex items-center">
                <img 
                  src={vmLogo} 
                  alt="VirtualMercado" 
                  className="h-10 w-auto object-contain max-w-[180px]"
                />
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
        {/* Template Editor Mode Banner */}
        {isTemplateEditorMode && (
          <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <span className="font-medium">Modo Edição de Template:</span>
                <span className="ml-2">{templateName || 'Carregando...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate}
                className="bg-white text-amber-600 hover:bg-amber-50"
              >
                {isSavingTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Template
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitTemplateMode}
                className="text-white hover:bg-amber-600"
              >
                <X className="h-4 w-4 mr-2" />
                Fechar Editor
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {isTemplateEditorMode 
                  ? `Editando Template: ${templateName || '...'}` 
                  : menuItems.find(item => item.path === location.pathname)?.label || "Dashboard"
                }
              </h1>
              
              {/* Store Link Badge - Uses VM official colors (hide in template mode) */}
              {storeUrl && !isTemplateEditorMode && (
                <div className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-black">Seu Link:</span>
                  <a 
                    href={storeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm hover:opacity-70 font-medium transition-opacity text-primary"
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
                  <button
                    onClick={() => setDomainWizardOpen(true)}
                    className="text-xs flex items-center gap-1 hover:underline text-primary"
                  >
                    <Globe className="h-3 w-3" />
                    Conectar domínio próprio
                  </button>
                </div>
              )}

              {storeUrl && !isTemplateEditorMode && (
                <div className="flex items-center gap-4">
                  <Link to={`/loja/${storeUrl.split('/loja/')[1]}`}>
                    <Button 
                      className="gap-2 transition-all hover:opacity-90 bg-primary text-primary-foreground hover:bg-primary/90"
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

        {/* Global Billing Alert - Appears below header (hide in template mode) */}
        {!isTemplateEditorMode && <GlobalBillingAlert />}

        {/* Page Content */}
        <main className="p-6 page-enter" data-page-content>
          {children}
        </main>
      </div>

      <CustomDomainWizard open={domainWizardOpen} onOpenChange={setDomainWizardOpen} />
    </div>
  );
};

export default DashboardLayout;
