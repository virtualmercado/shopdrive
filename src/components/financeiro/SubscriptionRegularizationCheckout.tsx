import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Loader2, QrCode, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  fetchMyRegularization, isRegularized, closedChargeMessage, cycleLabel, planLabel,
} from "@/lib/subscriptionRegularization";

type Pix = { qrCode: string | null; qrCodeBase64?: string | null; expiresAt?: string | null };
const fmtMoney = (v?: number) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function invokeRegularization(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("regularize-master-subscription", { body });
  if (!error) return data as any;
  try { return await (error as any).context?.json?.(); } catch { return null; }
}

/** Pagamento da assinatura já contratada e em atraso. Sem empresa, contrato, aceite nem nova assinatura. */
export function SubscriptionRegularizationCheckout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [pix, setPix] = useState<Pix | null>(null);
  const [regId, setRegId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subscription-regularization", user?.id],
    enabled: !!user,
    queryFn: fetchMyRegularization,
  });

  // Reopening the page shows the same open PIX instead of creating another charge.
  useEffect(() => {
    if (data?.state === "payable" && data.open && !regId) {
      setRegId(data.open.regularization_id);
      setPix({ qrCode: data.open.pix_qr_code ?? null, qrCodeBase64: data.open.pix_qr_code_base64, expiresAt: data.open.pix_expires_at });
    }
  }, [data, regId]);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const r = await invokeRegularization({ action: "start" });
      if (r?.state === "pending" && r.regularizationId) {
        setRegId(r.regularizationId);
        if (r.pix?.qrCode) setPix(r.pix);
        else setMessage("O PIX está sendo preparado. Aguarde alguns segundos.");
      } else if (isRegularized(r?.state)) {
        setDone(true);
        qc.invalidateQueries();
      } else if (r?.state === "busy") {
        setMessage("Já existe uma geração de PIX em andamento. Aguarde alguns segundos e tente de novo.");
      } else if (r?.state === "not_eligible") {
        setMessage("Não há pagamento pendente para regularizar nesta conta.");
        refetch();
      } else {
        setMessage(r?.error || "Não foi possível gerar o PIX agora. Tente novamente em instantes.");
      }
    } catch {
      setMessage("Não foi possível gerar o PIX agora. Tente novamente em instantes.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [qc, refetch]);

  // Status follows only the server: the backend reconciles with the provider through the shared confirmation.
  useEffect(() => {
    if (!regId || done) return;
    const iv = setInterval(async () => {
      const r = await invokeRegularization({ action: "status", regularizationId: regId });
      if (isRegularized(r?.state)) {
        clearInterval(iv);
        setDone(true);
        qc.invalidateQueries();
        return;
      }
      if (r?.state === "pending" && r.pix?.qrCode) setPix(r.pix);
      const closed = closedChargeMessage(r?.state);
      if (closed) {
        clearInterval(iv);
        setPix(null);
        setRegId(null);
        setMessage(closed);
        refetch();
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [regId, done, qc, refetch]);

  const copy = async () => {
    if (!pix?.qrCode) return;
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

  if (loading || (user && isLoading)) {
    return shell(<div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Carregando" /></div>);
  }
  if (!user) {
    return shell(
      <div className="text-center space-y-3 py-4" role="status">
        <h1 className="text-lg font-semibold text-foreground">Entre na sua conta</h1>
        <p className="text-sm text-muted-foreground">Para regularizar o pagamento, entre com a conta responsável pela loja.</p>
        <Button onClick={() => navigate("/login")}>Entrar</Button>
      </div>
    );
  }
  if (done) {
    return shell(
      <div className="text-center space-y-3 py-4" role="status">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center"><Check className="h-7 w-7 text-primary" aria-hidden /></div>
        <h1 className="text-xl font-semibold text-foreground">Pagamento confirmado</h1>
        <p className="text-sm text-muted-foreground">Sua assinatura foi regularizada e os recursos do seu plano foram restaurados.</p>
        <Button className="w-full sm:w-auto" onClick={() => navigate("/lojista/financeiro")}>Ir para o Financeiro</Button>
      </div>
    );
  }
  if (isError) {
    return shell(
      <div className="text-center space-y-3 py-4" role="alert">
        <h1 className="text-lg font-semibold text-foreground">Não foi possível carregar sua assinatura</h1>
        <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }
  if (!data || data.state !== "payable") {
    return shell(
      <div className="text-center space-y-2 py-4" role="status">
        <h1 className="text-lg font-semibold text-foreground">Nenhum pagamento pendente</h1>
        <p className="text-sm text-muted-foreground">Não há assinatura com pagamento em atraso para regularizar nesta conta.</p>
      </div>
    );
  }

  return shell(
    <>
      <h1 className="text-xl font-semibold text-foreground">Regularizar pagamento</h1>
      <section aria-labelledby="reg-resumo" className="rounded-lg border bg-card p-4 space-y-2 text-sm">
        <h2 id="reg-resumo" className="font-semibold text-foreground">Sua assinatura</h2>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted-foreground">Plano contratado</dt><dd className="text-right font-medium">{planLabel(data.plan_id, data.plan_name)}</dd>
          <dt className="text-muted-foreground">Ciclo</dt><dd className="text-right font-medium">{cycleLabel(data.billing_cycle)}</dd>
          <dt className="text-muted-foreground">Valor</dt><dd className="text-right font-semibold">{fmtMoney(data.amount)}</dd>
          <dt className="text-muted-foreground">Situação</dt><dd className="text-right font-medium text-destructive">Pagamento pendente</dd>
          <dt className="text-muted-foreground">Pagamento</dt><dd className="text-right">PIX</dd>
        </dl>
        {data.temporarily_limited && (
          <p className="text-muted-foreground">Recursos temporariamente limitados ao Plano Grátis até a confirmação do pagamento.</p>
        )}
      </section>
      {message && (
        <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" aria-hidden /> <span>{message}</span>
        </div>
      )}
      {!pix ? (
        <Button className="w-full" onClick={start} disabled={busy} aria-busy={busy}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> Gerando PIX...</> : "Gerar PIX e pagar"}
        </Button>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium text-foreground inline-flex items-center gap-2" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Aguardando pagamento
          </p>
          <div className="mx-auto w-full max-w-[240px] rounded-lg border bg-background p-3">
            {pix.qrCodeBase64 ? (
              <img src={pix.qrCodeBase64.startsWith("data:") ? pix.qrCodeBase64 : `data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code PIX para regularizar a assinatura" className="w-full h-auto" />
            ) : (
              <QrCode className="mx-auto h-24 w-24 text-muted-foreground" aria-hidden />
            )}
          </div>
          {pix.qrCode && <p className="text-xs text-muted-foreground break-all rounded-md bg-muted p-2 text-left font-mono">{pix.qrCode}</p>}
          <Button className="w-full gap-2" onClick={copy} disabled={!pix.qrCode} aria-label="Copiar código PIX copia e cola">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Código copiado" : "Copiar código PIX"}
          </Button>
          <p className="text-xs text-muted-foreground">Os recursos do plano voltam somente após a confirmação do pagamento.</p>
        </div>
      )}
    </>
  );
}
