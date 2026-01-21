import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Shield,
  PowerOff,
  Trash2,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useAdminDomains } from "@/hooks/useMerchantDomain";

interface StoreDomainTabProps {
  storeId: string;
}

export const StoreDomainTab = ({ storeId }: StoreDomainTabProps) => {
  const {
    domain,
    logs,
    isLoading,
    forceVerifyDns,
    reprocessSsl,
    adminDeactivateDomain,
    adminRemoveDomain,
  } = useAdminDomains(storeId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Ativo</Badge>;
      case 'verifying':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Verificando</Badge>;
      case 'dns_error':
        return <Badge variant="destructive">Erro DNS</Badge>;
      case 'ssl_provisioning':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">SSL Provisionando</Badge>;
      case 'ssl_error':
        return <Badge variant="destructive">Erro SSL</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'pending':
        return <Badge variant="outline">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSslStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Ativo</Badge>;
      case 'provisioning':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Provisionando</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Pendente'}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Globe className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Nenhum domínio configurado</p>
        <p className="text-sm text-muted-foreground">
          Este lojista ainda não configurou um domínio próprio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain Info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Domínio</p>
          <p className="text-base font-mono">{domain.domain}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Tipo</p>
          <p className="text-base">
            {domain.domain_type === 'subdomain' ? 'Subdomínio (www)' : 'Domínio raiz'}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          {getStatusBadge(domain.status)}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status SSL</p>
          {getSslStatusBadge(domain.ssl_status)}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Última Verificação DNS</p>
          <p className="text-sm">
            {domain.last_dns_check 
              ? format(new Date(domain.last_dns_check), "dd/MM/yyyy 'às' HH:mm") 
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Redirecionamento Ativo</p>
          <p className="text-sm">
            {domain.redirect_old_link ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Sim
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-4 w-4" /> Não
              </span>
            )}
          </p>
        </div>
      </div>

      {/* DNS Verification Status */}
      <div className="p-4 border rounded-lg space-y-2">
        <h4 className="font-medium">Status da Verificação DNS</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {domain.dns_cname_verified ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">CNAME (www → {domain.expected_cname})</span>
          </div>
          <div className="flex items-center gap-2">
            {domain.dns_a_verified ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">Registro A (@ → {domain.expected_ip})</span>
          </div>
        </div>
        {domain.dns_error_message && (
          <div className="flex items-start gap-2 p-2 bg-red-50 text-red-800 rounded text-sm mt-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{domain.dns_error_message}</span>
          </div>
        )}
      </div>

      {/* Admin Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => forceVerifyDns.mutate()}
          disabled={forceVerifyDns.isPending}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Forçar Verificação DNS
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reprocessSsl.mutate()}
          disabled={reprocessSsl.isPending}
        >
          <Shield className="h-4 w-4 mr-2" />
          Reprocessar SSL
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => adminDeactivateDomain.mutate()}
          disabled={adminDeactivateDomain.isPending || !domain.is_active}
        >
          <PowerOff className="h-4 w-4 mr-2" />
          Desativar Domínio
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => {
            if (confirm('Tem certeza que deseja remover o domínio deste lojista?')) {
              adminRemoveDomain.mutate();
            }
          }}
          disabled={adminRemoveDomain.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remover Domínio
        </Button>
      </div>

      {/* Verification Logs */}
      <div>
        <h4 className="font-medium mb-2">Logs de Verificação</h4>
        {logs && logs.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">
                        {log.verification_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'secondary'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.error_message || log.expected_value || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum log de verificação disponível
          </p>
        )}
      </div>
    </div>
  );
};
