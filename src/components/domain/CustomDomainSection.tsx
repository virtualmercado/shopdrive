import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Ban, CheckCircle2, ChevronDown, Clock, ExternalLink, Globe, Info, Loader2, Lock, RefreshCw, Settings, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMerchantDomain } from "@/hooks/useMerchantDomain";
import { customDomainCardView, type CustomDomainCardKind } from "@/lib/customDomainStatus";
import { CustomDomainWizard, EMAIL_PRESERVATION_NOTICE } from "./CustomDomainWizard";
import { DomainCopyRow } from "./DomainCopyRow";
import { DomainProgress } from "./DomainProgress";

/** Existing plans page; highlights the plan that includes custom domains. */
const PLANS_PATH = "/lojista/financeiro?highlight=premium";

const StatusBadge = ({ kind }: { kind: CustomDomainCardKind }) => {
  const icon = "h-3.5 w-3.5 shrink-0";
  switch (kind) {
    case "upgrade": return <Badge variant="outline" className="gap-1 font-medium"><Lock className={icon} aria-hidden="true" />Disponível no Premium e MARCA</Badge>;
    case "blocked":
    case "unavailable": return <Badge variant="outline" className="gap-1 font-medium"><Ban className={icon} aria-hidden="true" />Indisponível</Badge>;
    case "empty": return <Badge variant="outline" className="font-medium">Não configurado</Badge>;
    case "setup": return <Badge variant="outline" className="gap-1 font-medium"><Clock className={icon} aria-hidden="true" />Configuração pendente</Badge>;
    case "processing": return <Badge variant="outline" className="gap-1 font-medium"><Loader2 className={`${icon} animate-spin motion-reduce:animate-none`} aria-hidden="true" />Em configuração</Badge>;
    case "attention": return <Badge variant="outline" className="gap-1 border-destructive/40 font-medium"><AlertTriangle className={`${icon} text-destructive`} aria-hidden="true" />Requer atenção</Badge>;
    case "connected":
    case "managed": return <Badge variant="success" className="gap-1"><CheckCircle2 className={icon} aria-hidden="true" />Conectado</Badge>;
    default: return null;
  }
};

const Notice = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="flex items-start gap-3 rounded-md bg-muted/60 p-4">
    <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  </div>
);

const Actions = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">{children}</div>
);

const Hostname = ({ value }: { value: string }) => (
  <p className="font-mono text-sm font-medium break-all">{value}</p>
);

export const CustomDomainSection = () => {
  const [open, setOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const navigate = useNavigate();
  const { overview, presentation, isLoading, loadError, verify } = useMerchantDomain();

  if (isLoading) {
    return (
      <div className="pt-4 border-t">
        <div className="space-y-3 rounded-lg border p-4 animate-pulse" role="status" aria-label="Carregando domínio próprio">
          <div className="h-6 w-1/3 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
        </div>
      </div>
    );
  }

  const view = customDomainCardView(overview, loadError);
  const { domain: d, hostname, address, ctaLabel } = presentation;
  const purchaseUrl = overview?.purchase_url;
  const records = (overview?.ingress_ready ? overview?.records ?? [] : []).filter((r) => r.value);
  const owned = !!d?.ownership_verified_at;

  const purchaseLink = (label: string) => purchaseUrl ? (
    <a href={purchaseUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
      {label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  ) : null;

  const body = (() => {
    switch (view.kind) {
      case "load_error":
        return <Notice icon={<Info className="h-5 w-5" />} title={view.title}>{view.description}</Notice>;

      case "upgrade":
        return (
          <>
            <Notice icon={<Lock className="h-5 w-5" />} title={view.title}>{view.description}</Notice>
            <Actions>
              <Button onClick={() => navigate(PLANS_PATH)}>Ver planos com domínio próprio</Button>
              {purchaseLink("Já quer registrar seu domínio?")}
            </Actions>
          </>
        );

      case "blocked":
      case "unavailable":
        return <Notice icon={<Ban className="h-5 w-5" />} title={view.title}>{view.description}</Notice>;

      case "empty":
        return (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium">{view.title}</p>
              <p className="text-sm text-muted-foreground">{view.description}</p>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>A ShopDrive utiliza o endereço com www, por exemplo: <span className="font-mono">www.sualoja.com.br</span>.</span>
            </p>
            <Collapsible open={howOpen} onOpenChange={setHowOpen} className="space-y-3">
              <Actions>
                <Button onClick={() => setOpen(true)} className="gap-2"><Globe className="h-4 w-4" />Conectar meu domínio</Button>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    Como funciona?
                    <ChevronDown className={`h-4 w-4 transition-transform ${howOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </Button>
                </CollapsibleTrigger>
              </Actions>
              <CollapsibleContent>
                <ol className="list-decimal space-y-1.5 rounded-md bg-muted/60 p-4 pl-8 text-sm text-muted-foreground">
                  <li><span className="font-medium text-foreground">Domínio:</span> informe o endereço com www que você já possui.</li>
                  <li><span className="font-medium text-foreground">DNS:</span> crie os registros indicados pela ShopDrive no painel do seu domínio.</li>
                  <li><span className="font-medium text-foreground">Verificação:</span> confirmamos a configuração e ativamos a conexão segura.</li>
                  <li><span className="font-medium text-foreground">Conectado:</span> seus clientes passam a acessar a loja pelo seu domínio.</li>
                </ol>
              </CollapsibleContent>
            </Collapsible>
            {purchaseLink("Ainda não tem um domínio? Registrar um domínio")}
          </>
        );

      case "setup":
        return (
          <>
            <DomainProgress step={2} />
            <div className="space-y-1">
              <Hostname value={hostname} />
              <p className="text-sm font-medium">{view.title}</p>
              <p className="text-sm text-muted-foreground">{view.description}</p>
            </div>
            {!owned && d?.txt_host && d?.txt_value && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registro TXT de verificação</p>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
                  <DomainCopyRow label="Tipo" value="TXT" />
                  <DomainCopyRow label="Nome / Host" value={d.txt_host} />
                  <DomainCopyRow label="Valor" value={d.txt_value} />
                </div>
              </div>
            )}
            {records.map((r) => (
              <div key={r.purpose} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registro {r.type} de apontamento</p>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
                  <DomainCopyRow label="Tipo" value={r.type} />
                  <DomainCopyRow label="Nome / Host" value={r.host} />
                  <DomainCopyRow label="Destino" value={r.value!} />
                </div>
              </div>
            ))}
            <p className="flex items-start gap-2 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />Utilize o endereço com www.</p>
            <p className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{EMAIL_PRESERVATION_NOTICE}</span>
            </p>
            <Actions>
              <Button onClick={() => setOpen(true)} className="gap-2"><Settings className="h-4 w-4" />{ctaLabel}</Button>
            </Actions>
          </>
        );

      case "processing":
        return (
          <>
            <DomainProgress step={3} />
            <div className="space-y-2">
              <Hostname value={hostname} />
              <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
                {view.automatic
                  ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  : <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                {view.title}
              </p>
              <p className="text-sm text-muted-foreground">{view.description}</p>
            </div>
            <Actions>
              <Button variant={view.automatic ? "outline" : "default"} onClick={() => setOpen(true)} className="gap-2">
                <Settings className="h-4 w-4" />{view.automatic ? "Ver andamento" : ctaLabel}
              </Button>
            </Actions>
          </>
        );

      case "attention":
        return (
          <>
            {view.step && <DomainProgress step={view.step} />}
            <Hostname value={hostname} />
            <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{view.title}</p>
                <p className="text-sm text-muted-foreground">{view.description}</p>
              </div>
            </div>
            <Actions>
              <Button onClick={() => verify.mutate()} disabled={verify.isPending} className="gap-2">
                {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Verificar novamente
              </Button>
              <Button variant="outline" onClick={() => setOpen(true)} className="gap-2"><Settings className="h-4 w-4" />Ver instruções</Button>
            </Actions>
          </>
        );

      case "connected":
      case "managed":
        return (
          <>
            <div className="flex items-start gap-3 rounded-md border p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-success">{view.title}</p>
                <p className="font-mono text-base font-semibold break-all">{hostname}</p>
                <p className="text-sm text-muted-foreground">{view.kind === "managed" ? "Seu domínio está ativo e direcionando corretamente para esta loja." : view.description}</p>
                {view.kind === "managed" && (
                  <div className="space-y-1 pt-1">
                    <Badge variant="outline" className="gap-1 font-medium"><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Gerenciado pela ShopDrive</Badge>
                    <p className="text-xs text-muted-foreground">{view.description}</p>
                  </div>
                )}
              </div>
            </div>
            <Actions>
              <Button asChild className="gap-2">
                <a href={address} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Visitar domínio</a>
              </Button>
              <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
                <Settings className="h-4 w-4" />{view.kind === "managed" ? "Ver detalhes" : ctaLabel}
              </Button>
            </Actions>
          </>
        );
    }
  })();

  return (
    <>
      <section aria-labelledby="custom-domain-title" className="pt-4 border-t">
        <div className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Globe className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h3 id="custom-domain-title" className="text-base font-semibold leading-tight">Domínio próprio</h3>
              <p className="text-sm text-muted-foreground">Sua loja no endereço da sua marca, com conexão segura.</p>
            </div>
            <div className="w-full sm:w-auto"><StatusBadge kind={view.kind} /></div>
          </div>
          {body}
        </div>
      </section>

      {overview?.available && <CustomDomainWizard open={open} onOpenChange={setOpen} />}
    </>
  );
};
