import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Mail, CheckCircle2, XCircle, AlertCircle, Loader2, Server,
  Zap, FileText, Pencil, Activity, Send, Eye, RotateCcw,
  Clock, AlertTriangle, Shield, Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import { useTenantEmailTemplates, TENANT_EMAIL_EVENTS, TEMPLATE_VARIABLES, type TenantEmailTemplate } from "@/hooks/useTenantEmailTemplates";
import { useTenantEmailLogs } from "@/hooks/useTenantEmailLogs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PASSWORD_MASK = "••••••••";

/* ─── Status helpers ─── */
const statusColor = (s: string) => {
  switch (s) {
    case "sent": case "success": return "default";
    case "error": case "failed": case "dlq": return "destructive";
    case "pending": case "queued": return "outline";
    default: return "secondary";
  }
};
const statusLabel = (s: string) => {
  switch (s) {
    case "sent": case "success": return "Enviado";
    case "error": case "failed": return "Falha";
    case "dlq": return "Descartado";
    case "pending": case "queued": return "Pendente";
    default: return s;
  }
};
const originLabel = (s: string | null) => {
  if (!s) return "Plataforma";
  if (s === "tenant_custom") return "SMTP Próprio";
  return "Plataforma";
};

export const TenantEmailSettingsSection = () => {
  const {
    settings, loading, saving, testingSmtp,
    saveSettings, saveSmtpConfig, testSmtp,
  } = useTenantEmailSettings();

  const {
    templates: tenantTemplates, loading: templatesLoading, saving: templateSaving,
    upsertTemplate, toggleTemplate,
  } = useTenantEmailTemplates();

  const { logs, loading: logsLoading, filters, setFilters } = useTenantEmailLogs();

  const [form, setForm] = useState({
    sender_name: "", sender_email: "", reply_to: "",
  });
  const [smtpForm, setSmtpForm] = useState({
    smtp_mode: "platform" as string,
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_security: "tls",
  });
  const [initialized, setInitialized] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    subject: "", html_body: "", text_body: "", pre_header: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  const [logDetail, setLogDetail] = useState<any>(null);

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
    const smtpData: any = {
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
    await saveSmtpConfig(smtpData);
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

  const openTemplateEditor = (eventKey: string) => {
    const existing = tenantTemplates.find((t) => t.event_key === eventKey);
    setTemplateForm({
      subject: existing?.subject || "",
      html_body: existing?.html_body || "",
      text_body: existing?.text_body || "",
      pre_header: "",
    });
    setShowPreview(false);
    setEditingEvent(eventKey);
  };

  const handleSaveTemplate = async () => {
    if (!editingEvent) return;
    const success = await upsertTemplate(editingEvent, {
      subject: templateForm.subject,
      html_body: templateForm.html_body,
      text_body: templateForm.text_body,
    });
    if (success) setEditingEvent(null);
  };

  const handleRestoreDefault = () => {
    setTemplateForm({ subject: "", html_body: "", text_body: "", pre_header: "" });
    toast.info("Template restaurado ao padrão da plataforma. Salve para confirmar.");
  };

  /* ─── Stats for health tab ─── */
  const recentLogs = logs.slice(0, 100);
  const sentCount = recentLogs.filter(l => l.status === "sent" || l.status === "success").length;
  const failedCount = recentLogs.filter(l => l.status === "error" || l.status === "failed" || l.status === "dlq").length;
  const totalCount = recentLogs.length;
  const successRate = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;
  const lastError = recentLogs.find(l => l.status === "error" || l.status === "failed");
  const lastSent = recentLogs.find(l => l.status === "sent" || l.status === "success");

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
  };

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

        {/* ━━━━━━━━ TAB 1: CONFIGURAÇÃO DE ENVIO ━━━━━━━━ */}
        <TabsContent value="config" className="space-y-4">
          {/* Alerts */}
          {smtpForm.smtp_mode === "platform" && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300">E-mail padrão da plataforma ativo</p>
                <p className="text-blue-600 dark:text-blue-400 mt-1">Seus e-mails são enviados pelo SMTP da ShopDrive. Você pode personalizar o remetente abaixo.</p>
              </div>
            </div>
          )}
          {smtpForm.smtp_mode === "custom" && !settings?.is_smtp_validated && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">SMTP não validado</p>
                <p className="text-amber-600 dark:text-amber-400 mt-1">Configure e teste a conexão SMTP antes de ativar. Alguns provedores (Gmail, Outlook) exigem <strong>senha de aplicativo</strong>.</p>
              </div>
            </div>
          )}

          {/* Modo de envio */}
          <Card className="p-6">
            <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Modo de Envio
            </h3>
            <RadioGroup value={smtpForm.smtp_mode} onValueChange={(v) => setSmtpForm((p) => ({ ...p, smtp_mode: v }))} className="space-y-3">
              <label className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${smtpForm.smtp_mode === "platform" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value="platform" className="mt-1" />
                <div>
                  <span className="text-sm font-medium">Usar e-mail padrão da plataforma</span>
                  <p className="text-xs text-muted-foreground mt-1">Envio gerenciado pela ShopDrive. Sem necessidade de configuração adicional.</p>
                </div>
              </label>
              <label className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${smtpForm.smtp_mode === "custom" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value="custom" className="mt-1" />
                <div>
                  <span className="text-sm font-medium">Usar meu próprio SMTP</span>
                  <p className="text-xs text-muted-foreground mt-1">Configure seu servidor SMTP para enviar e-mails diretamente do seu domínio.</p>
                </div>
              </label>
            </RadioGroup>
          </Card>

          {/* Identidade do remetente */}
          <Card className="p-6">
            <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Identidade do Remetente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nome do Remetente</Label>
                <Input placeholder="Minha Loja" value={form.sender_name} onChange={(e) => setForm((p) => ({ ...p, sender_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail Remetente</Label>
                <Input type="email" placeholder="contato@minhaloja.com" value={form.sender_email} onChange={(e) => setForm((p) => ({ ...p, sender_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail de Resposta</Label>
                <Input type="email" placeholder="suporte@minhaloja.com" value={form.reply_to} onChange={(e) => setForm((p) => ({ ...p, reply_to: e.target.value }))} />
              </div>
            </div>
          </Card>

          {/* SMTP próprio */}
          {smtpForm.smtp_mode === "custom" && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Configuração SMTP
                </h3>
                {settings?.is_smtp_validated ? (
                  <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Validado</Badge>
                ) : settings?.last_test_status === "error" ? (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Não validado</Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input value={smtpForm.smtp_host} onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.seuservidor.com" />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Porta</Label>
                  <Input type="number" value={smtpForm.smtp_port} onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Segurança</Label>
                  <Select value={smtpForm.smtp_security} onValueChange={(v) => setSmtpForm((p) => ({ ...p, smtp_security: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="ssl">SSL/TLS (porta 465)</SelectItem>
                      <SelectItem value="tls">STARTTLS (porta 587)</SelectItem>
                      <SelectItem value="starttls">STARTTLS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Usuário SMTP</Label>
                  <Input value={smtpForm.smtp_user} onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_user: e.target.value }))} placeholder="usuario@seuservidor.com" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Senha SMTP</Label>
                  <Input type="password" value={smtpForm.smtp_password} onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_password: e.target.value }))} placeholder="••••••••" />
                  <p className="text-xs text-muted-foreground">Alguns provedores exigem senha de aplicativo em vez da senha normal.</p>
                </div>
              </div>

              {settings?.last_test_error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <strong>Último erro:</strong> {settings.last_test_error}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleTestSmtp} disabled={testingSmtp}>
                  {testingSmtp ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...</> : <><Zap className="h-4 w-4 mr-2" /> Testar Conexão</>}
                </Button>
              </div>
            </Card>
          )}

          {/* Status card */}
          <Card className="p-6 bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Status Atual
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Conexão</p>
                <p className="text-sm font-medium mt-1">
                  {smtpForm.smtp_mode === "custom"
                    ? (settings?.is_smtp_validated ? "✅ Ativo" : "⚠️ Não validado")
                    : "✅ Plataforma"
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último Teste</p>
                <p className="text-sm font-medium mt-1">{formatDate(settings?.last_tested_at || null)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último Envio</p>
                <p className="text-sm font-medium mt-1">{formatDate(lastSent?.data_envio || null)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Falhas Recentes</p>
                <p className="text-sm font-medium mt-1">{failedCount > 0 ? `${failedCount} falha(s)` : "Nenhuma"}</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Configurações"}
            </Button>
          </div>
        </TabsContent>

        {/* ━━━━━━━━ TAB 2: TEMPLATES ━━━━━━━━ */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded"><FileText className="h-4 w-4 text-primary" /></div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Templates de E-mail</h3>
                  <p className="text-xs text-muted-foreground">Personalize os e-mails que sua loja envia</p>
                </div>
              </div>
            </div>

            {templatesLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">Evento</TableHead>
                      <TableHead className="hidden md:table-cell">Assunto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
                      <TableHead className="hidden md:table-cell">Origem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TENANT_EMAIL_EVENTS.map((event) => {
                      const tmpl = tenantTemplates.find((t) => t.event_key === event.key);
                      const isCustom = !!tmpl?.subject || !!tmpl?.html_body;
                      return (
                        <TableRow key={event.key}>
                          <TableCell>
                            <div>
                              <span className="font-medium text-sm">{event.label}</span>
                              <p className="text-xs text-muted-foreground hidden sm:block">{event.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="font-mono text-[10px]">{event.key}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[180px] truncate">
                            {tmpl?.subject || <span className="italic">Padrão</span>}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={tmpl?.is_enabled ?? true}
                              onCheckedChange={(v) => toggleTemplate(event.key, v)}
                              disabled={templateSaving}
                            />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {tmpl?.updated_at ? formatDate(tmpl.updated_at) : "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={isCustom ? "default" : "secondary"} className="text-[10px]">
                              {isCustom ? "Personalizado" : "Plataforma"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openTemplateEditor(event.key)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ━━━━━━━━ TAB 3: LOGS DE ENVIO ━━━━━━━━ */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded"><Activity className="h-4 w-4 text-primary" /></div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Logs de Envio</h3>
                <p className="text-xs text-muted-foreground">Histórico detalhado de e-mails enviados</p>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="space-y-1">
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="error">Falha</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Evento</Label>
                <Select value={filters.event} onValueChange={(v) => setFilters(f => ({ ...f, event: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TENANT_EMAIL_EVENTS.map(e => (
                      <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destinatário</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar..." value={filters.recipient} onChange={(e) => setFilters(f => ({ ...f, recipient: e.target.value }))} />
                </div>
              </div>
            </div>

            {logsLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum log de envio encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead className="hidden sm:table-cell">Evento</TableHead>
                      <TableHead className="hidden md:table-cell">Assunto</TableHead>
                      <TableHead className="hidden lg:table-cell">Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Erro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(log.data_envio)}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{log.destinatario}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-[10px] font-mono">{log.template || "—"}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[150px] truncate">{log.subject || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{originLabel(log.provider_source)}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(log.status)} className="text-[10px]">{statusLabel(log.status)}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-destructive max-w-[150px] truncate">{log.erro || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setLogDetail(log)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ━━━━━━━━ TAB 4: SAÚDE DO E-MAIL ━━━━━━━━ */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Server className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">SMTP Atual</p>
                  <p className="text-sm font-semibold">{smtpForm.smtp_mode === "custom" ? "SMTP Próprio" : "Plataforma"}</p>
                </div>
              </div>
              {smtpForm.smtp_mode === "custom" && smtpForm.smtp_host && (
                <p className="text-xs text-muted-foreground font-mono">{smtpForm.smtp_host}:{smtpForm.smtp_port}</p>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  smtpForm.smtp_mode !== "custom" || settings?.is_smtp_validated
                    ? "bg-green-100 dark:bg-green-950" : "bg-amber-100 dark:bg-amber-950"
                }`}>
                  {smtpForm.smtp_mode !== "custom" || settings?.is_smtp_validated
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <AlertTriangle className="h-5 w-5 text-amber-600" />
                  }
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conexão SMTP</p>
                  <p className="text-sm font-semibold">
                    {smtpForm.smtp_mode !== "custom" ? "OK (Plataforma)" : settings?.is_smtp_validated ? "Validado" : "Não validado"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Último Teste</p>
                  <p className="text-sm font-semibold">{formatDate(settings?.last_tested_at || null)}</p>
                </div>
              </div>
              {settings?.last_test_status && (
                <Badge variant={settings.last_test_status === "success" ? "default" : "destructive"} className="text-[10px]">
                  {settings.last_test_status === "success" ? "Sucesso" : "Falha"}
                </Badge>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  successRate >= 90 ? "bg-green-100 dark:bg-green-950" : successRate >= 50 ? "bg-amber-100 dark:bg-amber-950" : "bg-red-100 dark:bg-red-950"
                }`}>
                  <Activity className={`h-5 w-5 ${
                    successRate >= 90 ? "text-green-600" : successRate >= 50 ? "text-amber-600" : "text-red-600"
                  }`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Sucesso (últimos 7 dias)</p>
                  <p className="text-2xl font-bold">{successRate}%</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{sentCount} enviado(s) de {totalCount} total</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  failedCount === 0 ? "bg-green-100 dark:bg-green-950" : "bg-red-100 dark:bg-red-950"
                }`}>
                  {failedCount === 0
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <XCircle className="h-5 w-5 text-red-600" />
                  }
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Falhas Recentes</p>
                  <p className="text-2xl font-bold">{failedCount}</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Último Erro Detectado</p>
                  <p className="text-sm font-medium mt-1 max-w-[200px] truncate">{lastError?.erro || "Nenhum erro recente"}</p>
                </div>
              </div>
              {lastError && (
                <p className="text-xs text-muted-foreground">{formatDate(lastError.data_envio)}</p>
              )}
            </Card>
          </div>

          {/* Quick recommendations */}
          <Card className="p-5 border-dashed bg-muted/20">
            <h4 className="text-sm font-semibold text-foreground mb-2">💡 Dicas para melhorar a entrega</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Configure um domínio de e-mail para aumentar a taxa de entrega</li>
              <li>Verifique se os registros SPF e DKIM estão configurados corretamente</li>
              <li>Use SMTP próprio com TLS habilitado para máxima segurança</li>
              <li>Monitore a aba "Logs" regularmente para identificar falhas</li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ━━━━━━━━ TEMPLATE EDITOR DIALOG ━━━━━━━━ */}
      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Editar Template: {TENANT_EMAIL_EVENTS.find((e) => e.key === editingEvent)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input disabled value={TENANT_EMAIL_EVENTS.find(e => e.key === editingEvent)?.label || ""} />
              </div>
              <div className="space-y-2">
                <Label>Evento</Label>
                <Input disabled value={editingEvent || ""} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assunto do E-mail</Label>
              <Input value={templateForm.subject} onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Deixe vazio para usar o padrão da plataforma" />
            </div>
            <div className="space-y-2">
              <Label>Pré-cabeçalho</Label>
              <Input value={templateForm.pre_header} onChange={(e) => setTemplateForm((p) => ({ ...p, pre_header: e.target.value }))} placeholder="Texto de preview no cliente de e-mail" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conteúdo HTML</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  <Eye className="h-4 w-4 mr-1" /> {showPreview ? "Código" : "Preview"}
                </Button>
              </div>
              {showPreview ? (
                <div className="border rounded-lg p-4 min-h-[200px] bg-white dark:bg-gray-900">
                  <div dangerouslySetInnerHTML={{ __html: templateForm.html_body || '<p style="color:#999">Nenhum conteúdo HTML definido</p>' }} />
                </div>
              ) : (
                <Textarea className="min-h-[200px] font-mono text-xs" value={templateForm.html_body} onChange={(e) => setTemplateForm((p) => ({ ...p, html_body: e.target.value }))} placeholder="<html>...</html>" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Versão Texto Simples</Label>
              <Textarea className="min-h-[80px]" value={templateForm.text_body} onChange={(e) => setTemplateForm((p) => ({ ...p, text_body: e.target.value }))} placeholder="Versão em texto puro do e-mail" />
            </div>

            {/* Variables */}
            {editingEvent && TEMPLATE_VARIABLES[editingEvent] && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Variáveis Disponíveis</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES[editingEvent].map(v => (
                    <Badge key={v} variant="secondary" className="font-mono text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(v);
                        toast.success(`Copiado: ${v}`);
                      }}>
                      {v}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Clique para copiar</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={handleRestoreDefault} className="gap-1">
              <RotateCcw className="h-3 w-3" /> Restaurar Padrão
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancelar</Button>
              <Button onClick={handleSaveTemplate} disabled={templateSaving}>
                {templateSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar Template
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━ LOG DETAIL DIALOG ━━━━━━━━ */}
      <Dialog open={!!logDetail} onOpenChange={() => setLogDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Detalhes do Envio
            </DialogTitle>
          </DialogHeader>
          {logDetail && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Template</p>
                  <p className="font-medium">{TENANT_EMAIL_EVENTS.find(e => e.key === logDetail.template)?.label || logDetail.template || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={statusColor(logDetail.status)} className="mt-1">{statusLabel(logDetail.status)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remetente</p>
                  <p className="font-mono text-xs">{logDetail.email_remetente || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destinatário</p>
                  <p className="font-mono text-xs">{logDetail.destinatario}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Origem do SMTP</p>
                  <p className="font-medium">{originLabel(logDetail.provider_source)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provedor SMTP</p>
                  <p className="font-mono text-xs">{logDetail.smtp_provider || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data de Envio</p>
                  <p className="text-xs">{formatDate(logDetail.data_envio)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assunto</p>
                  <p className="text-xs">{logDetail.subject || "—"}</p>
                </div>
              </div>
              {logDetail.erro && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-xs font-semibold text-destructive mb-1">Erro Técnico</p>
                  <p className="text-xs text-destructive/80 font-mono break-all">{logDetail.erro}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDetail(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
