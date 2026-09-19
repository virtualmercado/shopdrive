import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Sparkles } from "lucide-react";
import { useStoreOnboarding, ONBOARDING_STEPS } from "@/hooks/useStoreOnboarding";
import { useOnboardingFlags } from "@/hooks/useOnboardingFlags";

const STEP_HINT: Record<string, string> = {
  company: "informar os dados da empresa",
  visual: "definir logo e cores da loja",
  contacts: "adicionar WhatsApp ou telefone",
  banner: "criar o banner principal",
  categories: "criar a primeira categoria",
  products: "cadastrar o primeiro produto",
  navigation: "organizar o menu da loja",
  institucional: "escrever o texto institucional",
  institutional: "escrever o texto institucional",
};

/**
 * Orientação de recuperação no painel do lojista.
 * Nunca bloqueia nenhuma área e nunca usa linguagem de bloqueio.
 */
const StoreSetupProgressCard = () => {
  const navigate = useNavigate();
  const { state, loading } = useStoreOnboarding();
  const { flags, loading: flagsLoading } = useOnboardingFlags();

  if (loading || flagsLoading || !state) return null;
  if (!flags.ENABLE_STORE_ONBOARDING) return null;
  if (state.onboarding_completed) return null;
  if (state.classification === "STORE_READY") return null;

  const isRecovery = state.classification === "STORE_RECOVERY_REQUIRED";
  const isNew = state.classification === "STORE_NEW_REQUIRED";
  const isExempt = state.classification === "STORE_EXEMPT_OPERATIONAL";

  if (isRecovery && !flags.ENABLE_RECOVERY_FOR_EXISTING_INCOMPLETE) return null;
  if (isExempt && (state.progress_percent ?? 0) >= 100) return null;
  if (!isRecovery && !isNew && !isExempt) return null;

  const steps = ONBOARDING_STEPS.map((s) => ({
    ...s,
    done: !!state.steps_status?.[s.key]?.done,
  }));
  const remaining = steps.filter((s) => !s.done).length;
  const next = steps.find((s) => !s.done);
  const progress = state.progress_percent ?? 0;

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {isExempt ? "Deixe sua loja ainda melhor" : "Complete sua loja"}
            </h2>
          </div>
          <span className="text-sm font-semibold">{progress}%</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Sua loja está {progress}% configurada.
          {next ? ` Próximo passo recomendado: ${STEP_HINT[next.key] ?? next.label}.` : ""}
          {remaining > 0 ? ` Faltam ${remaining} ${remaining === 1 ? "etapa" : "etapas"}.` : ""}
        </p>

        <Progress value={progress} />

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/lojista/configuracao-loja")}>
            Continuar configuração <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoreSetupProgressCard;
