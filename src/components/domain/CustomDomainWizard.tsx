import { useState } from "react";
import { Copy, Check, Loader2, RefreshCw, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useMerchantDomain } from "@/hooks/useMerchantDomain";
import { customDomainStateLabel, isCustomDomainConnected } from "@/lib/customDomainStatus";
import { normalizeCustomDomain } from "../../../supabase/functions/_shared/customDomainCore";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export const EMAIL_PRESERVATION_NOTICE =
  "Importante: altere somente os registros indicados pela ShopDrive. Não remova registros MX, SPF, DKIM, DMARC ou outros TXT existentes caso utilize e-mail profissional no domínio.";

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded border bg-background p-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm break-all">{value}</p>
      </div>
      <Button size="icon" variant="ghost" aria-label={`Copiar ${label}`} onClick={async () => {
        await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500);
      }}>
        {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
};

const Step = ({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-lg border p-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      {title}
    </h3>
    {children}
  </section>
);

export const CustomDomainWizard = ({ open, onOpenChange }: Props) => {
  const { overview, domain, tutorials, claimDomain, regenerateChallenge, verify, disconnect } = useMerchantDomain();
  const [input, setInput] = useState("");
  const d = domain && !domain.released && domain.flow_version === 2 ? domain : null;
  const owned = !!d?.ownership_verified_at;
  const expired = !!d && !owned && !!d.verification_expires_at && new Date(d.verification_expires_at) < new Date();
  const provider = d?.last_result?.provider ?? null;
  const nameservers = d?.detected_nameservers ?? [];
  const checked = !!d?.last_dns_check;
  const records = overview?.records ?? [];
  const connected = isCustomDomainConnected(d);

  const submit = () => {
    const n = normalizeCustomDomain(input);
    if (!n.ok) { toast.error(n.reason === "reserved" ? "Este domínio é reservado e não pode ser usado." : "Informe um domínio válido, por exemplo: seudominio.com.br"); return; }
    claimDomain.mutate(n.domain, { onSuccess: () => setInput("") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Domínio próprio</DialogTitle>
          <DialogDescription>{d ? customDomainStateLabel(d.state) : "Informe o domínio que deseja conectar à sua loja."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Step n={1} title="Informe seu domínio" done={!!d}>
            {d ? (
              <p className="font-mono text-sm">{d.domain}</p>
            ) : (
              <div className="flex gap-2">
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="seudominio.com.br" className="font-mono" />
                <Button onClick={submit} disabled={!input || claimDomain.isPending}>
                  {claimDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
                </Button>
              </div>
            )}
          </Step>

          {d && (
            <Step n={2} title="Confirmar propriedade" done={owned}>
              {owned ? (
                <p className="text-sm text-muted-foreground">Propriedade confirmada.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Crie este registro TXT no painel onde o DNS do seu domínio é administrado:</p>
                  <CopyRow label="Tipo" value="TXT" />
                  {d.txt_host && <CopyRow label="Nome / Host" value={d.txt_host} />}
                  {d.txt_value && <CopyRow label="Valor" value={d.txt_value} />}
                  {d.last_result?.ownership === "mismatch" && <p className="text-sm text-destructive">Encontramos um TXT, mas o valor não confere. Copie o valor novamente.</p>}
                  {d.last_result?.ownership === "missing" && checked && <p className="text-sm text-muted-foreground">Propriedade ainda não verificada. Se acabou de criar o registro, aguarde a propagação.</p>}
                  {expired && (
                    <div className="flex items-center justify-between gap-2 rounded bg-muted p-2 text-sm">
                      <span>O código expirou. Gere um novo para continuar.</span>
                      <Button size="sm" variant="outline" onClick={() => regenerateChallenge.mutate()} disabled={regenerateChallenge.isPending}>Gerar novo código</Button>
                    </div>
                  )}
                </>
              )}
            </Step>
          )}

          {d && (
            <Step n={3} title="Configurar DNS" done={!!d.dns_verified_at}>
              {checked ? (
                provider ? (
                  <div className="space-y-1">
                    <p className="text-sm">Detectamos que o DNS deste domínio é administrado por: <strong>{provider.name}</strong>.</p>
                    <p className="text-xs text-muted-foreground">Mesmo que o domínio tenha sido comprado em outra empresa, faça as alterações no painel que administra estes nameservers.</p>
                  </div>
                ) : (
                  <p className="text-sm">Não conseguimos identificar automaticamente onde seu DNS é administrado. Selecione abaixo o painel onde você altera os registros DNS do domínio.</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Clique em "Verificar novamente" para detectarmos onde o DNS do seu domínio é administrado.</p>
              )}
              {nameservers.length > 0 && <p className="text-xs text-muted-foreground font-mono">Nameservers: {nameservers.join(", ")}</p>}

              {overview?.ingress_ready && records.length > 0 ? (
                <div className="space-y-2">
                  {records.map((r) => r.value && (
                    <div key={r.purpose} className="grid gap-2 sm:grid-cols-3">
                      <CopyRow label="Tipo" value={r.type} />
                      <CopyRow label="Nome / Host" value={r.host} />
                      <CopyRow label="Valor" value={r.value} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded bg-muted p-2 text-sm">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Os registros de apontamento serão exibidos aqui quando a conexão segura de domínios estiver disponível. Por enquanto, faça apenas a confirmação de propriedade.</span>
                </div>
              )}

              <div className="flex items-start gap-2 rounded border border-dashed p-2 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{EMAIL_PRESERVATION_NOTICE}</span>
              </div>

              <p className="text-sm font-medium pt-1">Onde o DNS do seu domínio é administrado?</p>
              <Accordion type="single" collapsible defaultValue={provider?.slug}>
                {tutorials?.map((t) => (
                  <AccordionItem key={t.id} value={t.provider_slug}>
                    <AccordionTrigger className="text-sm">{t.provider_name}</AccordionTrigger>
                    <AccordionContent>
                      <ol className="list-decimal space-y-2 pl-5 text-sm">
                        {t.tutorial_content.steps.map((s, i) => (
                          <li key={i}><strong>{s.title}.</strong> <span className="whitespace-pre-line text-muted-foreground">{s.content}</span></li>
                        ))}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Step>
          )}

          {d && (
            <Step n={4} title="Verificar e conectar" done={connected}>
              <p className="text-sm">{customDomainStateLabel(d.state)}</p>
              {d.last_dns_check && <p className="text-xs text-muted-foreground">Última verificação: {new Date(d.last_dns_check).toLocaleString("pt-BR")}</p>}
              {d.last_result?.notes?.includes("ns_resolver_unavailable") && <p className="text-xs text-muted-foreground">O serviço de consulta DNS não respondeu. Isso não indica erro na sua configuração — tente novamente.</p>}
              {connected && <p className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Domínio conectado com SSL ativo.</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => verify.mutate()} disabled={verify.isPending}>
                  {verify.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Verificar novamente
                </Button>
                <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                  {connected ? "Desconectar domínio" : "Cancelar este domínio"}
                </Button>
              </div>
            </Step>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
