import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, PowerOff, Globe, AlertCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAdminDomains } from "@/hooks/useMerchantDomain";
import { customDomainStateLabel } from "@/lib/customDomainStatus";

interface StoreDomainTabProps { storeId: string }

const fmt = (v?: string | null) => (v ? format(new Date(v), "dd/MM/yyyy HH:mm") : "-");
const mask = (v?: string | null) => (v ? `${v.slice(0, 4)}…${v.slice(-4)}` : "-");

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div className="text-sm">{children}</div>
  </div>
);

export const StoreDomainTab = ({ storeId }: StoreDomainTabProps) => {
  const { domain, logs, access, isLoading, verifyDns, disconnect, setPilotAccess } = useAdminDomains(storeId);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const isV2 = domain?.flow_version === 2;
  const state = isV2 ? domain?.v2_state : "needs_reverification";
  const result = (domain?.last_verification_result ?? null) as { provider?: { name: string } | null; ownership?: string; root?: string; www?: string } | null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium">Domínios próprios V2</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={access?.featureEnabled ? "default" : "secondary"}>Recurso global: {access?.featureEnabled ? "ligado" : "desligado"}</Badge>
          <Badge variant={access?.ingressReady ? "default" : "secondary"}>Infraestrutura: {access?.ingressReady ? access.provider : "não configurada"}</Badge>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={!!access?.storeEnabled} onCheckedChange={(v) => setPilotAccess.mutate(v)} disabled={setPilotAccess.isPending} />
          Liberar domínio próprio para esta loja (piloto)
        </label>
        {!access?.featureEnabled && <p className="text-xs text-muted-foreground">Enquanto o recurso global estiver desligado, a loja continua vendo "Domínio próprio temporariamente indisponível".</p>}
      </div>

      {!domain ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Globe className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Nenhum domínio configurado</p>
        </div>
      ) : (
        <>
          {!isV2 && (
            <div className="flex items-start gap-2 rounded bg-muted p-3 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Cadastro do fluxo antigo (simulado). Não é considerado válido nem roteado — reconfiguração necessária.</span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Domínio"><span className="font-mono">{domain.normalized_domain ?? domain.domain}</span></Field>
            <Field label="Status"><Badge variant="outline">{customDomainStateLabel(state)}</Badge></Field>
            <Field label="Propriedade (TXT)">{domain.ownership_verified_at ? `Confirmada em ${fmt(domain.ownership_verified_at)}` : result?.ownership ?? "Não verificada"}</Field>
            <Field label="Provedor DNS">{result?.provider?.name ?? domain.dns_provider ?? "-"}</Field>
            <Field label="DNS">{domain.dns_verified_at ? `Verificado em ${fmt(domain.dns_verified_at)}` : `raiz: ${result?.root ?? "-"} · www: ${result?.www ?? "-"}`}</Field>
            <Field label="Roteamento">{domain.routing_status}</Field>
            <Field label="SSL">{isV2 ? domain.ssl_status : "não emitido"}</Field>
            <Field label="Última verificação">{fmt(domain.last_dns_check)}</Field>
            <Field label="ID externo">{mask(domain.external_hostname_id)}</Field>
            <Field label="Nameservers"><span className="font-mono text-xs">{(domain.detected_nameservers ?? []).join(", ") || "-"}</span></Field>
            <Field label="Falhas consecutivas">{domain.consecutive_dns_failures}</Field>
            <Field label="Desconectado">{fmt(domain.disconnected_at)}</Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => verifyDns.mutate()} disabled={verifyDns.isPending || !!domain.released_at}>
              <RefreshCw className="h-4 w-4 mr-2" /> Verificar DNS novamente
            </Button>
            {!domain.released_at && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={disconnect.isPending}><PowerOff className="h-4 w-4 mr-2" /> Desconectar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar domínio</AlertDialogTitle>
                    <AlertDialogDescription>
                      O domínio <strong>{domain.normalized_domain ?? domain.domain}</strong> deixará de ser associado a esta loja, que continuará no endereço ShopDrive. O histórico é preservado e o DNS do lojista não é alterado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => disconnect.mutate()}>Desconectar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Reprocessar SSL ficará disponível somente quando houver infraestrutura real de certificados conectada.</p>

          {logs && logs.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Histórico de verificações</h4>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Resultado</TableHead><TableHead>Origem</TableHead><TableHead>Observado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{fmt(l.created_at)}</TableCell>
                      <TableCell className="text-xs">{l.verification_type}</TableCell>
                      <TableCell className="text-xs">{l.status}</TableCell>
                      <TableCell className="text-xs">{l.source?.startsWith("admin") ? "Master" : l.source ?? "-"}</TableCell>
                      <TableCell className="text-xs font-mono max-w-[200px] truncate">{l.found_value ?? l.error_message ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
