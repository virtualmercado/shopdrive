import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PLAN_DISPLAY_NAMES, getPlanFromPlanId } from "@/lib/planLimits";
import type { PlanTrial } from "@/hooks/usePlanTrial";
import { trialDaysLeft } from "@/hooks/useAdminPlanTrials";

interface ManageTrialModalProps {
  subscriber: { id: string; store_name: string | null; email: string | null } | null;
  trial: PlanTrial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageTrialModal = ({ subscriber, trial, open, onOpenChange }: ManageTrialModalProps) => {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEnd = async () => {
    if (!trial) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("admin_end_plan_trial", {
        p_trial_id: trial.id,
        p_reason: reason || null,
      });
      if (error) throw error;
      toast.success("Degustação encerrada. A conta voltou ao plano base.");
      queryClient.invalidateQueries({ queryKey: ["admin-plan-trials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível encerrar a degustação");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  if (!subscriber || !trial) return null;

  const trialLabel = PLAN_DISPLAY_NAMES[getPlanFromPlanId(trial.trial_plan)];
  const baseLabel = PLAN_DISPLAY_NAMES[getPlanFromPlanId(trial.base_plan)];
  const daysLeft = trialDaysLeft(trial.ends_at);

  const rows: [string, React.ReactNode][] = [
    ["Assinante", subscriber.store_name || subscriber.email],
    ["Plano base", <Badge variant="outline">{baseLabel}</Badge>],
    ["Plano temporário", <Badge className="bg-primary/10 text-primary">{trialLabel}</Badge>],
    ["Início", format(new Date(trial.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })],
    ["Término", format(new Date(trial.ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })],
    ["Tempo restante", `${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`],
    ["Situação", trial.status === "active" ? "Ativa" : trial.status],
  ];

  if (trial.reason) rows.push(["Motivo", trial.reason]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Gerenciar degustação
          </DialogTitle>
          <DialogDescription>
            Acesso temporário concedido pelo painel Master. Nenhuma cobrança está associada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border divide-y text-sm">
            {rows.map(([label, value], i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right font-medium">{value}</span>
              </div>
            ))}
          </div>

          {confirming ? (
            <>
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  Esta ação encerrará imediatamente o acesso temporário ao Plano {trialLabel} e a
                  conta voltará ao seu plano base atual.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="end-reason">Motivo do encerramento (opcional)</Label>
                <Textarea
                  id="end-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Fechar
          </Button>
          <Button
            variant="destructive"
            onClick={() => (confirming ? handleEnd() : setConfirming(true))}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirming ? "Confirmar encerramento" : "Encerrar degustação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
