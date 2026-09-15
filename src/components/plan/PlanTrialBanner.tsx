import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Clock, X } from "lucide-react";
import { usePlanTrial } from "@/hooks/usePlanTrial";
import { useBannerDismiss } from "@/hooks/useBannerDismiss";
import { PLAN_DISPLAY_NAMES, getPlanFromPlanId } from "@/lib/planLimits";

const planLabel = (plan: string | null | undefined) =>
  PLAN_DISPLAY_NAMES[getPlanFromPlanId(plan)] ?? "Grátis";

/** Derived from ends_at - now on every render; never stored in the frontend. */
const formatRemaining = (endsAt: string, now: number) => {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return null;
  const hours = diff / (1000 * 60 * 60);
  if (hours >= 24) {
    const days = Math.ceil(hours / 24);
    return { days, text: `${days} ${days === 1 ? "dia restante" : "dias restantes"}` };
  }
  const wholeHours = Math.floor(hours);
  if (wholeHours >= 1) {
    return { days: 0, text: `Restam ${wholeHours} ${wholeHours === 1 ? "hora" : "horas"}` };
  }
  return { days: 0, text: "Seu período de degustação termina hoje" };
};

export const PlanTrialBanner = () => {
  const navigate = useNavigate();
  const { data } = usePlanTrial();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const trial = data?.trial ?? null;
  const isActive = !!data?.isActive && !!trial && new Date(trial.ends_at).getTime() > now;
  const justEnded = !!data?.justEnded;

  const remaining = useMemo(
    () => (trial && isActive ? formatRemaining(trial.ends_at, now) : null),
    [trial, isActive, now]
  );

  const endedBanner = useBannerDismiss({
    bannerId: `plan_trial_ended_${trial?.id ?? "none"}`,
    status: trial?.status ?? "none",
    dismissHours: 24 * 365,
  });

  if (!trial) return null;

  if (!isActive) {
    if (!justEnded || !endedBanner.isVisible) return null;
    const backTo = planLabel(trial.converted_plan || trial.base_plan);
    return (
      <Card className="relative border-muted bg-muted/40 p-4 sm:p-5">
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={endedBanner.dismiss}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-semibold">Seu período de degustação terminou</p>
              <p className="text-sm text-muted-foreground">
                Seu plano voltou para o Plano {backTo}. Nenhuma cobrança foi gerada.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/gestor/financeiro")}>
            Ver planos
          </Button>
        </div>
      </Card>
    );
  }

  const trialName = planLabel(trial.trial_plan);
  const baseName = planLabel(trial.base_plan);
  const days = remaining?.days ?? 0;
  const urgent = days <= 2;

  return (
    <Card
      className={`p-4 sm:p-5 ${
        urgent ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Gift className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? "text-destructive" : "text-primary"}`} />
          <div className="space-y-1">
            <p className="font-semibold">
              {urgent
                ? `Seu período ${trialName} termina em breve`
                : `🎁 Você está experimentando o Plano ${trialName}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {remaining?.text}
              {days === 0
                ? ` — após o término, sua conta retornará automaticamente ao Plano ${baseName}.`
                : urgent
                ? ` — assine o plano para continuar utilizando todos os recursos sem interrupção.`
                : ` para aproveitar todos os recursos deste plano.`}
            </p>
          </div>
        </div>
        <Button
          className="shrink-0"
          onClick={() =>
            navigate(`/gestor/financeiro?highlight=${trial.trial_plan.toLowerCase()}`)
          }
        >
          {urgent ? `Continuar com ${trialName}` : `Assinar ${trialName}`}
        </Button>
      </div>
    </Card>
  );
};

export default PlanTrialBanner;
