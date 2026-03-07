import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Mail, Search, Eye, RotateCcw, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface EmailLog {
  id: string;
  tenant_id: string | null;
  template: string | null;
  destinatario: string;
  email_remetente: string | null;
  bcc_email: string | null;
  subject: string | null;
  status: string;
  erro: string | null;
  smtp_provider: string | null;
  data_envio: string;
  sent_at: string | null;
}

const PAGE_SIZE = 20;

const EmailLogsTab = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [filterEmail, setFilterEmail] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("email_logs")
      .select("*", { count: "exact" })
      .order("data_envio", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }
    if (filterTemplate.trim()) {
      query = query.ilike("template", `%${filterTemplate.trim()}%`);
    }
    if (filterEmail.trim()) {
      query = query.ilike("destinatario", `%${filterEmail.trim()}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("Error fetching email logs:", error);
      toast.error("Erro ao carregar logs");
    } else {
      setLogs((data as any[]) || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, filterStatus, filterTemplate, filterEmail]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterApply = () => {
    setPage(0);
    fetchLogs();
  };

  const handleResend = async (log: EmailLog) => {
    if (!log.destinatario || !log.subject) {
      toast.error("Dados insuficientes para reenviar");
      return;
    }
    const { error } = await supabase.from("email_queue").insert({
      to_email: log.destinatario,
      subject: log.subject || "Reenvio",
      template: log.template,
      tenant_id: log.tenant_id,
      store_name: null,
      html: null,
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("Erro ao reenfileirar e-mail");
    } else {
      toast.success("E-mail adicionado à fila para reenvio");
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      sent: { variant: "default", label: "Enviado" },
      error: { variant: "destructive", label: "Erro" },
      failed: { variant: "destructive", label: "Falhou" },
      blocked: { variant: "destructive", label: "Bloqueado" },
      pending: { variant: "outline", label: "Pendente" },
      retry: { variant: "secondary", label: "Retry" },
    };
    const info = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Logs de Envio de E-mail</CardTitle>
              <CardDescription>Histórico completo de e-mails enviados pela plataforma ({total} registros)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="retry">Retry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Template</label>
              <Input
                placeholder="Filtrar template..."
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Destinatário</label>
              <Input
                placeholder="Filtrar email..."
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleFilterApply}>
              <Search className="h-4 w-4 mr-1" /> Filtrar
            </Button>
          </div>

          {/* Table */}
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum log encontrado.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.data_envio), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.template || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{log.destinatario}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate text-muted-foreground">
                        {log.subject || "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.smtp_provider || "—"}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[150px] truncate">
                        {log.erro || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} title="Ver detalhes">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(log.status === "error" || log.status === "failed") && (
                            <Button variant="ghost" size="sm" onClick={() => handleResend(log)} title="Reenviar">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Envio</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(selectedLog.status)}</div>
                <div><span className="text-muted-foreground">Provedor:</span> {selectedLog.smtp_provider || "—"}</div>
              </div>
              <div><span className="text-muted-foreground">Destinatário:</span> {selectedLog.destinatario}</div>
              <div><span className="text-muted-foreground">Remetente:</span> {selectedLog.email_remetente || "—"}</div>
              <div><span className="text-muted-foreground">BCC:</span> {selectedLog.bcc_email || "—"}</div>
              <div><span className="text-muted-foreground">Assunto:</span> {selectedLog.subject || "—"}</div>
              <div><span className="text-muted-foreground">Template:</span> {selectedLog.template || "—"}</div>
              <div><span className="text-muted-foreground">Tenant ID:</span> {selectedLog.tenant_id || "—"}</div>
              <div><span className="text-muted-foreground">Data envio:</span> {format(new Date(selectedLog.data_envio), "dd/MM/yyyy HH:mm:ss")}</div>
              {selectedLog.sent_at && (
                <div><span className="text-muted-foreground">Enviado em:</span> {format(new Date(selectedLog.sent_at), "dd/MM/yyyy HH:mm:ss")}</div>
              )}
              {selectedLog.erro && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-destructive">Erro</span>
                  </div>
                  <p className="text-destructive text-xs break-all">{selectedLog.erro}</p>
                </div>
              )}
              {(selectedLog.status === "error" || selectedLog.status === "failed") && (
                <Button variant="outline" className="w-full" onClick={() => { handleResend(selectedLog); setSelectedLog(null); }}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reenviar este e-mail
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailLogsTab;
