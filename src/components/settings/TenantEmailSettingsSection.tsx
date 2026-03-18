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
  Mail, Globe, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Copy, CloudCog, Loader2, Server, Zap, FileText, Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import { useTenantEmailTemplates, TENANT_EMAIL_EVENTS, type TenantEmailTemplate } from "@/hooks/useTenantEmailTemplates";
import { toast } from "sonner";

const PASSWORD_MASK = "••••••••";

export const TenantEmailSettingsSection = () => {
  const {
    settings, dnsRecords, loading, saving, verifying, testingSmtp,
    saveSettings, saveSmtpConfig, testSmtp, verifyDomain,
    createCloudflareRecords, removeCloudflareRecords,
  } = useTenantEmailSettings();

  const {
    templates: tenantTemplates, loading: templatesLoading, saving: templateSaving,
    upsertTemplate, toggleTemplate,
  } = useTenantEmailTemplates();

  const [form, setForm] = useState({
    sender_name: "", sender_email: "", reply_to: "", email_domain: "",
  });
  const [smtpForm, setSmtpForm] = useState({
    smtp_mode: "platform" as string,
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_security: "tls",
  });
  const [cloudflareZoneId, setCloudflareZoneId] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ subject: "", html_body: "", text_body: "" });

  // Sync form with loaded settings
  if (settings && !initialized) {
    setForm({
      sender_name: settings.sender_name || "",
      sender_email: settings.sender_email || "",
      reply_to: settings.reply_to || "",
      email_domain: settings.email_domain || "",
    });
    setSmtpForm({
      smtp_mode: settings.smtp_mode || "platform",
      smtp_host: settings.smtp_host || "",
      smtp_port: settings.smtp_port || 587,
      smtp_user: settings.smtp_user || "",
      smtp_password: settings.smtp_password ? PASSWORD_MASK : "",
      smtp_security: settings.smtp_security || "tls",
    });
    setCloudflareZoneId(settings.cloudflare_zone_id || "");
    setInitialized(true);
  }

  const handleSave = async () => {
    await saveSettings({
      sender_name: form.sender_name,
      sender_email: form.sender_email,
      reply_to: form.reply_to,
      email_domain: form.email_domain,
    });
  };

  const handleSaveSmtp = async () => {
    await saveSmtpConfig({
      smtp_mode: smtpForm.smtp_mode,
      smtp_host: smtpForm.smtp_host,
      smtp_port: smtpForm.smtp_port,
      smtp_user: smtpForm.smtp_user,
      smtp_password: smtpForm.smtp_password,
      smtp_security: smtpForm.smtp_security,
      sender_name: form.sender_name,
      sender_email: form.sender_email,
      reply_to: form.reply_to,
    });
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const getSmtpStatusBadge = () => {
    if (smtpForm.smtp_mode !== "custom") return null;
    if (settings?.is_smtp_validated) {
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Validado</Badge>;
    }
    if (settings?.last_test_status === "error") {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
    }
    return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" /> Não validado</Badge>;
  };

  const getStatusBadge = () => {
    if (!settings || !settings.email_domain) return null;
    switch (settings.domain_status) {
      case "verified": return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Verificado</Badge>;
      case "verifying": return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" /> Verificando</Badge>;
      default: return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Não verificado</Badge>;
    }
  };

  const openTemplateEditor = (eventKey: string) => {
    const existing = tenantTemplates.find((t) => t.event_key === eventKey);
    setTemplateForm({
      subject: existing?.subject || "",
      html_body: existing?.html_body || "",
      text_body: existing?.text_body || "",
    });
    setEditingEvent(eventKey);
  };

  const handleSaveTemplate = async () => {
    if (!editingEvent) return;
    const success = await upsertTemplate(editingEvent, templateForm);
    if (success) setEditingEvent(null);
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

  const dnsEntries = settings?.email_domain
    ? [
        { type: "TXT", name: settings.email_domain, value: settings.spf_record || `v=spf1 include:shopdrive.com.br ~all`, label: "SPF", verified: settings.spf_verified },
        { type: "TXT", name: `shopdrive._domainkey.${settings.email_domain}`, value: settings.dkim_record || "(chave DKIM)", label: "DKIM", verified: settings.dkim_verified },
        { type: "TXT", name: `_dmarc.${settings.email_domain}`, value: settings.dmarc_record || `v=DMARC1; p=quarantine`, label: "DMARC", verified: settings.dmarc_verified },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="config" className="flex items-center gap-2"><Mail className="h-4 w-4" /> Configuração</TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2"><Server className="h-4 w-4" /> Modo de Envio</TabsTrigger>
          <TabsTrigger value="dns" className="flex items-center gap-2"><Globe className="h-4 w-4" /> DNS</TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2"><FileText className="h-4 w-4" /> Templates</TabsTrigger>
        </TabsList>

        {/* Email Config Tab */}
        <TabsContent value="config">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Email da Loja</h2>
              {getStatusBadge()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do remetente</Label>
                <Input placeholder="Moda da Ana" value={form.sender_name} onChange={(e) => setForm((p) => ({ ...p, sender_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email remetente</Label>
                <Input type="email" placeholder="contato@lojadaana.com.br" value={form.sender_email} onChange={(e) => setForm((p) => ({ ...p, sender_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email de resposta</Label>
                <Input type="email" placeholder="suporte@lojadaana.com.br" value={form.reply_to} onChange={(e) => setForm((p) => ({ ...p, reply_to: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Domínio do email</Label>
                <Input placeholder="lojadaana.com.br" value={form.email_domain} onChange={(e) => setForm((p) => ({ ...p, email_domain: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end mt-4 gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Configurações"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* SMTP Mode Tab */}
        <TabsContent value="smtp">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
                <Server className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Modo de Envio</h2>
              {getSmtpStatusBadge()}
            </div>

            <RadioGroup value={smtpForm.smtp_mode} onValueChange={(v) => setSmtpForm((p) => ({ ...p, smtp_mode: v }))} className="space-y-4 mb-6">
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="platform" id="mode-platform" className="mt-1" />
                <div>
                  <Label htmlFor="mode-platform" className="text-sm font-medium cursor-pointer">Usar e-mail padrão da plataforma</Label>
                  <p className="text-xs text-muted-foreground mt-1">Seus e-mails serão enviados pelo SMTP configurado pela ShopDrive. Sem necessidade de configuração adicional.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="custom" id="mode-custom" className="mt-1" />
                <div>
                  <Label htmlFor="mode-custom" className="text-sm font-medium cursor-pointer">Usar meu próprio SMTP</Label>
                  <p className="text-xs text-muted-foreground mt-1">Configure seu próprio servidor SMTP para enviar e-mails diretamente do seu domínio.</p>
                </div>
              </div>
            </RadioGroup>

            {smtpForm.smtp_mode === "custom" && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-semibold">Configuração SMTP Personalizado</p>
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
                    <Label>SMTP Usuário</Label>
                    <Input value={smtpForm.smtp_user} onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_user: e.target.value }))} placeholder="usuario@seuservidor.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Senha</Label>
                    <Input type="password" value={smtpForm.smtp_password} onChange={(e) => setSmtpForm((p) => ({ ...p, smtp_password: e.target.value }))} placeholder="••••••••" />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Segurança</Label>
                  <Select value={smtpForm.smtp_security} onValueChange={(v) => setSmtpForm((p) => ({ ...p, smtp_security: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">STARTTLS (porta 587)</SelectItem>
                      <SelectItem value="ssl">SSL/TLS (porta 465)</SelectItem>
                      <SelectItem value="none">Nenhuma</SelectItem>
                    </SelectContent>
                  </Select>
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
              </>
            )}

            <div className="flex justify-end mt-6">
              <Button onClick={handleSaveSmtp} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Modo de Envio"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* DNS Tab */}
        <TabsContent value="dns">
          {settings?.email_domain ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded"><Globe className="h-4 w-4 text-primary" /></div>
                  <h2 className="text-lg font-semibold text-foreground">Registros DNS</h2>
                </div>
                <Button variant="outline" size="sm" onClick={verifyDomain} disabled={verifying}>
                  {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Verificar Domínio
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Adicione os registros abaixo no DNS do seu domínio.</p>
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dnsEntries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Badge variant="outline" className="font-mono text-xs">{entry.type}</Badge></TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">{entry.name}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[300px] truncate">{entry.value}</TableCell>
                        <TableCell>{entry.verified ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => copyToClipboard(entry.value)}><Copy className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator className="my-6" />
              <div className="space-y-4">
                <div className="flex items-center gap-2"><CloudCog className="h-5 w-5 text-muted-foreground" /><h3 className="font-medium">Integração com Cloudflare (opcional)</h3></div>
                <div className="flex gap-2 max-w-md">
                  <Input placeholder="Zone ID do Cloudflare" value={cloudflareZoneId} onChange={(e) => setCloudflareZoneId(e.target.value)} />
                  <Button variant="outline" onClick={() => { if (!cloudflareZoneId.trim()) { toast.error("Informe o Zone ID"); return; } createCloudflareRecords(cloudflareZoneId.trim()); }}>Criar Registros</Button>
                </div>
              </div>

              {dnsRecords.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Registros criados no Cloudflare</h3>
                    <Button variant="destructive" size="sm" onClick={removeCloudflareRecords}>Remover Todos</Button>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Record ID</TableHead><TableHead>Comentário</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {dnsRecords.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{r.record_type}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{r.record_name}</TableCell>
                            <TableCell className="font-mono text-xs">{r.record_id_cloudflare}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{r.record_comment || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Configure um domínio de e-mail na aba "Configuração" para ver os registros DNS.</p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded"><FileText className="h-4 w-4 text-primary" /></div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Templates Personalizados</h2>
                <p className="text-xs text-muted-foreground">Personalize os e-mails enviados pela sua loja</p>
              </div>
            </div>

            {templatesLoading ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Assunto Personalizado</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TENANT_EMAIL_EVENTS.map((event) => {
                      const tmpl = tenantTemplates.find((t) => t.event_key === event.key);
                      return (
                        <TableRow key={event.key}>
                          <TableCell className="font-medium">{event.label}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                            {tmpl?.subject || <span className="italic">Padrão da plataforma</span>}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={tmpl?.is_enabled ?? true}
                              onCheckedChange={(v) => toggleTemplate(event.key, v)}
                              disabled={templateSaving}
                            />
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
      </Tabs>

      {/* Info Card */}
      <Card className="p-4 bg-muted/50 border-dashed">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como funciona?</p>
            <p>
              {smtpForm.smtp_mode === "custom" && settings?.is_smtp_validated
                ? <>Seus e-mails são enviados pelo seu SMTP próprio: <strong>{form.sender_name || "Sua Loja"} &lt;{form.sender_email || "contato@seudominio.com.br"}&gt;</strong></>
                : <>Seus e-mails são enviados pelo SMTP da plataforma: <strong>{form.sender_name || "Sua Loja"} via ShopDrive &lt;no-reply@shopdrive.com.br&gt;</strong></>
              }
            </p>
          </div>
        </div>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template: {TENANT_EMAIL_EVENTS.find((e) => e.key === editingEvent)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assunto do E-mail</Label>
              <Input value={templateForm.subject} onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Deixe vazio para usar o padrão da plataforma" />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo HTML</Label>
              <Textarea className="min-h-[180px] font-mono text-xs" value={templateForm.html_body} onChange={(e) => setTemplateForm((p) => ({ ...p, html_body: e.target.value }))} placeholder="<html>...</html>" />
            </div>
            <div className="space-y-2">
              <Label>Versão Texto Simples</Label>
              <Textarea className="min-h-[80px]" value={templateForm.text_body} onChange={(e) => setTemplateForm((p) => ({ ...p, text_body: e.target.value }))} placeholder="Versão em texto puro" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={templateSaving}>
              {templateSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
