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
import { clearTemplateEditorContext } from "@/hooks/useTemplateEditor";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// VM Official Logo for Dashboard
import vmLogo from "@/assets/logo-vm-dashboard.png";

// VM Official Colors - Fixed for the dashboard
const VM_PRIMARY_COLOR = '#6a1b9a';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface TemplateEditorContext {
  templateId: string;
  sourceProfileId: string;
  mode: string;
  credentials?: { email: string; password: string };
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [domainWizardOpen, setDomainWizardOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [isTemplateEditorMode, setIsTemplateEditorMode] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Template editor mode detection from localStorage (persists across navigation)
  useEffect(() => {
    const checkTemplateEditorMode = async () => {
      // Check URL params first
      const urlTemplateId = searchParams.get('templateId');
      const urlMode = searchParams.get('mode');
      
      // Check localStorage for editor context
      let editorContext: TemplateEditorContext | null = null;
      try {
        const stored = localStorage.getItem('templateEditorContext');
        if (stored) {
          editorContext = JSON.parse(stored);
        }
      } catch {
        // Ignore parse errors
      }

      // Determine if we're in template editor mode
      const isFromUrl = urlMode === 'template-editor' && !!urlTemplateId;
      const isFromStorage = editorContext?.mode === 'template-editor' && !!editorContext?.templateId;
      
      if (isFromUrl || isFromStorage) {
        const tId = urlTemplateId || editorContext?.templateId || null;
        setIsTemplateEditorMode(true);
        setTemplateId(tId);

        // If we have credentials in context and haven't attempted login yet
        // This switches the current session to the template profile
        if (editorContext?.credentials && !hasAttemptedLogin) {
          setHasAttemptedLogin(true);
          setIsLoggingIn(true);
          
          try {
            // Always sign out first to ensure clean session switch
            await supabase.auth.signOut();
            
            // Login as template profile
            const { error: loginError } = await supabase.auth.signInWithPassword({
              email: editorContext.credentials.email,
              password: editorContext.credentials.password,
            });

            if (loginError) {
              console.error('Error logging in as template profile:', loginError);
              toast.error('Erro ao acessar perfil do template. Verifique as credenciais.');
              clearTemplateEditorContext();
              navigate('/gestor/login');
              return;
            }
            
            // Clear credentials from storage after successful login (security)
            const updatedContext = { ...editorContext };
            delete updatedContext.credentials;
            localStorage.setItem('templateEditorContext', JSON.stringify(updatedContext));
            
            toast.success('Conectado ao perfil do template!');
            
            // Force page reload to ensure all components fetch fresh data
            window.location.reload();
          } catch (error) {
            console.error('Error during session switch:', error);
            toast.error('Erro ao trocar sessão');
            clearTemplateEditorContext();
            navigate('/gestor/login');
          } finally {
            setIsLoggingIn(false);
          }
        }
      } else {
        setIsTemplateEditorMode(false);
        setTemplateId(null);
      }
    };

    checkTemplateEditorMode();
  }, [searchParams, navigate, hasAttemptedLogin]);

  useEffect(() => {
    const fetchStoreUrl = async () => {
      if (!user || isTemplateEditorMode) return;

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
  }, [user, isTemplateEditorMode]);

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

    if (isTemplateEditorMode && templateId) {
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

  const handleExitTemplateMode = async () => {
    // Clear the template editor context
    clearTemplateEditorContext();
    
    // Sign out from template profile
    await supabase.auth.signOut();
    
    if (window.opener) {
      window.close();
    } else {
      navigate('/gestor/login');
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

  // Helper to generate nav link with template params preserved
  const getNavPath = (basePath: string) => {
    if (isTemplateEditorMode && templateId) {
      return `${basePath}?templateId=${templateId}&mode=template-editor`;
    }
    return basePath;
  };

  const handleLogout = async () => {
    if (isTemplateEditorMode) {
      await handleExitTemplateMode();
    } else {
      await signOut();
      navigate("/", { replace: true });
    }
  };

  // Show loading when logging in to template profile
  if (isLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Acessando perfil do template...</p>
        </div>
      </div>
    );
  }

  // Sidebar content component for reuse
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={getNavPath(item.path)}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-white",
                  isActive 
                    ? "bg-white/20 font-medium" 
                    : "hover:bg-white/10"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-white/10">
        <Button
          variant="ghost"
          onClick={() => {
            onNavigate?.();
            handleLogout();
          }}
          className="w-full justify-start gap-3 text-white hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair</span>
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Sidebar - Off-canvas Sheet */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent 
            side="left" 
            className="p-0 w-[280px] border-r-0 flex flex-col [&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:top-5 [&>button]:right-3"
            style={{ backgroundColor: VM_PRIMARY_COLOR }}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <Link to="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
                <img 
                  src={vmLogo} 
                  alt="VirtualMercado" 
                  className="h-10 w-auto object-contain max-w-[180px]"
                />
              </Link>
            </div>
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar - Fixed position */}
      {!isMobile && (
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
                    to={getNavPath(item.path)}
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
      )}

      {/* Main Content */}
      <div 
        className={cn(
          "transition-all duration-300 w-full",
          // Desktop: apply margin for sidebar
          !isMobile && (sidebarOpen ? "ml-64" : "ml-20"),
          // Mobile: no margin, full width
          isMobile && "ml-0"
        )}
      >
        {/* Template Editor Mode Banner */}
        {isTemplateEditorMode && (
          <div className="bg-amber-500 text-white px-4 md:px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div className="text-sm md:text-base">
                <span className="font-medium">Modo Edição de Template:</span>
                <span className="ml-2">{templateName || 'Carregando...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate}
                className="bg-white text-amber-600 hover:bg-amber-50 flex-1 md:flex-none"
              >
                {isSavingTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitTemplateMode}
                className="text-white hover:bg-amber-600 flex-1 md:flex-none"
              >
                <X className="h-4 w-4 mr-2" />
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between gap-3 md:gap-4">
              {/* Mobile menu button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex-shrink-0"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              
              <h1 className="text-lg md:text-2xl font-bold text-foreground truncate flex-1">
                {isTemplateEditorMode 
                  ? `Editando: ${templateName || '...'}` 
                  : menuItems.find(item => item.path === location.pathname)?.label || "Dashboard"
                }
              </h1>
              
              {/* Store Link Badge - Desktop only */}
              {storeUrl && !isTemplateEditorMode && !isMobile && (
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

              {/* Ver Loja button */}
              {storeUrl && !isTemplateEditorMode && (
                <Link to={`/loja/${storeUrl.split('/loja/')[1]}`}>
                  <Button 
                    size={isMobile ? "sm" : "default"}
                    className="gap-2 transition-all hover:opacity-90 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Store className="h-4 w-4" />
                    {!isMobile && "Ver Loja"}
                  </Button>
                </Link>
              )}
            </div>
            
            {/* Mobile store link - simplified */}
            {storeUrl && !isTemplateEditorMode && isMobile && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-1 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar Link
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDomainWizardOpen(true)}
                  className="flex-1 text-xs"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Domínio
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Global Billing Alert - Appears below header (hide in template mode) */}
        {!isTemplateEditorMode && <GlobalBillingAlert />}

        {/* Page Content - Responsive: full width on mobile, constrained on desktop */}
        <main 
          className={cn(
            "page-enter w-full",
            // Mobile: full width with comfortable padding
            "px-4 py-4",
            // Desktop/Tablet: constrained width, centered, comfortable padding
            "lg:max-w-[1400px] lg:mx-auto lg:px-6 lg:py-6"
          )} 
          data-page-content
        >
          {children}
        </main>
      </div>

      <CustomDomainWizard open={domainWizardOpen} onOpenChange={setDomainWizardOpen} />
    </div>
  );
};

export default DashboardLayout;
