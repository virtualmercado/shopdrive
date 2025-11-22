import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoleCheck } from '@/hooks/useRoleCheck';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Plug, 
  HelpCircle,
  LogOut,
  Menu,
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import logoRodape from '@/assets/logo-rodape.png';

interface AdminLayoutProps {
  children: ReactNode;
}

type AppRole = 'admin' | 'financeiro' | 'suporte' | 'tecnico';

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  roles: AppRole[];
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { roles, hasAnyRole } = useRoleCheck();

  const menuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin", roles: ['admin', 'financeiro', 'suporte', 'tecnico'] },
    { icon: Users, label: "Assinantes", path: "/admin/subscribers", roles: ['admin', 'financeiro', 'suporte'] },
    { icon: FileText, label: "Faturas e Pagamentos", path: "/admin/invoices", roles: ['admin', 'financeiro'] },
    { icon: BarChart3, label: "Relatórios", path: "/admin/reports", roles: ['admin', 'financeiro'] },
    { icon: Plug, label: "Integrações", path: "/admin/integrations", roles: ['admin', 'tecnico'] },
    { icon: HelpCircle, label: "Suporte", path: "/admin/support", roles: ['admin', 'suporte'] },
    { icon: SettingsIcon, label: "Planos", path: "/admin/plans", roles: ['admin'] },
  ];

  const visibleMenuItems = menuItems.filter(item => hasAnyRole(item.roles));

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-600 text-white',
      financeiro: 'bg-green-600 text-white',
      suporte: 'bg-blue-600 text-white',
      tecnico: 'bg-orange-600 text-white',
    };
    return colors[role] || 'bg-gray-600 text-white';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      financeiro: 'Financeiro',
      suporte: 'Suporte',
      tecnico: 'Técnico',
      user: 'Usuário',
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-[#2D2D2D] text-white transition-all duration-300 z-50 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            {sidebarOpen && (
              <img src={logoRodape} alt="VirtualMercado" className="h-8" />
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-auto"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* User Role Badge */}
          {sidebarOpen && roles.length > 0 && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex flex-wrap gap-2">
                {roles.map(role => (
                  <Badge key={role} className={getRoleBadgeColor(role)}>
                    {getRoleLabel(role)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Menu Items */}
          <nav className="flex-1 py-6 overflow-y-auto">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${
                    isActive
                      ? 'bg-primary/20 text-primary border-r-4 border-primary'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-white/10">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className={`w-full justify-start text-white/70 hover:text-white hover:bg-white/5 ${
                !sidebarOpen && 'justify-center'
              }`}
            >
              <LogOut size={20} />
              {sidebarOpen && <span className="ml-3">Sair</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <div className="min-h-screen bg-[#F5F5F5]">
          {children}
        </div>
      </main>
    </div>
  );
};
