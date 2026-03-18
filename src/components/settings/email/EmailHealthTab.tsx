import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Server, CheckCircle2, XCircle, AlertCircle, AlertTriangle,
  Activity, Clock, Shield,
} from "lucide-react";
import { formatDate } from "./emailHelpers";
import type { TenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import type { TenantEmailLog } from "@/hooks/useTenantEmailLogs";

interface Props {
  settings: TenantEmailSettings | null;
  smtpMode: string;
  smtpHost: string;
  smtpPort: number;
  logs: TenantEmailLog[];
}

export const EmailHealthTab = ({ settings, smtpMode, smtpHost, smtpPort, logs }: Props) => {
  const recentLogs = logs.slice(0, 100);
  const sentCount = recentLogs.filter(l => l.status === "sent" || l.status === "success").length;
  const failedCount = recentLogs.filter(l => l.status === "error" || l.status === "failed" || l.status === "dlq").length;
  const totalCount = recentLogs.length;
  const successRate = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;
  const lastError = recentLogs.find(l => l.status === "error" || l.status === "failed");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SMTP Atual</p>
              <p className="text-sm font-semibold">{smtpMode === "custom" ? "SMTP Próprio" : "Plataforma"}</p>
            </div>
          </div>
          {smtpMode === "custom" && smtpHost && (
            <p className="text-xs text-muted-foreground font-mono">{smtpHost}:{smtpPort}</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              smtpMode !== "custom" || settings?.is_smtp_validated
                ? "bg-green-100 dark:bg-green-950" : "bg-amber-100 dark:bg-amber-950"
            }`}>
              {smtpMode !== "custom" || settings?.is_smtp_validated
                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                : <AlertTriangle className="h-5 w-5 text-amber-600" />
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conexão SMTP</p>
              <p className="text-sm font-semibold">
                {smtpMode !== "custom" ? "OK (Plataforma)" : settings?.is_smtp_validated ? "Validado" : "Não validado"}
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

      <Card className="p-5 border-dashed bg-muted/20">
        <h4 className="text-sm font-semibold text-foreground mb-2">💡 Dicas para melhorar a entrega</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Configure um domínio de e-mail para aumentar a taxa de entrega</li>
          <li>Verifique se os registros SPF e DKIM estão configurados corretamente</li>
          <li>Use SMTP próprio com TLS habilitado para máxima segurança</li>
          <li>Monitore a aba "Logs" regularmente para identificar falhas</li>
        </ul>
      </Card>
    </div>
  );
};
