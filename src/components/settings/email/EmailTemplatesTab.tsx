import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Pencil, Eye, RotateCcw, Loader2, Send } from "lucide-react";
import { TENANT_EMAIL_EVENTS, TEMPLATE_VARIABLES, type TenantEmailTemplate } from "@/hooks/useTenantEmailTemplates";
import { formatDate } from "./emailHelpers";
import { toast } from "sonner";

interface Props {
  templates: TenantEmailTemplate[];
  loading: boolean;
  saving: boolean;
  upsertTemplate: (eventKey: string, updates: Partial<TenantEmailTemplate>) => Promise<boolean>;
  toggleTemplate: (eventKey: string, enabled: boolean) => Promise<boolean>;
}

export const EmailTemplatesTab = ({ templates, loading, saving, upsertTemplate, toggleTemplate }: Props) => {
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    subject: "", html_body: "", text_body: "", pre_header: "",
  });
  const [showPreview, setShowPreview] = useState(false);

  const openEditor = (eventKey: string) => {
    const existing = templates.find((t) => t.event_key === eventKey);
    setTemplateForm({
      subject: existing?.subject || "",
      html_body: existing?.html_body || "",
      text_body: existing?.text_body || "",
      pre_header: "",
    });
    setShowPreview(false);
    setEditingEvent(eventKey);
  };

  const handleSave = async () => {
    if (!editingEvent) return;
    const success = await upsertTemplate(editingEvent, {
      subject: templateForm.subject,
      html_body: templateForm.html_body,
      text_body: templateForm.text_body,
    });
    if (success) setEditingEvent(null);
  };

  const handleRestore = () => {
    setTemplateForm({ subject: "", html_body: "", text_body: "", pre_header: "" });
    toast.info("Template restaurado ao padrão da plataforma. Salve para confirmar.");
  };

  const handleSendTest = () => {
    toast.info("Funcionalidade de envio de teste será implementada em breve.");
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Templates de E-mail</h3>
              <p className="text-xs text-muted-foreground">Personalize os e-mails que sua loja envia</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
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
                  const tmpl = templates.find((t) => t.event_key === event.key);
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
                          disabled={saving}
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
                        <Button variant="ghost" size="sm" onClick={() => openEditor(event.key)}>
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

      {/* Template Editor Dialog */}
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRestore} className="gap-1">
                <RotateCcw className="h-3 w-3" /> Restaurar Padrão
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendTest} className="gap-1">
                <Send className="h-3 w-3" /> Enviar Teste
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar Template
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
