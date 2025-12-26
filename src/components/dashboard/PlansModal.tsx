import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// VirtualMercado default colors (NOT merchant colors)
const VM_PRIMARY = "#6a1b9a";
const VM_ORANGE = "#f97316";

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: string;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  features: PlanFeature[];
  buttonText: string;
  buttonAction: "free" | "current" | "upgrade";
}

const PLANS: Plan[] = [
  {
    id: "gratis",
    name: "GRÁTIS",
    displayName: "Plano GRÁTIS",
    monthlyPrice: 0,
    features: [
      { text: "Até 20 produtos cadastrados", included: true },
      { text: "Até 50 clientes ativos", included: true },
      { text: "Pedidos ilimitados", included: true },
      { text: "ERP (Gestor Virtual) integrado", included: true },
      { text: "Frete personalizado", included: true },
      { text: "Gerador de catálogo PDF ilimitado", included: true },
      { text: "Controle de estoque", included: true },
      { text: "Sem anúncios", included: false },
      { text: "Agente de mensagens", included: false },
      { text: "Calculadora de frete", included: false },
      { text: "Versão mobile responsiva", included: false },
      { text: "Categorias e subcategorias ilimitadas", included: false },
      { text: "Dashboard e relatórios avançados", included: false },
      { text: "Compartilhamento com suas redes sociais", included: false },
      { text: "Gateway e checkout de pagamentos", included: false },
    ],
    buttonText: "Começar grátis",
    buttonAction: "free",
  },
  {
    id: "pro",
    name: "PRO",
    displayName: "Plano PRO",
    monthlyPrice: 29.97,
    features: [
      { text: "Plano GRÁTIS", included: true, highlight: "GRÁTIS" },
      { text: "Tudo que o plano", included: true, highlight: "GRÁTIS" },
      { text: "e mais:", included: true },
      { text: "", included: false },
      { text: "Até 150 produtos cadastrados", included: true },
      { text: "Até 300 clientes ativos", included: true },
      { text: "", included: false },
      { text: "Personalização total do seu site (sua logo e cores)", included: true },
      { text: "Cupons de desconto ilimitado", included: true },
    ],
    buttonText: "Alterar para este plano",
    buttonAction: "upgrade",
  },
  {
    id: "premium",
    name: "PREMIUM",
    displayName: "Plano PREMIUM",
    monthlyPrice: 49.97,
    features: [
      { text: "Plano PRO", included: true, highlight: "PRO" },
      { text: "Tudo que o plano", included: true, highlight: "PRO" },
      { text: "e mais:", included: true },
      { text: "", included: false },
      { text: "∞ Produtos ilimitados", included: true },
      { text: "Clientes ilimitados", included: true },
      { text: "Editor de imagens com IA", included: true },
      { text: "Vínculo de domínio próprio", included: true },
      { text: "Suporte dedicado via e-mail e WhatsApp", included: true },
    ],
    buttonText: "Alterar para este plano",
    buttonAction: "upgrade",
  },
];

const PlansModal = ({ open, onOpenChange }: PlansModalProps) => {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [currentPlan, setCurrentPlan] = useState<string>("gratis");
  const { user } = useAuth();

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (!user) return;

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (subscription?.subscription_plans) {
        const planName = (subscription.subscription_plans as { name: string }).name?.toLowerCase();
        if (planName?.includes("pro")) {
          setCurrentPlan("pro");
        } else if (planName?.includes("premium")) {
          setCurrentPlan("premium");
        } else {
          setCurrentPlan("gratis");
        }
      }
    };

    if (open) {
      fetchCurrentPlan();
    }
  }, [user, open]);

  const calculateAnnualPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    const annualTotal = monthlyPrice * 12;
    const discounted = annualTotal * 0.7; // 30% off
    return discounted / 12; // Monthly equivalent
  };

  const getDisplayPrice = (plan: Plan) => {
    if (billingPeriod === "monthly") {
      return plan.monthlyPrice;
    }
    return calculateAnnualPrice(plan.monthlyPrice);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "0";
    return price.toFixed(2).replace(".", ",");
  };

  const handlePlanAction = (plan: Plan) => {
    if (plan.id === currentPlan) return;
    
    if (plan.buttonAction === "free") {
      window.location.href = "/register";
    } else {
      // Will redirect to master panel checkout in the future
      console.log("Redirect to checkout for plan:", plan.id);
    }
  };

  const isCurrentPlan = (planId: string) => planId === currentPlan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-50 p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center text-2xl font-bold text-gray-800">
            Meu Plano / Planos
          </DialogTitle>
        </DialogHeader>

        {/* Toggle Mensal/Anual */}
        <div className="flex justify-center py-4">
          <div className="inline-flex rounded-full bg-gray-200 p-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all",
                billingPeriod === "monthly"
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-800"
              )}
              style={{
                backgroundColor: billingPeriod === "monthly" ? VM_PRIMARY : "transparent",
              }}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingPeriod("annual")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all",
                billingPeriod === "annual"
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-800"
              )}
              style={{
                backgroundColor: billingPeriod === "annual" ? VM_PRIMARY : "transparent",
              }}
            >
              Anual
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 pt-2">
          {PLANS.map((plan) => {
            const isCurrent = isCurrentPlan(plan.id);
            const price = getDisplayPrice(plan);

            return (
              <div
                key={plan.id}
                className={cn(
                  "bg-white rounded-xl p-6 flex flex-col relative transition-all",
                  isCurrent
                    ? "border-2 shadow-lg scale-[1.02]"
                    : "border border-gray-200"
                )}
                style={{
                  borderColor: isCurrent ? VM_PRIMARY : undefined,
                }}
              >
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3
                    className="text-lg font-bold italic mb-3"
                    style={{ color: VM_PRIMARY }}
                  >
                    {plan.displayName}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-gray-800">
                      R$ {formatPrice(price)}
                    </span>
                    <span className="text-gray-500 text-sm">/mês</span>
                  </div>
                  {billingPeriod === "annual" && plan.monthlyPrice > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      30% de desconto no plano anual
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div
                  className="h-0.5 w-full mb-4"
                  style={{ backgroundColor: VM_ORANGE }}
                />

                {/* Features List */}
                <div className="flex-1 space-y-2 mb-6">
                  {plan.features.map((feature, idx) => {
                    if (!feature.text) return <div key={idx} className="h-2" />;
                    
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check
                            className="h-4 w-4 mt-0.5 flex-shrink-0"
                            style={{ color: VM_PRIMARY }}
                          />
                        ) : (
                          <X className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-300" />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            feature.included ? "text-gray-700" : "text-gray-400"
                          )}
                        >
                          {feature.highlight ? (
                            <>
                              {feature.text.replace(feature.highlight, "")}{" "}
                              <span
                                className="font-semibold px-1 py-0.5 rounded text-xs"
                                style={{
                                  backgroundColor:
                                    feature.highlight === "GRÁTIS"
                                      ? "#e8f5e9"
                                      : feature.highlight === "PRO"
                                      ? "#fff3e0"
                                      : "#f3e5f5",
                                  color:
                                    feature.highlight === "GRÁTIS"
                                      ? "#2e7d32"
                                      : feature.highlight === "PRO"
                                      ? VM_ORANGE
                                      : VM_PRIMARY,
                                }}
                              >
                                {feature.highlight}
                              </span>
                            </>
                          ) : (
                            feature.text
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handlePlanAction(plan)}
                  disabled={isCurrent}
                  className={cn(
                    "w-full py-3 font-semibold text-white transition-all",
                    isCurrent && "cursor-default"
                  )}
                  style={{
                    backgroundColor: isCurrent ? VM_PRIMARY : VM_ORANGE,
                    opacity: 1,
                  }}
                >
                  {isCurrent ? "Meu plano atual" : plan.buttonText}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlansModal;
