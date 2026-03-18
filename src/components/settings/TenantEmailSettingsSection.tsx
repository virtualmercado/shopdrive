import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Mail, Server, FileText, Activity, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import { useTenantEmailTemplates } from "@/hooks/useTenantEmailTemplates";
import { useTenantEmailLogs } from "@/hooks/useTenantEmailLogs";
import { toast } from "sonner";
import { PASSWORD_MASK } from "./email/emailHelpers";
import { EmailConfigTab } from "./email/EmailConfigTab";
import { EmailTemplatesTab } from "./email/EmailTemplatesTab";
import { EmailLogsTab } from "./email/EmailLogsTab";
import { EmailHealthTab } from "./email/EmailHealthTab";

export const TenantEmailSettingsSection = () => {
  const {
    settings, loading, saving, testingSmtp,
    saveSmtpConfig, testSmtp,
  } = useTenantEmailSettings();

  const {
    templates: tenantTemplates, loading: templatesLoading, saving: templateSaving,
    upsertTemplate, toggleTemplate,
  } = useTenantEmailTemplates();

  const { logs, loading: logsLoading, filters, setFilters } = useTenantEmailLogs();

  const [form, setForm] = useState({ sender_name: "", sender_email: "", reply_to: "" });
  const [smtpForm, setSmtpForm] = useState({
    smtp_mode: "platform",
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_security: "tls",
  });
  const [initialized, setInitialized] = useState(false);

  // Sync form with loaded settings
  if (settings && !initialized) {
    setForm({
      sender_name: settings.sender_name || "",
      sender_email: settings.sender_email || "",
      reply_to: settings.reply_to || "",
    });
    setSmtpForm({
      smtp_mode: settings.smtp_mode || "platform",
      smtp_host: settings.smtp_host || "",
      smtp_port: settings.smtp_port || 587,
      smtp_user: settings.smtp_user || "",
      smtp_password: settings.smtp_password ? PASSWORD_MASK : "",
      smtp_security: settings.smtp_security || "tls",
    });
    setInitialized(true);
  }

  const handleSaveConfig = async () => {
    const smtpData: Record<string, unknown> = {
      smtp_mode: smtpForm.smtp_mode,
      sender_name: form.sender_name,
      sender_email: form.sender_email,
      reply_to: form.reply_to,
    };
    if (smtpForm.smtp_mode === "custom") {
      smtpData.smtp_host = smtpForm.smtp_host;
      smtpData.smtp_port = smtpForm.smtp_port;
      smtpData.smtp_user = smtpForm.smtp_user;
      smtpData.smtp_password = smtpForm.smtp_password;
      smtpData.smtp_security = smtpForm.smtp_security;
    }
    await saveSmtpConfig(smtpData as any);
  };

  const handleTestSmtp = async () => {
    if (!smtpForm.smtp_host || !smtpForm.smtp_port) {
      toast.error("Preencha host e porta SMTP");
      return;
    }
    await testSmtp({
      smtp_host: smtpForm.smtp_host,
      smtp_port: smtpForm.smtp_port,
      smtp_user: smtpForm.smtp_user,
      smtp_password: smtpForm.smtp_password === PASSWORD_MASK ? (settings?.smtp_password || "") : smtpForm.smtp_password,
      smtp_security: smtpForm.smtp_security,
    });
  };

  const recentLogs = logs.slice(0, 100);
  const failedCount = recentLogs.filter(l => l.status === "error" || l.status === "failed" || l.status === "dlq").length;
  const lastSent = recentLogs.find(l => l.status === "sent" || l.status === "success");

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando configurações de e-mail...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">E-mails da Loja</h2>
          <p className="text-sm text-muted-foreground">Gerencie envio, templates e monitore a entrega dos seus e-mails</p>
        </div>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="mb-4 w-full grid grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="config" className="flex items-center gap-2 text-xs sm:text-sm">
            <Server className="h-4 w-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2 text-xs sm:text-sm">
            <FileText className="h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2 text-xs sm:text-sm">
            <Activity className="h-4 w-4" /> Logs de Envio
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2 text-xs sm:text-sm">
            <Shield className="h-4 w-4" /> Saúde
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <EmailConfigTab
            settings={settings}
            saving={saving}
            testingSmtp={testingSmtp}
            form={form}
            setForm={setForm}
            smtpForm={smtpForm}
            setSmtpForm={setSmtpForm}
            onSave={handleSaveConfig}
            onTestSmtp={handleTestSmtp}
            lastSent={lastSent}
            failedCount={failedCount}
          />
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplatesTab
            templates={tenantTemplates}
            loading={templatesLoading}
            saving={templateSaving}
            upsertTemplate={upsertTemplate}
            toggleTemplate={toggleTemplate}
          />
        </TabsContent>

        <TabsContent value="logs">
          <EmailLogsTab
            logs={logs}
            loading={logsLoading}
            filters={filters}
            setFilters={setFilters}
          />
        </TabsContent>

        <TabsContent value="health">
          <EmailHealthTab
            settings={settings}
            smtpMode={smtpForm.smtp_mode}
            smtpHost={smtpForm.smtp_host}
            smtpPort={smtpForm.smtp_port}
            logs={logs}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
