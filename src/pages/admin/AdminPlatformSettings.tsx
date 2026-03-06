import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MessageCircle, Users, Shield, Settings2, Mail, ScanSearch, ShieldAlert } from "lucide-react";
import PlatformDataTab from "@/components/admin/settings/PlatformDataTab";
import SupportChannelsTab from "@/components/admin/settings/SupportChannelsTab";
import UsersPermissionsTab from "@/components/admin/settings/UsersPermissionsTab";
import AccountSecurityTab from "@/components/admin/settings/AccountSecurityTab";
import PlatformPreferencesTab from "@/components/admin/settings/PlatformPreferencesTab";
import EmailTemplatesTab from "@/components/admin/settings/EmailTemplatesTab";
import ImageAuditTab from "@/components/admin/settings/ImageAuditTab";
import SecurityLogsTab from "@/components/admin/settings/SecurityLogsTab";

const TAB_MAP: Record<string, string> = {
  dados: "dados",
  usuarios: "usuarios",
  emails: "emails",
  canais: "canais",
  "auditoria-imagens": "auditoria",
  "logs-seguranca": "logs",
  seguranca: "seguranca",
  preferencias: "preferencias",
};

const AdminPlatformSettings = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "";
  const defaultTab = TAB_MAP[tabParam] || "dados";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 mb-6">
            <TabsTrigger value="dados" className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dados</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">E-mails</span>
            </TabsTrigger>
            <TabsTrigger value="canais" className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Canais</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="flex items-center gap-1.5">
              <ScanSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="preferencias" className="flex items-center gap-1.5">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Pref.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados"><PlatformDataTab /></TabsContent>
          <TabsContent value="usuarios"><UsersPermissionsTab /></TabsContent>
          <TabsContent value="emails"><EmailTemplatesTab /></TabsContent>
          <TabsContent value="canais"><SupportChannelsTab /></TabsContent>
          <TabsContent value="auditoria"><ImageAuditTab /></TabsContent>
          <TabsContent value="logs"><SecurityLogsTab /></TabsContent>
          <TabsContent value="seguranca"><AccountSecurityTab /></TabsContent>
          <TabsContent value="preferencias"><PlatformPreferencesTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminPlatformSettings;
