import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Eye, Loader2, Mail, Search } from "lucide-react";
import { TENANT_EMAIL_EVENTS } from "@/hooks/useTenantEmailTemplates";
import type { TenantEmailLog } from "@/hooks/useTenantEmailLogs";
import { statusColor, statusLabel, originLabel, formatDate } from "./emailHelpers";

interface Props {
  logs: TenantEmailLog[];
  loading: boolean;
  filters: { status: string; event: string; recipient: string; dateFrom: string; dateTo: string };
  setFilters: React.Dispatch<React.SetStateAction<{ status: string; event: string; recipient: string; dateFrom: string; dateTo: string }>>;
}

export const EmailLogsTab = ({ logs, loading, filters, setFilters }: Props) => {
  const [logDetail, setLogDetail] = useState<TenantEmailLog | null>(null);

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
            <Activity className="h-4 w-4 text-primary" />
          </div>
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

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
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

      {/* Log Detail Dialog */}
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
                <div>
                  <p className="text-xs text-muted-foreground">Message ID</p>
                  <p className="font-mono text-xs">{logDetail.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enviado em</p>
                  <p className="text-xs">{formatDate(logDetail.sent_at)}</p>
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
    </>
  );
};
