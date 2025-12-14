import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  User, ShoppingBag, Heart, Key, LogOut, ArrowLeft, Menu, X 
} from "lucide-react";
import CustomerAccountSection from "@/components/customer/CustomerAccountSection";
import CustomerOrdersSection from "@/components/customer/CustomerOrdersSection";
import CustomerWishlistSection from "@/components/customer/CustomerWishlistSection";
import CustomerPasswordSection from "@/components/customer/CustomerPasswordSection";

type TabType = 'account' | 'orders' | 'wishlist' | 'password';

const CustomerAccount = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useCustomerAuth();

  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/loja/${storeSlug}/auth`, { replace: true });
    }
  }, [user, authLoading, navigate, storeSlug]);

  useEffect(() => {
    const fetchStoreProfile = async () => {
      if (!storeSlug) return;

      const { data: store } = await supabase
        .from('profiles')
        .select('*')
        .eq('store_slug', storeSlug)
        .maybeSingle();

      if (store) setStoreProfile(store);
      setLoading(false);
    };

    fetchStoreProfile();
  }, [storeSlug]);

  const handleLogout = async () => {
    await signOut();
    navigate(`/loja/${storeSlug}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  const menuItems = [
    { id: 'account' as TabType, label: 'Minha Conta', icon: User },
    { id: 'orders' as TabType, label: 'Meus Pedidos', icon: ShoppingBag },
    { id: 'wishlist' as TabType, label: 'Lista de Desejos', icon: Heart },
    { id: 'password' as TabType, label: 'Alterar Senha', icon: Key },
  ];

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: storeProfile?.font_family || 'Inter' }}>
      {/* Header */}
      <header 
        className="border-b py-4 px-4"
        style={{ 
          backgroundColor: storeProfile?.secondary_color || '#FFFFFF',
          color: storeProfile?.footer_text_color || '#000000'
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <Link to={`/loja/${storeSlug}`}>
            {storeProfile?.store_logo_url ? (
              <img 
                src={storeProfile.store_logo_url} 
                alt={storeProfile.store_name || 'Logo da loja'} 
                className="h-10 object-contain"
              />
            ) : (
              <span className="font-semibold text-lg">{storeProfile?.store_name || 'Loja'}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              to={`/loja/${storeSlug}`} 
              className="text-sm flex items-center gap-1 hover:underline hidden md:flex"
              style={{ color: storeProfile?.footer_text_color || '#000000' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para a loja
            </Link>
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:block w-64 bg-white border-r p-4">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    isActive ? 'font-medium' : 'text-muted-foreground hover:bg-gray-100'
                  }`}
                  style={isActive ? { 
                    backgroundColor: `${buttonBgColor}15`,
                    color: buttonBgColor 
                  } : {}}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </nav>
        </aside>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b p-4">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      isActive ? 'font-medium' : 'text-muted-foreground hover:bg-gray-100'
                    }`}
                    style={isActive ? { 
                      backgroundColor: `${buttonBgColor}15`,
                      color: buttonBgColor 
                    } : {}}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
              <Link 
                to={`/loja/${storeSlug}`} 
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-muted-foreground hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
                Voltar para a loja
              </Link>
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          {/* Mobile Tab Header */}
          <div className="md:hidden mb-4 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive ? '' : 'bg-gray-100 text-muted-foreground'
                    }`}
                    style={isActive ? { 
                      backgroundColor: buttonBgColor,
                      color: buttonTextColor 
                    } : {}}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-3xl">
            {activeTab === 'account' && (
              <CustomerAccountSection 
                storeProfile={storeProfile}
                userId={user?.id || ''}
              />
            )}
            {activeTab === 'orders' && (
              <CustomerOrdersSection 
                storeProfile={storeProfile}
                userId={user?.id || ''}
              />
            )}
            {activeTab === 'wishlist' && (
              <CustomerWishlistSection 
                storeProfile={storeProfile}
                storeSlug={storeSlug || ''}
                userId={user?.id || ''}
              />
            )}
            {activeTab === 'password' && (
              <CustomerPasswordSection 
                storeProfile={storeProfile}
              />
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      {storeProfile && (
        <footer 
          className="py-6 px-4 text-center text-sm"
          style={{ 
            backgroundColor: storeProfile.footer_bg_color || '#1a1a1a',
            color: storeProfile.footer_text_color || '#ffffff'
          }}
        >
          <p>© {new Date().getFullYear()} {storeProfile.store_name}. Todos os direitos reservados.</p>
          <p className="text-xs mt-2 opacity-70">Desenvolvido com VirtualMercado</p>
        </footer>
      )}
    </div>
  );
};

export default CustomerAccount;
