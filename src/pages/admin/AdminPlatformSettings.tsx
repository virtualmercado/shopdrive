import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MessageCircle, Users, Shield, Settings2 } from "lucide-react";
import PlatformDataTab from "@/components/admin/settings/PlatformDataTab";
import SupportChannelsTab from "@/components/admin/settings/SupportChannelsTab";
import UsersPermissionsTab from "@/components/admin/settings/UsersPermissionsTab";
import AccountSecurityTab from "@/components/admin/settings/AccountSecurityTab";
import PlatformPreferencesTab from "@/components/admin/settings/PlatformPreferencesTab";

const AdminPlatformSettings = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="dados" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dados da Plataforma</span>
              <span className="sm:hidden">Dados</span>
            </TabsTrigger>
            <TabsTrigger value="canais" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Canais de Atendimento</span>
              <span className="sm:hidden">Canais</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários e Permissões</span>
              <span className="sm:hidden">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança da Conta</span>
              <span className="sm:hidden">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="preferencias" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Preferências</span>
              <span className="sm:hidden">Pref.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <PlatformDataTab />
          </TabsContent>

          <TabsContent value="canais">
            <SupportChannelsTab />
          </TabsContent>

          <TabsContent value="usuarios">
            <UsersPermissionsTab />
          </TabsContent>

          <TabsContent value="seguranca">
            <AccountSecurityTab />
          </TabsContent>

          <TabsContent value="preferencias">
            <PlatformPreferencesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminPlatformSettings;
