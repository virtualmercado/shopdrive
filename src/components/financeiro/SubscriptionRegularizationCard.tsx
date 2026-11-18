import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyRegularization, REGULARIZATION_PATH, cycleLabel, planLabel } from "@/lib/subscriptionRegularization";

const fmtMoney = (v?: number) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Financeiro: plano contratado com pagamento pendente. Leva à regularização da mesma assinatura. */
export function SubscriptionRegularizationCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["subscription-regularization", user?.id],
    enabled: !!user,
    queryFn: fetchMyRegularization,
  });
  if (!data || data.state !== "payable") return null;
  return (
    <Card className="p-6 border-destructive/40" role="region" aria-labelledby="reg-card-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            <h2 id="reg-card-title" className="text-lg font-semibold text-foreground">Plano contratado: {planLabel(data.plan_id, data.plan_name)}</h2>
          </div>
          <p className="text-sm text-foreground">Status: <span className="font-medium text-destructive">Pagamento pendente</span> · {cycleLabel(data.billing_cycle)} · {fmtMoney(data.amount)}</p>
          {data.temporarily_limited && (
            <p className="text-sm text-muted-foreground">Recursos temporariamente limitados ao Plano Grátis.</p>
          )}
        </div>
        <Button className="shrink-0" onClick={() => navigate(REGULARIZATION_PATH)}>Regularizar pagamento</Button>
      </div>
    </Card>
  );
}
