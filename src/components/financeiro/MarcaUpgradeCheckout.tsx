import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMarcaOffer, marcaPrice } from "@/components/financeiro/MarcaPlanOffer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");
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
      // Sem valor: o servidor usa o preço travado da troca. Ciclo vem do próprio servidor.
      const { data, error } = await supabase.functions.invoke("create-master-subscription", {
        body: isImmediate
          ? { userId: user.id, planId: "marca", billingCycle: immediate!.cycle, paymentMethod: "pix", origin: "painel_lojista", recurringConsent: false, acceptanceId: immediate!.acceptanceId, brandAccountId: immediate!.brandAccountId }
          : { userId: user.id, planId: "marca", billingCycle: view!.target_cycle, paymentMethod: "pix", origin: "troca_agendada" },
      });
      let body: any = data;
      if (error) {
        try { body = await (error as any).context?.json?.(); } catch { body = null; }
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
  }, [user, view, refetch, immediate, offer]);

  // Acompanhamento do pagamento pelo mecanismo já existente.
  useEffect(() => {
    if (!pix || approved) return;
    const iv = setInterval(async () => {
      const { data } = await supabase.functions.invoke("check-master-subscription-status", { body: { subscriptionId: pix.subscriptionId } });
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
        setMessage("O pagamento não foi aprovado. Você pode tentar de novo dentro do prazo.");
        refetch();
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [pix, approved, refetch, qc, immediate]);

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
    view.target_cycle = immediate!.cycle;
    view.amount = amt;
  }
  const cycleLabel = view!.target_cycle === "annual" ? "Anual" : "Mensal";
  const summary = (
    <section aria-labelledby="marca-resumo" className="rounded-lg border bg-card p-4 space-y-2 text-sm">
      <h2 id="marca-resumo" className="font-semibold text-foreground">Troca para o Plano MARCA</h2>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
        <dt className="text-muted-foreground">Plano atual</dt><dd className="text-right font-medium">{planName(view.source_plan)}</dd>
        <dt className="text-muted-foreground">Novo plano</dt><dd className="text-right font-medium">MARCA</dd>
        <dt className="text-muted-foreground">Ciclo</dt><dd className="text-right font-medium">{cycleLabel}</dd>
        <dt className="text-muted-foreground">Valor</dt><dd className="text-right font-semibold">{fmtMoney(view.amount)}</dd>
        <dt className="text-muted-foreground">Início</dt><dd className="text-right">{fmtDate(view.effective_at)}</dd>
        <dt className="text-muted-foreground">Pagar até</dt><dd className="text-right">{fmtDate(view.grace_until)}</dd>
        <dt className="text-muted-foreground">Pagamento</dt><dd className="text-right">PIX</dd>
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
      {!pix ? (
        <Button className="w-full" onClick={startPayment} disabled={busy} aria-busy={busy}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> Gerando PIX...</> : "Gerar PIX e pagar"}
        </Button>
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
