import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, MoreHorizontal, Pencil, Eye, Copy, RotateCcw, Send, Search, Settings2, FileText, History, Server, Shield } from "lucide-react";
import { useEmailTemplates, DYNAMIC_VARIABLES, type EmailTemplate } from "@/hooks/useEmailTemplates";
import { useEmailSettings } from "@/hooks/useEmailSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ReputationShieldTab } from "./ReputationShieldTab";
import EmailLogsTab from "./EmailLogsTab";

const EmailTemplatesTab = () => {
  const { templates, logs, loading, saving, updateTemplate, duplicateTemplate, logSend } = useEmailTemplates();
  const emailSettings = useEmailSettings();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [editForm, setEditForm] = useState({
    subject: "",
    pre_header: "",
    html_content: "",
    text_content: "",
  });

  // Local form state for sender config
  const [senderForm, setSenderForm] = useState({
    provider: "smtp",
    sender_name: "ShopDrive",
    sender_email: "noreply@shopdrive.com.br",
    reply_to: "suporte@shopdrive.com.br",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_security: "tls",
    allow_tenant_custom_smtp: true,
  });
  const [senderFormLoaded, setSenderFormLoaded] = useState(false);

  // Sync settings into form once loaded
  if (emailSettings.settings && !senderFormLoaded) {
    const s = emailSettings.settings;
    setSenderForm({
      provider: "smtp",
      sender_name: s.sender_name || "ShopDrive",
      sender_email: s.sender_email || "",
      reply_to: s.reply_to || "",
      smtp_host: s.smtp_host || "",
      smtp_port: s.smtp_port || 587,
      smtp_user: s.smtp_user || "",
      smtp_password: s.smtp_password || "",
      smtp_security: s.smtp_security || "tls",
      allow_tenant_custom_smtp: s.allow_tenant_custom_smtp !== false,
    });
    setSenderFormLoaded(true);
  }

  const handleSaveSenderConfig = async () => {
    await emailSettings.saveSettings(senderForm as any);
  };

  const filteredTemplates = templates.filter(
    (t) =>
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.event_trigger.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      subject: template.subject,
      pre_header: template.pre_header,
      html_content: template.html_content,
      text_content: template.text_content,
    });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    const success = await updateTemplate(editingTemplate.id, editForm);
    if (success) setEditingTemplate(null);
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    await updateTemplate(template.id, { is_active: !template.is_active });
  };

  const handleSendTest = async (template: EmailTemplate) => {
    if (!testEmail) {
      toast.error("Informe um e-mail para teste");
      return;
    }
    toast.info(`Envio de teste para ${testEmail} simulado com sucesso!`);
    await logSend(template.id, template.name, testEmail, template.subject, "test_sent");
    setTestEmail("");
  };

  const insertVariable = (variable: string) => {
    setEditForm((prev) => ({
      ...prev,
      html_content: prev.html_content + variable,
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72 mt-2" /></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="templates" className="flex items-center gap-2"><FileText className="h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configuração de Envio</TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2"><History className="h-4 w-4" /> Logs de Envio</TabsTrigger>
          <TabsTrigger value="reputation" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Reputation Shield</TabsTrigger>
        </TabsList>

        {/* Templates List */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-6 w-6 text-[#6a1b9a]" />
                  <div>
                    <CardTitle>Templates de E-mail</CardTitle>
                    <CardDescription>Modelos de e-mail transacionais da plataforma</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar template..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-mono">{template.event_trigger}</Badge></TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{template.subject}</TableCell>
                        <TableCell>
                          <Switch checked={template.is_active} onCheckedChange={() => handleToggleActive(template)} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(template.updated_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPreviewTemplate(template)}>
                                <Eye className="h-4 w-4 mr-2" /> Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
                                <Copy className="h-4 w-4 mr-2" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info("O template será restaurado ao padrão original.")}>
                                <RotateCcw className="h-4 w-4 mr-2" /> Restaurar Padrão
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sender Config */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings2 className="h-6 w-6 text-[#6a1b9a]" />
                <div>
                  <CardTitle>Configuração de Envio</CardTitle>
                  <CardDescription>Remetente e provedor de e-mail da plataforma</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Provedor de E-mail</Label>
                <Select value={senderForm.provider} onValueChange={(v) => setSenderForm((p) => ({ ...p, provider: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend (API)</SelectItem>
                    <SelectItem value="smtp">SMTP Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Sender Info */}
              <div className="space-y-2">
                <Label>Nome do Remetente</Label>
                <Input value={senderForm.sender_name} onChange={(e) => setSenderForm((p) => ({ ...p, sender_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail do Remetente</Label>
                <Input value={senderForm.sender_email} onChange={(e) => setSenderForm((p) => ({ ...p, sender_email: e.target.value }))} placeholder="noreply@seudominio.com.br" />
              </div>
              <div className="space-y-2">
                <Label>E-mail de Resposta (Reply-To)</Label>
                <Input value={senderForm.reply_to} onChange={(e) => setSenderForm((p) => ({ ...p, reply_to: e.target.value }))} placeholder="suporte@seudominio.com.br" />
              </div>

              {/* SMTP Fields */}
              {senderForm.provider === "smtp" && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-semibold">Configuração SMTP</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input value={senderForm.smtp_host} onChange={(e) => setSenderForm((p) => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.seuservidor.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Porta</Label>
                      <Input type="number" value={senderForm.smtp_port} onChange={(e) => setSenderForm((p) => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))} placeholder="587" />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Usuário</Label>
                      <Input value={senderForm.smtp_user} onChange={(e) => setSenderForm((p) => ({ ...p, smtp_user: e.target.value }))} placeholder="usuario@seuservidor.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Senha</Label>
                      <Input type="password" value={senderForm.smtp_password} onChange={(e) => setSenderForm((p) => ({ ...p, smtp_password: e.target.value }))} placeholder="••••••••" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Segurança</Label>
                    <Select value={senderForm.smtp_security} onValueChange={(v) => setSenderForm((p) => ({ ...p, smtp_security: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tls">STARTTLS (porta 587)</SelectItem>
                        <SelectItem value="ssl">SSL/TLS (porta 465)</SelectItem>
                        <SelectItem value="none">Nenhuma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">Provedor ativo</p>
                  <p className="text-sm text-muted-foreground">{senderForm.provider === "smtp" ? "SMTP Personalizado" : "Resend"}</p>
                </div>
                <Badge variant="default">Ativo</Badge>
              </div>

              <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                <p className="font-medium mb-1">Multi-tenant</p>
                <p>As lojas utilizam o mesmo serviço de envio. O header será: <code className="bg-muted px-1 py-0.5 rounded text-xs">From: Loja XYZ via {senderForm.sender_name} &lt;{senderForm.sender_email}&gt;</code></p>
              </div>

              <Button
                className="bg-[#6a1b9a] hover:bg-[#5a1589]"
                onClick={handleSaveSenderConfig}
                disabled={emailSettings.saving}
              >
                {emailSettings.saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Logs */}
        <TabsContent value="logs">
          <EmailLogsTab />
        </TabsContent>

        {/* Reputation Shield */}
        <TabsContent value="reputation">
          <ReputationShieldTab />
        </TabsContent>
      </Tabs>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template: {editingTemplate?.name}</DialogTitle>
            <DialogDescription>Evento: {editingTemplate?.event_trigger}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assunto do E-mail</Label>
                <Input value={editForm.subject} onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pré-header</Label>
                <Input value={editForm.pre_header} onChange={(e) => setEditForm((p) => ({ ...p, pre_header: e.target.value }))} placeholder="Texto exibido antes de abrir o e-mail" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo HTML</Label>
              <Textarea className="min-h-[200px] font-mono text-xs" value={editForm.html_content} onChange={(e) => setEditForm((p) => ({ ...p, html_content: e.target.value }))} placeholder="<html>...</html>" />
            </div>
            <div className="space-y-2">
              <Label>Versão Texto Simples</Label>
              <Textarea className="min-h-[100px]" value={editForm.text_content} onChange={(e) => setEditForm((p) => ({ ...p, text_content: e.target.value }))} placeholder="Versão em texto puro" />
            </div>
            <div className="space-y-2">
              <Label>Variáveis Dinâmicas Disponíveis</Label>
              <div className="flex flex-wrap gap-1">
                {(editingTemplate?.variables || []).map((v: string) => (
                  <Badge key={v} variant="secondary" className="cursor-pointer text-xs hover:bg-[#6a1b9a]/10" onClick={() => insertVariable(`{{${v}}}`)}>
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Input placeholder="E-mail para teste" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="max-w-xs" />
              <Button variant="outline" onClick={() => editingTemplate && handleSendTest(editingTemplate)}>
                <Send className="h-4 w-4 mr-2" /> Enviar Teste
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={saving} className="bg-[#6a1b9a] hover:bg-[#5a1589]">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>Assunto: {previewTemplate?.subject}</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-[#6a1b9a] text-white p-4 text-center">
                  <p className="font-bold text-lg">ShopDrive</p>
                </div>
                <div className="p-6 bg-white text-foreground">
                  <h2 className="text-xl font-semibold mb-4">{previewTemplate.subject}</h2>
                  {previewTemplate.html_content ? (
                    <div dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }} />
                  ) : (
                    <p className="text-muted-foreground italic">Nenhum conteúdo HTML definido para este template.</p>
                  )}
                  <div className="mt-6">
                    <Button className="bg-[#6a1b9a] hover:bg-[#5a1589]">Ação Principal</Button>
                  </div>
                </div>
                <div className="bg-muted p-4 text-center text-xs text-muted-foreground">
                  <p>ShopDrive — Plataforma de E-commerce</p>
                  <p>Este é um e-mail automático. Não responda diretamente.</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesTab;
