import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mail, CheckCircle2, XCircle, AlertCircle, Loader2, Server,
  Zap, Send, Activity, AlertTriangle, Clock,
} from "lucide-react";
import { PASSWORD_MASK, formatDate } from "./emailHelpers";
import type { TenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import type { TenantEmailLog } from "@/hooks/useTenantEmailLogs";

interface Props {
  settings: TenantEmailSettings | null;
  saving: boolean;
  testingSmtp: boolean;
  form: { sender_name: string; sender_email: string; reply_to: string };
  setForm: React.Dispatch<React.SetStateAction<{ sender_name: string; sender_email: string; reply_to: string }>>;
  smtpForm: {
    smtp_mode: string; smtp_host: string; smtp_port: number;
    smtp_user: string; smtp_password: string; smtp_security: string;
  };
  setSmtpForm: React.Dispatch<React.SetStateAction<{
    smtp_mode: string; smtp_host: string; smtp_port: number;
    smtp_user: string; smtp_password: string; smtp_security: string;
  }>>;
  onSave: () => void;
  onTestSmtp: () => void;
  lastSent: TenantEmailLog | undefined;
  failedCount: number;
}

export const EmailConfigTab = ({
  settings, saving, testingSmtp, form, setForm,
  smtpForm, setSmtpForm, onSave, onTestSmtp, lastSent, failedCount,
}: Props) => {
  return (
    <div className="space-y-4">
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
            <Button variant="outline" onClick={onTestSmtp} disabled={testingSmtp}>
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
        <Button onClick={onSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};
