import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PLAN_DISPLAY_NAMES, getPlanFromPlanId } from "@/lib/planLimits";
import type { PlanTrial } from "@/hooks/usePlanTrial";

const TRIAL_DAYS = 7;

interface GrantTrialModalProps {
  subscriber: { id: string; store_name: string | null; email: string | null } | null;
  history?: PlanTrial[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GrantTrialModal = ({ subscriber, history = [], open, onOpenChange }: GrantTrialModalProps) => {
  const queryClient = useQueryClient();
  const [basePlan, setBasePlan] = useState<string>("free");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [trialPlan, setTrialPlan] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !subscriber) return;
    setTrialPlan("");
    setReason("");
    setConfirming(false);
    setLoadingPlan(true);
    supabase
      .rpc("get_effective_store_plan", { p_store_id: subscriber.id })
      .then(({ data, error }) => {
        if (!error && data) {
          const parsed = data as { basePlan?: string; plan?: string };
          setBasePlan(parsed.basePlan || parsed.plan || "free");
        }
      })
      .then(() => setLoadingPlan(false));
  }, [open, subscriber]);

  const baseLabel = PLAN_DISPLAY_NAMES[getPlanFromPlanId(basePlan)];
  const options = basePlan === "premium" ? [] : basePlan === "pro" ? ["premium"] : ["pro", "premium"];
  const endsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const previousCount = history.length;
  const lastPrevious = history[0];

  const handleGrant = async () => {
    if (!subscriber || !trialPlan) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("admin_grant_plan_trial", {
        p_store_id: subscriber.id,
        p_trial_plan: trialPlan,
        p_reason: reason || null,
      });
      if (error) throw error;

      toast.success(
        `Degustação ${PLAN_DISPLAY_NAMES[getPlanFromPlanId(trialPlan)]} concedida por ${TRIAL_DAYS} dias`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-plan-trials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível conceder a degustação");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Conceder degustação
          </DialogTitle>
          <DialogDescription>
            Acesso temporário a um plano superior, sem cobrança e sem alterar a assinatura atual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Assinante</span>
              <span className="font-medium">{subscriber.store_name || subscriber.email}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Plano atual (base)</span>
              <Badge variant="outline">{loadingPlan ? "..." : baseLabel}</Badge>
            </div>
          </div>

          {previousCount > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Este assinante já recebeu degustação anteriormente: {previousCount}{" "}
                {previousCount === 1 ? "vez" : "vezes"}
                {lastPrevious
                  ? ` — última em ${format(new Date(lastPrevious.started_at), "dd/MM/yyyy", { locale: ptBR })}.`
                  : "."}
              </AlertDescription>
            </Alert>
          )}

          {options.length === 0 ? (
            <Alert>
              <AlertDescription>Este assinante já possui o maior plano disponível.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Plano temporário</Label>
                <RadioGroup value={trialPlan} onValueChange={setTrialPlan} className="gap-2">
                  {options.map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                    >
                      <RadioGroupItem value={option} />
                      <span className="font-medium">
                        Plano {PLAN_DISPLAY_NAMES[getPlanFromPlanId(option)]}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Duração</p>
                  <p className="font-medium">{TRIAL_DAYS} dias</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Término previsto</p>
                  <p className="font-medium">
                    {format(endsAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial-reason">Motivo (opcional)</Label>
                <Textarea
                  id="trial-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex.: Solicitação do cliente, campanha comercial, retenção"
                  rows={2}
                />
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  O assinante retornará automaticamente ao plano original ao término do período e
                  nenhuma cobrança será criada.
                </AlertDescription>
              </Alert>

              {confirming && (
                <Alert className="border-primary/40">
                  <AlertDescription className="text-sm">
                    Confirmar a concessão de {TRIAL_DAYS} dias do Plano{" "}
                    {PLAN_DISPLAY_NAMES[getPlanFromPlanId(trialPlan)]} para{" "}
                    {subscriber.store_name || subscriber.email}?
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {options.length > 0 && (
            <Button
              onClick={() => (confirming ? handleGrant() : setConfirming(true))}
              disabled={!trialPlan || submitting || loadingPlan}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirming ? "Confirmar concessão" : "Conceder degustação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
