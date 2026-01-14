import { ReactNode, useState } from "react";
import { 
  LayoutDashboard, 
  Menu,
  X,
  LogOut,
  Users,
  FileText,
  Zap,
  Link as LinkIcon,
  BarChart3,
  HeadphonesIcon,
  Shield,
  Brain,
  Cpu,
  Layers,
  Image,
  Globe
} from "lucide-react";
import logoVmMaster from "@/assets/logo-vm-master.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/gestor" },
    { icon: Cpu, label: "Centro de Comando IA", path: "/gestor/comando-ia" },
    { icon: Brain, label: "Inteligência Artificial", path: "/gestor/inteligencia-artificial" },
    { icon: Users, label: "Assinantes", path: "/gestor/assinantes" },
    { icon: FileText, label: "Faturas e Pagamentos", path: "/gestor/faturas" },
    { icon: Zap, label: "Automações", path: "/gestor/automacoes" },
    { icon: LinkIcon, label: "Integrações", path: "/gestor/integracoes" },
    { icon: Layers, label: "Gerenciador CMS", path: "/gestor/cms" },
    { icon: Image, label: "Biblioteca de Mídia", path: "/gestor/biblioteca-midia" },
    { icon: BarChart3, label: "Relatórios", path: "/gestor/relatorios" },
    { icon: HeadphonesIcon, label: "Suporte / Tickets\nPainel Lojista", path: "/gestor/suporte" },
    { icon: Globe, label: "Suporte / Tickets\nLanding Page", path: "/gestor/suporte-landing" },
    { icon: Shield, label: "Logs e Segurança", path: "/gestor/seguranca" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const getCurrentPageTitle = () => {
    const current = menuItems.find(item => item.path === location.pathname);
    return current?.label || "Painel Master";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full bg-[#6a1b9a] text-white z-50 transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <Link to="/gestor" className="flex items-center">
                <img 
                  src={logoVmMaster} 
                  alt="Virtual Mercado" 
                  className="h-7 w-auto"
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

        <nav className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const hasLineBreak = item.label.includes('\n');
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-white",
                  isActive 
                    ? "bg-white/20 font-medium" 
                    : "hover:bg-white/10"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && (
                  hasLineBreak ? (
                    <span className="text-sm whitespace-pre-line leading-tight">{item.label}</span>
                  ) : (
                    <span className="text-sm">{item.label}</span>
                  )
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-0 right-0 px-4">
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
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {getCurrentPageTitle()}
                </h1>
              </div>
              
              {/* System Status */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-green-700">Sistema Online</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                  <Shield className="h-3 w-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700">SSL Ativo</span>
                </div>
              </div>
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

export default AdminLayout;
