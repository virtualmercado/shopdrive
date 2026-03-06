import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Shield, RefreshCw, Unlock, RotateCcw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TenantMetrics {
  id: string;
  tenant_id: string;
  emails_last_hour: number;
  emails_last_day: number;
  bounce_rate: number;
  error_rate: number;
  total_sent: number;
  total_errors: number;
  total_bounces: number;
  last_email_sent_at: string | null;
  status: string;
  blocked_reason: string | null;
  updated_at: string;
}

interface TenantWithName extends TenantMetrics {
  store_name?: string;
}

export const ReputationShieldTab = () => {
  const [metrics, setMetrics] = useState<TenantWithName[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenant_email_metrics" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const items = (data || []) as unknown as TenantMetrics[];

      // Fetch store names
      if (items.length > 0) {
        const tenantIds = items.map((m) => m.tenant_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, store_name, full_name")
          .in("id", tenantIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.id, p.store_name || p.full_name || "Sem nome"])
        );

        setMetrics(
          items.map((m) => ({
            ...m,
            store_name: profileMap.get(m.tenant_id) || m.tenant_id.substring(0, 8),
          }))
        );
      } else {
        setMetrics([]);
      }
    } catch (err) {
      console.error("Error fetching email metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleUnblock = async (tenantId: string) => {
    const { error } = await supabase
      .from("tenant_email_metrics" as any)
      .update({ status: "active", blocked_reason: null } as any)
      .eq("tenant_id", tenantId);

    if (error) {
      toast.error("Erro ao desbloquear");
      return;
    }
    toast.success("Loja desbloqueada!");
    fetchMetrics();
  };

  const handleReset = async (tenantId: string) => {
    const { error } = await supabase
      .from("tenant_email_metrics" as any)
      .update({
        emails_last_hour: 0,
        emails_last_day: 0,
        bounce_rate: 0,
        error_rate: 0,
        total_sent: 0,
        total_errors: 0,
        total_bounces: 0,
        status: "active",
        blocked_reason: null,
        last_hour_reset_at: new Date().toISOString(),
        last_day_reset_at: new Date().toISOString(),
      } as any)
      .eq("tenant_id", tenantId);

    if (error) {
      toast.error("Erro ao resetar métricas");
      return;
    }
    toast.success("Métricas resetadas!");
    fetchMetrics();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Ativo</Badge>;
      case "limited":
        return <Badge variant="secondary">Limitado</Badge>;
      case "blocked":
        return <Badge variant="destructive">Bloqueado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const blockedCount = metrics.filter((m) => m.status === "blocked").length;
  const limitedCount = metrics.filter((m) => m.status === "limited").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Email Reputation Shield</CardTitle>
              <CardDescription>Proteção contra spam e uso abusivo por tenants</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold">{metrics.length}</p>
            <p className="text-xs text-muted-foreground">Tenants monitorados</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold">{metrics.reduce((s, m) => s + m.total_sent, 0)}</p>
            <p className="text-xs text-muted-foreground">Total enviados</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold">{limitedCount}</p>
            <p className="text-xs text-muted-foreground">Limitados</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
            <p className="text-xs text-muted-foreground">Bloqueados</p>
          </div>
        </div>

        {blockedCount > 0 && (
          <div className="flex items-start gap-2 p-3 border border-destructive/30 bg-destructive/5 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">
              {blockedCount} loja(s) bloqueada(s) por exceder limites de reputação.
            </p>
          </div>
        )}

        {/* Metrics Table */}
        {metrics.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-center">Hora</TableHead>
                  <TableHead className="text-center">Dia</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Erros %</TableHead>
                  <TableHead className="text-center">Bounce %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Envio</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.store_name}</TableCell>
                    <TableCell className="text-center">{m.emails_last_hour}</TableCell>
                    <TableCell className="text-center">{m.emails_last_day}</TableCell>
                    <TableCell className="text-center">{m.total_sent}</TableCell>
                    <TableCell className="text-center">{m.error_rate}%</TableCell>
                    <TableCell className="text-center">{m.bounce_rate}%</TableCell>
                    <TableCell>{getStatusBadge(m.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.last_email_sent_at
                        ? format(new Date(m.last_email_sent_at), "dd/MM HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {m.status === "blocked" && (
                          <Button variant="ghost" size="sm" onClick={() => handleUnblock(m.tenant_id)} title="Desbloquear">
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleReset(m.tenant_id)} title="Resetar métricas">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum tenant com métricas de envio registradas.
          </p>
        )}

        {/* Limits Info */}
        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Limites configurados:</p>
          <p>• 100 emails/hora por loja</p>
          <p>• 1.000 emails/dia por loja</p>
          <p>• Taxa de erro &gt; 20% → bloqueio</p>
          <p>• Taxa de bounce &gt; 10% → bloqueio</p>
        </div>
      </CardContent>
    </Card>
  );
};
