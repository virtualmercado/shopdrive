import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMarcaOffer, marcaPrice } from "@/components/financeiro/MarcaPlanOffer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { initializePaymentSdk, paymentSdkErrorMessage, PaymentSdkError } from "@/lib/paymentSdk";
import { ArrowLeft, Check, Clock, Copy, Loader2, QrCode, AlertCircle } from "lucide-react";

type View = {
  state: "unavailable" | "none" | "scheduled" | "payable" | "expired" | "activated" | "cancelled";
  effective_at?: string;
  grace_until?: string;
  amount?: number;
  currency?: string;
  target_cycle?: "monthly" | "annual";
  source_plan?: string;
};
type Pix = { qrCode: string; qrCodeBase64?: string | null; expiresAt?: string | null; subscriptionId: string };

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "");
const fmtMoney = (v?: number) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const planName = (p?: string) => (p === "premium" ? "PREMIUM" : p === "pro" ? "PRO" : "—");

/**
 * Página de pagamento da troca agendada PRO/PREMIUM → MARCA.
 * O servidor decide tudo (estado, ciclo, preço, datas). A URL só serve para chegar aqui.
 */
export function MarcaUpgradeCheckout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pix, setPix] = useState<Pix | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);
  // Cartão: só na contratação imediata (troca agendada PRO/PREMIUM segue apenas PIX).
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");
  const [card, setCard] = useState({ number: "", name: "", month: "", year: "", cvv: "" });
  const [recurringConsent, setRecurringConsent] = useState(false);
  const [waitingCard, setWaitingCard] = useState<string | null>(null);
  const mpRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);
  useEffect(() => {
    if (method !== "credit_card" || mpRef.current) return;
    initializePaymentSdk().then(({ mp }) => { mpRef.current = mp; setSdkReady(true); })
      .catch((e) => toast.error(paymentSdkErrorMessage(e instanceof PaymentSdkError ? e.kind : "init")));
  }, [method]);
  const location = useLocation();
  // Contratação imediata (sem plano pago): aceite vem só da etapa anterior, em memória. O servidor revalida tudo.
  const immediate = (location.state as any)?.marcaImmediate as { acceptanceId: string; brandAccountId: string; cycle: "monthly" | "annual" } | undefined;
  const { data: offer } = useMarcaOffer();

  const { data: view, isLoading, refetch } = useQuery({
    queryKey: ["marca-upgrade-checkout", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<View> => {
      const { data, error } = await (supabase.rpc as any)("get_my_marca_upgrade_checkout");
      if (error) return { state: "unavailable" };
      return data as View;
    },
  });

  const applyPayment = (d: any) => {
    const p = d?.payment ?? d;
    const qr = p?.pixQrCode;
    const sid = d?.subscription?.id ?? d?.subscriptionId ?? p?.subscriptionId;
    if (qr && sid) {
      setPix({ qrCode: qr, qrCodeBase64: p?.pixQrCodeBase64, expiresAt: p?.pixExpiresAt, subscriptionId: sid });
      return true;
    }
    return false;
  };

  const startPayment = useCallback(async () => {
    const isImmediate = !!immediate && view?.state === "none" && offer?.path === "immediate";
    if (busyRef.current || !user || (view?.state !== "payable" && !isImmediate)) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      let cardFields: Record<string, unknown> = {};
      if (isImmediate && method === "credit_card") {
        const num = card.number.replace(/\D/g, "");
        const { data: prof } = await supabase.from("profiles").select("cpf_cnpj").eq("id", user.id).maybeSingle();
        let tok: any = null;
        try {
          tok = await mpRef.current?.createCardToken({
            cardNumber: num, cardholderName: card.name, cardExpirationMonth: card.month,
            cardExpirationYear: card.year.length === 2 ? `20${card.year}` : card.year, securityCode: card.cvv,
            identificationType: "CPF", identificationNumber: (prof as any)?.cpf_cnpj?.replace(/\D/g, "") || "00000000000",
          });
        } catch { tok = null; }
        if (!tok?.id) { setMessage("Não foi possível validar os dados do cartão. Confira e tente de novo."); return; }
        const brand = num.startsWith("4") ? "visa" : /^5[1-5]|^2[2-7]/.test(num) ? "master" : /^3[47]/.test(num) ? "amex" : /^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(num) ? "elo" : "visa";
        cardFields = { cardToken: tok.id, paymentMethodId: brand, cardBrand: brand, cardLastFour: num.slice(-4), installments: 1, recurringConsent };
      }
      // Sem valor: o servidor usa o preço travado da troca. Ciclo vem do próprio servidor.
      const { data, error } = await supabase.functions.invoke("create-master-subscription", {
        body: isImmediate
          ? { userId: user.id, planId: "marca", billingCycle: immediate!.cycle, paymentMethod: method, origin: "painel_lojista", recurringConsent: false, acceptanceId: immediate!.acceptanceId, brandAccountId: immediate!.brandAccountId, ...cardFields }
          : { userId: user.id, planId: "marca", billingCycle: view!.target_cycle, paymentMethod: "pix", origin: "troca_agendada" },
      });
      let body: any = data;
      if (error) {
        try { body = await (error as any).context?.json?.(); } catch { body = null; }
      }
      const sid = body?.subscription?.id ?? body?.subscriptionId ?? body?.payment?.subscriptionId;
      if (method === "credit_card" && isImmediate) {
        if (sid && !body?.error) setWaitingCard(sid);
        else setMessage(body?.error || "O pagamento com cartão não foi aprovado. Nenhum valor foi confirmado.");
        return;
      }
      if (!applyPayment(body)) {
        setMessage(body?.error || "Não foi possível gerar o PIX agora. Tente novamente em instantes.");
        refetch();
      }
    } catch {
      setMessage("Não foi possível gerar o PIX agora. Tente novamente em instantes.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [user, view, refetch, immediate, offer, method, card, recurringConsent]);

  // Acompanhamento do pagamento pelo mecanismo já existente.
  const watchId = pix?.subscriptionId ?? waitingCard;
  useEffect(() => {
    if (!watchId || approved) return;
    const iv = setInterval(async () => {
      const { data } = await supabase.functions.invoke("check-master-subscription-status", { body: { subscriptionId: watchId } });
      if (data?.subscription?.status === "active" || data?.normalizedStatus === "approved") {
        const { data: v } = await refetch();
        if (v?.state === "activated" || (immediate && data?.subscription?.status === "active")) {
          clearInterval(iv);
          setApproved(true);
          qc.invalidateQueries();
        }
      } else if (data?.normalizedStatus === "rejected") {
        clearInterval(iv);
        setPix(null);
        setWaitingCard(null);
        setMessage("O pagamento não foi aprovado. Você pode tentar de novo dentro do prazo.");
        refetch();
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [watchId, approved, refetch, qc, immediate]);

  const copy = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      toast.success("Código PIX copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-muted/40 flex items-start sm:items-center justify-center p-4 overflow-x-hidden">
      <Card className="w-full max-w-lg">
        <CardContent className="p-5 sm:p-8 space-y-5">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => navigate("/lojista/financeiro")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao Financeiro
          </Button>
          {children}
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading || !user) {
    return shell(<div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Carregando" /></div>);
  }

  if (approved || view?.state === "activated") {
    return shell(
      <div className="text-center space-y-3 py-4" role="status">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center"><Check className="h-7 w-7 text-primary" aria-hidden /></div>
        <h1 className="text-xl font-semibold text-foreground">Plano MARCA ativado!</h1>
        <p className="text-sm text-muted-foreground">Seu pagamento foi confirmado e sua loja agora está no Plano MARCA.</p>
        <Button className="w-full sm:w-auto" onClick={() => navigate("/lojista/financeiro")}>Ir para o Financeiro</Button>
      </div>
    );
  }

  const immediateReady = !!immediate && view?.state === "none" && offer?.status === "ok" && offer.path === "immediate";
  if (!immediateReady && (!view || ["unavailable", "none", "cancelled"].includes(view.state))) {
    return shell(
      <div className="text-center space-y-2 py-4" role="status">
        <h1 className="text-lg font-semibold text-foreground">Pagamento indisponível</h1>
        <p className="text-sm text-muted-foreground">Não há uma troca para o Plano MARCA aguardando pagamento na sua conta.</p>
      </div>
    );
  }

  if (view.state === "expired") {
    return shell(
      <div className="text-center space-y-2 py-4" role="status">
        <Clock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Prazo encerrado</h1>
        <p className="text-sm text-muted-foreground">O prazo desta troca expirou. Inicie uma nova contratação do Plano MARCA.</p>
      </div>
    );
  }

  if (immediateReady) {
    const amt = marcaPrice(Number(offer!.monthly_price), Number(offer!.annual_discount_percent ?? 0), immediate!.cycle);
    Object.assign(view!, { target_cycle: immediate!.cycle, amount: amt });
  }
  const cycleLabel = view!.target_cycle === "annual" ? "Anual" : "Mensal";
  const summary = (
    <section aria-labelledby="marca-resumo" className="rounded-lg border bg-card p-4 space-y-2 text-sm">
      <h2 id="marca-resumo" className="font-semibold text-foreground">{immediateReady ? "Contratação do Plano MARCA" : "Troca para o Plano MARCA"}</h2>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
        {!immediateReady && <><dt className="text-muted-foreground">Plano atual</dt><dd className="text-right font-medium">{planName(view.source_plan)}</dd></>}
        <dt className="text-muted-foreground">Novo plano</dt><dd className="text-right font-medium">MARCA</dd>
        <dt className="text-muted-foreground">Ciclo</dt><dd className="text-right font-medium">{cycleLabel}</dd>
        <dt className="text-muted-foreground">Valor</dt><dd className="text-right font-semibold">{fmtMoney(view.amount)}</dd>
        {!immediateReady && <>
          <dt className="text-muted-foreground">Início</dt><dd className="text-right">{fmtDate(view.effective_at)}</dd>
          <dt className="text-muted-foreground">Pagar até</dt><dd className="text-right">{fmtDate(view.grace_until)}</dd>
        </>}
        <dt className="text-muted-foreground">Pagamento</dt><dd className="text-right">{immediateReady && method === "credit_card" ? "Cartão de crédito" : "PIX"}</dd>
      </dl>
    </section>
  );

  if (view.state === "scheduled") {
    return shell(
      <>
        <h1 className="text-xl font-semibold text-foreground">Plano MARCA</h1>
        <p className="text-sm text-foreground" role="status">Seu upgrade para o Plano MARCA está agendado para {fmtDate(view.effective_at)}.</p>
        <p className="text-sm text-muted-foreground">Seu plano atual continuará funcionando normalmente até essa data. O pagamento do Plano MARCA ficará disponível no vencimento.</p>
        {summary}
        <Button className="w-full" disabled>Pagamento disponível em {fmtDate(view.effective_at)}</Button>
      </>
    );
  }

  // payable
  return shell(
    <>
      <h1 className="text-xl font-semibold text-foreground">Pagar e ativar Plano MARCA</h1>
      {summary}
      {message && (
        <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" aria-hidden /> <span>{message}</span>
        </div>
      )}
      {waitingCard ? (
        <p className="text-sm font-medium text-foreground inline-flex items-center gap-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Aguardando a confirmação do pagamento pelo cartão. Não repita a tentativa.
        </p>
      ) : !pix ? (
        <div className="space-y-4">
          {immediateReady && (
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="grid grid-cols-2 gap-2" aria-label="Forma de pagamento">
              {(["pix", "credit_card"] as const).map((m) => (
                <Label key={m} htmlFor={`m-${m}`} className="flex items-center gap-2 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem id={`m-${m}`} value={m} /> {m === "pix" ? "PIX" : "Cartão de crédito"}
                </Label>
              ))}
            </RadioGroup>
          )}
          {immediateReady && method === "credit_card" && (
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-6 space-y-1"><Label htmlFor="cc-n">Número do cartão</Label><Input id="cc-n" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></div>
              <div className="col-span-6 space-y-1"><Label htmlFor="cc-h">Nome impresso no cartão</Label><Input id="cc-h" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label htmlFor="cc-m">Mês</Label><Input id="cc-m" inputMode="numeric" placeholder="MM" maxLength={2} value={card.month} onChange={(e) => setCard({ ...card, month: e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label htmlFor="cc-y">Ano</Label><Input id="cc-y" inputMode="numeric" placeholder="AA" maxLength={4} value={card.year} onChange={(e) => setCard({ ...card, year: e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label htmlFor="cc-c">CVV</Label><Input id="cc-c" inputMode="numeric" maxLength={4} autoComplete="cc-csc" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} /></div>
              {view.target_cycle === "monthly" && (
                <Label htmlFor="cc-r" className="col-span-6 flex items-start gap-2 text-xs font-normal text-muted-foreground">
                  <Checkbox id="cc-r" checked={recurringConsent} onCheckedChange={(v) => setRecurringConsent(v === true)} />
                  Autorizo a cobrança mensal recorrente no cartão até o cancelamento.
                </Label>
              )}
            </div>
          )}
          <Button className="w-full" onClick={startPayment} aria-busy={busy}
            disabled={busy || (immediateReady && method === "credit_card" && (!sdkReady || !card.number || !card.name || !card.month || !card.year || !card.cvv || (view.target_cycle === "monthly" && !recurringConsent)))}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> Processando...</> : immediateReady && method === "credit_card" ? "Pagar com cartão" : "Gerar PIX e pagar"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium text-foreground inline-flex items-center gap-2" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Aguardando pagamento
          </p>
          <div className="mx-auto w-full max-w-[240px] rounded-lg border bg-background p-3">
            {pix.qrCodeBase64 ? (
              <img
                src={pix.qrCodeBase64.startsWith("data:") ? pix.qrCodeBase64 : `data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code PIX para pagar o Plano MARCA"
                className="w-full h-auto"
              />
            ) : (
              <QrCode className="mx-auto h-24 w-24 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className="text-xs text-muted-foreground break-all rounded-md bg-muted p-2 text-left font-mono">{pix.qrCode}</p>
          <Button className="w-full gap-2" onClick={copy} aria-label="Copiar código PIX copia e cola">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Código copiado" : "Copiar código PIX"}
          </Button>
          <p className="text-xs text-muted-foreground">Seu plano atual continua ativo até a confirmação. O Plano MARCA só é ativado após o pagamento confirmado.</p>
        </div>
      )}
    </>
  );
}
