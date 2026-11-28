import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { asaasDocumentGuidance, type AsaasAreaStatus, type AsaasMerchantStatus } from "@/lib/asaasAccountStatus";
import { AlertTriangle, Check, CheckCircle2, Clock3, FileWarning, RefreshCw, ShieldCheck } from "lucide-react";

const STATUS_CONTENT = {
  active: {
    title: "Conta Asaas aprovada",
    description: "Sua conta Asaas está ativa e seu cadastro foi aprovado no ambiente Sandbox.",
  },
  awaiting_documents: {
    title: "Documentação pendente",
    description: "O cadastro ainda exige documentos. A conta não está aprovada e nenhuma ação operacional está liberada.",
  },
  under_review: {
    title: "Análise cadastral em andamento",
    description: "O Asaas ainda está analisando o cadastro. Aguarde a sincronização dos próximos eventos oficiais.",
  },
  rejected: {
    title: "Cadastro rejeitado",
    description: "A aprovação geral não foi concedida. Nenhuma operação está habilitada; a orientação documental depende de validação oficial.",
  },
  communication_failed: {
    title: "Falha de comunicação",
    description: "A última sincronização não foi concluída. O estado exibido é apenas o último registro persistido e não libera operações.",
  },
  reconciliation_required: {
    title: "Reconciliação administrativa necessária",
    description: "Os dados persistidos exigem conferência administrativa antes de qualquer nova etapa.",
  },
  unavailable: {
    title: "Situação cadastral indisponível",
    description: "Não foi possível confirmar uma situação cadastral consistente. Tente consultar novamente ou acione o suporte.",
  },
  no_account: {
    title: "Nenhuma conta Asaas vinculada",
    description: "Esta loja ainda não possui uma subconta vinculada. A abertura de outra conta não está disponível nesta fase.",
  },
} as const;

const AREA_LABELS = {
  commercial: "Informações comerciais",
  bank: "Informações bancárias",
  document: "Documentação",
  general: "Aprovação geral",
} as const;

function areaStatusLabel(status: AsaasAreaStatus): string {
  if (status === "APPROVED") return "Aprovada";
  if (status === "REJECTED") return "Rejeitada";
  if (status === "PENDING") return "Pendente";
  return "Em análise";
}

function formatLastSync(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AsaasDocumentGuidance({ hasOfficialOnboardingUrl = false }: { hasOfficialOnboardingUrl?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <FileWarning className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Orientação documental
      </div>
      <p className="text-sm text-muted-foreground">{asaasDocumentGuidance(hasOfficialOnboardingUrl)}</p>
      <p className="text-xs text-muted-foreground">
        Envio de documentos, reconhecimento facial e redirecionamento documental permanecem desabilitados nesta etapa.
      </p>
    </div>
  );
}

export function AsaasAccountStatusPanel({
  status,
  onRetry,
  hasOfficialOnboardingUrl = false,
}: {
  status: AsaasMerchantStatus;
  onRetry?: () => void;
  hasOfficialOnboardingUrl?: boolean;
}) {
  const content = STATUS_CONTENT[status.state];
  const account = status.account;
  const approved = status.state === "active";
  const areas = account ? [
    { key: "commercial", label: AREA_LABELS.commercial, value: account.commercialStatus },
    { key: "bank", label: AREA_LABELS.bank, value: account.bankAccountStatus },
    { key: "document", label: AREA_LABELS.document, value: account.documentStatus },
    { key: "general", label: AREA_LABELS.general, value: account.generalApprovalStatus },
  ] : [];

  return (
    <Card data-testid="asaas-account-status-panel" data-status={status.state}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {approved ? <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
            <CardTitle className="text-lg">{content.title}</CardTitle>
          </div>
          <CardDescription>{content.description}</CardDescription>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
          Ambiente Sandbox
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        {approved && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-primary/5 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Jornada de ativação concluída</p>
              <p className="text-xs text-muted-foreground">As quatro áreas cadastrais foram aprovadas e sincronizadas.</p>
            </div>
          </div>
        )}

        {account && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {areas.map((area) => (
              <div key={area.key} className="rounded-lg border border-border p-4 flex items-start justify-between gap-3">
                <div>
                  <dt className="text-sm font-medium text-foreground">{area.label}</dt>
                  <dd className="text-xs text-muted-foreground mt-1">Situação sincronizada pelo backend</dd>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground shrink-0">
                  {area.value === "APPROVED" ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                  {areaStatusLabel(area.value)}
                </span>
              </div>
            ))}
          </dl>
        )}

        {(status.state === "awaiting_documents" || status.state === "rejected") && (
          <AsaasDocumentGuidance hasOfficialOnboardingUrl={hasOfficialOnboardingUrl} />
        )}

        {account && (
          <p className="text-xs text-muted-foreground">
            Última sincronização: <time dateTime={account.lastSyncAt}>{formatLastSync(account.lastSyncAt)}</time>
          </p>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Nenhuma operação financeira real está habilitada. Cobranças, boletos, clientes Asaas, Split e demais operações continuam bloqueados.
          </AlertDescription>
        </Alert>

        {onRetry && (status.state === "unavailable" || status.state === "communication_failed") && (
          <Button type="button" variant="outline" onClick={onRetry} className="gap-2 w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Consultar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
