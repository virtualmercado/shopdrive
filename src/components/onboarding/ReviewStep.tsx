import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StoreOnboardingState } from "@/hooks/useStoreOnboarding";

const REVIEW_ITEMS = [
  { key: "company", label: "Dados da empresa", required: true },
  { key: "visual", label: "Identidade visual", required: true },
  { key: "contacts", label: "Contatos", required: true },
  { key: "banner", label: "Banner principal", required: true },
  { key: "categories", label: "Categorias", required: true },
  { key: "products", label: "Produtos ativos", required: true },
  { key: "navigation", label: "Menu e navegação", required: false },
  { key: "institutional", label: "Textos institucionais", required: false },
];

interface ReviewStepProps {
  state: StoreOnboardingState | null;
  storeSlug: string | null;
  onCompleted: () => void | Promise<unknown>;
}

const ReviewStep = ({ state, storeSlug, onCompleted }: ReviewStepProps) => {
  const [saving, setSaving] = useState(false);
  const steps = state?.steps_status ?? {};
  const progress = state?.progress_percent ?? 0;
  const required = REVIEW_ITEMS.filter((i) => i.required);
  const missingRequired = required.filter((i) => !steps?.[i.key]?.done);
  const canComplete = missingRequired.length === 0;
  const isExempt = state?.classification === "STORE_EXEMPT_OPERATIONAL";

  const complete = async () => {
    if (!state?.store_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("store_onboarding_state")
      .update({ onboarding_completed: true, completed_at: new Date().toISOString() })
      .eq("store_id", state.store_id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível concluir agora. Tente novamente.");
      return;
    }
    await supabase.from("store_onboarding_events").insert({
      store_id: state.store_id,
      user_id: state.store_id,
      event_type: "ONBOARDING_COMPLETED",
      step: "review",
    });
    toast.success("Configuração concluída! Sua loja está pronta para vender.");
    await onCompleted();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Configuração da loja</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {REVIEW_ITEMS.map((item) => {
          const done = !!steps?.[item.key]?.done;
          return (
            <Card key={item.key}>
              <CardContent className="flex items-center justify-between gap-2 py-3 text-sm">
                <span className="flex items-center gap-2">
                  {done ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {done ? "completo" : item.required ? "faltando" : "recomendado"}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!canComplete && (
        <p className="text-sm text-muted-foreground">
          Faltam: {missingRequired.map((i) => i.label).join(", ")}.
          {isExempt && " Sua loja continua funcionando normalmente mesmo assim."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {storeSlug && (
          <Button variant="outline" asChild>
            <a href={`/${storeSlug}`} target="_blank" rel="noopener noreferrer">
              Visualizar minha loja <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
        <Button onClick={complete} disabled={!canComplete || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Concluir configuração
        </Button>
      </div>
    </div>
  );
};

export default ReviewStep;
