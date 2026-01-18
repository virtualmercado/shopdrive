import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Subscriber {
  id: string;
  store_name: string | null;
  email: string | null;
  planName: string;
}

interface ChangePlanModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePlanModal = ({
  subscriber,
  open,
  onOpenChange,
}: ChangePlanModalProps) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [noCharge, setNoCharge] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      
      if (error) throw error;
      // Filter out free/grátis plans since we have a hardcoded option for it
      return data?.filter(plan => plan.price > 0 && plan.name?.toLowerCase() !== 'free') || [];
    },
    enabled: open,
  });

  const { data: currentSubscription } = useQuery({
    queryKey: ['current-subscription', subscriber?.id],
    queryFn: async () => {
      if (!subscriber?.id) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', subscriber.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!subscriber?.id,
  });

  useEffect(() => {
    if (currentSubscription?.plan_id) {
      setSelectedPlanId(currentSubscription.plan_id);
    }
  }, [currentSubscription]);

  const handleSubmit = async () => {
    if (!subscriber || !reason.trim()) {
      toast.error("Motivo da alteração é obrigatório");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Find selected plan
      const selectedPlan = plans?.find(p => p.id === selectedPlanId);
      const isFreePlan = !selectedPlanId || selectedPlan?.price === 0;

      if (currentSubscription) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            plan_id: isFreePlan ? null : selectedPlanId,
            status: 'active',
            no_charge: noCharge, // When true, billing is bypassed
            internal_notes: `Alterado por admin em ${new Date().toLocaleString('pt-BR')}. Motivo: ${reason}. ${noCharge ? 'Sem cobrança - billing desativado.' : 'Cobrança ativa.'}`,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', subscriber.id);

        if (updateError) throw updateError;
      } else if (!isFreePlan) {
        // Create new subscription
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'annual' ? 12 : 1));

        const { error: insertError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: subscriber.id,
            plan_id: selectedPlanId,
            status: 'active',
            no_charge: noCharge, // When true, billing is bypassed
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            internal_notes: `Criado por admin em ${new Date().toLocaleString('pt-BR')}. Motivo: ${reason}. ${noCharge ? 'Sem cobrança - billing desativado.' : 'Cobrança ativa.'}`,
          });

        if (insertError) throw insertError;
      }

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'plan_change',
        entity_type: 'subscription',
        entity_id: subscriber.id,
        metadata: {
          subscriber_email: subscriber.email,
          previous_plan: currentSubscription?.subscription_plans?.name || 'Grátis',
          new_plan: selectedPlan?.name || 'Grátis',
          billing_cycle: billingCycle,
          no_charge: noCharge,
          reason: reason,
        },
      });

      toast.success(`Plano alterado para ${selectedPlan?.name || 'Grátis'} com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['admin-subscribers'] });
      onOpenChange(false);
      setReason("");
      setNoCharge(false);
    } catch (error) {
      console.error('Erro ao alterar plano:', error);
      toast.error("Erro ao alterar plano. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Alterar Plano
          </DialogTitle>
          <DialogDescription>
            Alterar plano de <strong>{subscriber.store_name || subscriber.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Current Plan */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="font-medium">{subscriber.planName}</p>
            </div>

            {/* Plan Selection */}
            <div className="space-y-3">
              <Label>Selecionar novo plano</Label>
              {plansLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <RadioGroup
                  value={selectedPlanId}
                  onValueChange={setSelectedPlanId}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="" id="plan-free" />
                    <Label htmlFor="plan-free" className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span>Grátis</span>
                        <Badge variant="secondary">R$ 0,00</Badge>
                      </div>
                    </Label>
                  </div>
                  {plans?.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} />
                      <Label htmlFor={`plan-${plan.id}`} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <span>{plan.name}</span>
                          <Badge variant="outline">
                            R$ {Number(plan.price).toFixed(2).replace('.', ',')}
                          </Badge>
                        </div>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {plan.description}
                          </p>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            {/* Billing Cycle */}
            {selectedPlanId && (
              <div className="space-y-3">
                <Label>Ciclo de cobrança</Label>
                <RadioGroup
                  value={billingCycle}
                  onValueChange={(v) => setBillingCycle(v as "monthly" | "annual")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <Label htmlFor="monthly">Mensal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="annual" id="annual" />
                    <Label htmlFor="annual">Anual</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* No Charge Option */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="no-charge">Sem cobrança</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar plano sem gerar cobrança
                </p>
              </div>
              <Switch
                id="no-charge"
                checked={noCharge}
                onCheckedChange={setNoCharge}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Motivo da alteração <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Retenção de cliente, bonificação, ajuste administrativo..."
                rows={3}
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Esta ação não enviará e-mail automático ao lojista. O controle é manual.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason.trim()}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
