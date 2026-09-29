import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, AlertCircle, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCMSContent } from "@/hooks/useCMSContent";
import { useMarcaContract, type MarcaContract } from "@/hooks/useMarcaContract";
import { MarcaContractContent } from "@/components/plans/MarcaContractContent";

type Cycle = "monthly" | "annual";
export type MarcaOffer = {
  status: "ok" | "unavailable";
  path?: "immediate" | "scheduled" | "card_blocked" | "not_eligible" | "secondary" | "already_scheduled" | "current";
  effective_at?: string;
  monthly_price?: number;
  annual_discount_percent?: number;
};

export const CARD_BLOCKED_MESSAGE =
  "O upgrade para o Plano MARCA ainda não está disponível para assinaturas com renovação automática no cartão. Sua assinatura atual continuará funcionando normalmente. Entre em contato com o suporte para verificar opções de migração.";

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");
export const marcaPrice = (monthly: number, discount: number, cycle: Cycle) =>
  cycle === "monthly" ? monthly : Math.round(monthly * 12 * (1 - discount / 100) * 100) / 100;

export function useMarcaOffer() {
  return useQuery({
    queryKey: ["marca-offer"],
    queryFn: async (): Promise<MarcaOffer> => {
      const { data, error } = await (supabase.rpc as any)("get_my_marca_offer");
      if (error || !data) return { status: "unavailable" };
      return data as MarcaOffer;
    },
  });
}

/** Cartão do Plano MARCA no Financeiro. Some por completo quando o servidor diz "unavailable" (flag desligada). */
export function MarcaPlanOffer() {
  const { data: offer } = useMarcaOffer();
  const { data: cms } = useCMSContent();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [open, setOpen] = useState(false);

  if (!offer || offer.status !== "ok" || offer.path === "secondary") return null;
  const monthly = Number(offer.monthly_price);
  const discount = Number(offer.annual_discount_percent ?? 0);
  const copy = (cms?.plans as any)?.marca_plan ?? {};
  const features: { text: string }[] = Array.isArray(copy.features) ? copy.features : [];
  const price = marcaPrice(monthly, discount, cycle);

  return (
    <section aria-labelledby="marca-offer-title" className="mt-6 rounded-xl border-2 border-primary/40 bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 id="marca-offer-title" className="text-lg font-bold italic text-primary">{copy.display_name || "Plano MARCA"}</h3>
          {copy.subtitle && <p className="text-sm text-muted-foreground">{copy.subtitle}</p>}
        </div>
        <div className="inline-flex self-start rounded-lg bg-muted p-1" role="group" aria-label="Ciclo de cobrança">
          {(["monthly", "annual"] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn("rounded-md px-4 py-2 text-sm font-semibold", cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {c === "monthly" ? "Mensal" : `Anual (-${discount}%)`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">{fmtMoney(price)}</span>
        <span className="text-sm text-muted-foreground">{cycle === "monthly" ? "/mês" : "/ano"}</span>
      </div>
      {cycle === "annual" && (
        <p className="text-sm text-muted-foreground"><span className="line-through">{fmtMoney(monthly * 12)}</span> · {discount}% de desconto no plano anual</p>
      )}

      {features.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> <span>{f.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        {offer.path === "current" ? (
          <Button disabled className="w-full sm:w-auto">Plano atual</Button>
        ) : offer.path === "already_scheduled" ? (
          <p className="text-sm text-foreground">Sua troca para o Plano MARCA já está agendada para {fmtDate(offer.effective_at)}.</p>
        ) : offer.path === "card_blocked" ? (
          <p role="status" className="flex gap-2 rounded-md border bg-muted/50 p-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> {CARD_BLOCKED_MESSAGE}
          </p>
        ) : offer.path === "not_eligible" ? (
          <p className="text-sm text-muted-foreground">Esta conta não pode contratar o Plano MARCA no momento. Fale com o suporte.</p>
        ) : (
          <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>{copy.button_text || "Escolher MARCA"}</Button>
        )}
      </div>

      {open && <MarcaCommercialFlow offer={offer} initialCycle={cycle} onClose={() => setOpen(false)} />}
    </section>
  );
}

type Step = "cycle" | "company" | "contract" | "scheduled_done";

function MarcaCommercialFlow({ offer, initialCycle, onClose }: { offer: MarcaOffer; initialCycle: Cycle; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { prepareBrandAccount, loadContract } = useMarcaContract();
  const [step, setStep] = useState<Step>("cycle");
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<{ id: string; name: string } | null>(null);
  const [contract, setContract] = useState<MarcaContract | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ effectiveAt?: string; amount?: number } | null>(null);

  const monthly = Number(offer.monthly_price);
  const discount = Number(offer.annual_discount_percent ?? 0);
  const amount = marcaPrice(monthly, discount, cycle);
  const cycleLabel = cycle === "annual" ? "Anual" : "Mensal";

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await fn(); } catch { setError("Não foi possível continuar agora. Tente novamente."); } finally { setBusy(false); }
  };

  const goCompany = () => run(async () => {
    // Prepara ou reutiliza a empresa (servidor decide dono, loja e slot 1).
    const r = await prepareBrandAccount(name.trim() || undefined);
    if (r.status !== "ok") { setError(r.message); return; }
    setBrand({ id: r.data.brandAccountId, name: r.data.displayName });
    const c = await loadContract(r.data.brandAccountId);
    if (c.status !== "ok") { setError(c.message); return; }
    setContract(c.data);
    setAgreed(false);
    setStep("contract");
  });

  const accept = () => run(async () => {
    if (!brand || !agreed) return;
    const { data, error: e } = await supabase.functions.invoke("accept-plan-contract", {
      body: { brand_account_id: brand.id, plan_id: "marca", billing_cycle: cycle },
    });
    let body: any = data;
    if (e) { try { body = await (e as any).context?.json?.(); } catch { body = null; } }
    const acceptanceId = body?.acceptance_id;
    if (!acceptanceId) { setError(body?.error || "Não foi possível registrar o aceite."); return; }

    if (offer.path === "scheduled") {
      const { data: s, error: se } = await (supabase.rpc as any)("schedule_my_marca_upgrade", { p_target_cycle: cycle, p_contract_acceptance_id: acceptanceId });
      if (se) { setError("Não foi possível agendar a troca. Tente novamente."); return; }
      if (s?.status === "card_blocked") { setError(CARD_BLOCKED_MESSAGE); return; }
      if (s?.status !== "scheduled" && s?.status !== "already_scheduled") { setError(s?.message || "Não foi possível agendar a troca."); return; }
      setDone({ effectiveAt: s.effective_at, amount: s.amount ?? s.frozen_amount ?? amount });
      setStep("scheduled_done");
      qc.invalidateQueries({ queryKey: ["marca-offer"] });
      qc.invalidateQueries({ queryKey: ["marca-scheduled-upgrade"] });
      return;
    }
    // Sem plano pago: contratação imediata. Aceite e empresa vão só em memória, nunca na URL.
    navigate("/gestor/checkout-assinatura?plano=marca", { state: { marcaImmediate: { acceptanceId, brandAccountId: brand.id, cycle } } });
  });

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratar Plano MARCA</DialogTitle>
          <DialogDescription>
            {step === "cycle" && "Etapa 1 de 3 · Escolha o ciclo"}
            {step === "company" && "Etapa 2 de 3 · Empresa / Marca"}
            {step === "contract" && "Etapa 3 de 3 · Contrato"}
            {step === "scheduled_done" && "Troca agendada"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /> <span>{error}</span>
          </div>
        )}

        {step === "cycle" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(["monthly", "annual"] as Cycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cycle === c}
                  onClick={() => setCycle(c)}
                  className={cn("rounded-lg border p-4 text-left", cycle === c ? "border-primary ring-2 ring-primary/30" : "border-border")}
                >
                  <p className="font-semibold text-foreground">{c === "monthly" ? "Mensal" : "Anual"}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtMoney(marcaPrice(monthly, discount, c))}{c === "monthly" ? "/mês" : `/ano · ${discount}% de desconto`}
                  </p>
                </button>
              ))}
            </div>
            {offer.path === "scheduled" && (
              <p className="text-sm text-muted-foreground">Seu plano atual continua até {fmtDate(offer.effective_at)}. O Plano MARCA começa nessa data, sem cobrança antes.</p>
            )}
            <Button className="w-full" onClick={() => setStep("company")}>Continuar</Button>
          </div>
        )}

        {step === "company" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="marca-company">Nome da empresa / marca</Label>
              <Input id="marca-company" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Deixe em branco para usar o nome da sua loja" />
              <p className="text-xs text-muted-foreground">Se você já tem uma empresa cadastrada, ela será reutilizada.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="sm:flex-1" onClick={() => setStep("cycle")} disabled={busy}>Voltar</Button>
              <Button className="sm:flex-1" onClick={goCompany} disabled={busy} aria-busy={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "contract" && contract && brand && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">{contract.title}</h3>
              <p className="text-xs text-muted-foreground">Versão {contract.version}</p>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
              <MarcaContractContent content={contract.content} />
            </div>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
              <dt className="text-muted-foreground">Empresa</dt><dd className="text-right font-medium break-words">{brand.name}</dd>
              <dt className="text-muted-foreground">Ciclo</dt><dd className="text-right font-medium">{cycleLabel}</dd>
              <dt className="text-muted-foreground">Valor</dt><dd className="text-right font-semibold">{fmtMoney(amount)}</dd>
            </dl>
            <label className="flex items-start gap-3 text-sm text-foreground">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" aria-label="Aceito os termos" />
              <span>{contract.acceptance_statement}</span>
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="sm:flex-1" onClick={() => setStep("company")} disabled={busy}>Voltar</Button>
              <Button className="sm:flex-1" onClick={accept} disabled={!agreed || busy} aria-busy={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} Aceitar e continuar
              </Button>
            </div>
          </div>
        )}

        {step === "scheduled_done" && done && (
          <div className="space-y-3 text-sm" role="status">
            <CalendarCheck className="h-8 w-8 text-primary" aria-hidden />
            <p className="font-semibold text-foreground">Seu upgrade para o Plano MARCA está agendado para {fmtDate(done.effectiveAt)}.</p>
            <p className="text-foreground">Seu plano atual continuará funcionando normalmente até essa data.</p>
            <p className="text-foreground">Nenhuma cobrança MARCA será feita antes do vencimento.</p>
            <p className="text-muted-foreground">Ciclo: {cycleLabel} · Valor contratado: {fmtMoney(Number(done.amount ?? amount))}</p>
            <Button className="w-full" onClick={onClose}>Concluir</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
