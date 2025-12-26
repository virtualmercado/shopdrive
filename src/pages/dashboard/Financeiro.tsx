import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import editIcon from "@/assets/edit-icon.png";

// VirtualMercado default colors (NOT merchant colors)
const VM_PRIMARY = "#6a1b9a";
const VM_ORANGE = "#f97316";
const VM_GREEN = "#22c55e";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface ExtraFeature {
  text: string;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  subtitle: string;
  monthlyPrice: number;
  features: PlanFeature[];
  extraFeatures?: ExtraFeature[];
  previousPlanIncluded?: {
    planName: string;
    planLabel: string;
    labelColor: string;
    labelBgColor: string;
    description: string;
  };
  buttonText: string;
  buttonAction: "free" | "current" | "upgrade";
}

const PLANS: Plan[] = [
  {
    id: "gratis",
    name: "GRÁTIS",
    displayName: "Plano GRÁTIS",
    subtitle: "",
    monthlyPrice: 0,
    features: [
      { text: "Até 20 produtos cadastrados", included: true },
      { text: "Até 50 clientes ativos", included: true },
      { text: "Pedidos ilimitados", included: true },
      { text: "ERP (Gestor Virtual) integrado", included: true },
      { text: "Frete personalizado", included: true },
      { text: "Gerador de catálogo PDF ilimitado", included: true },
      { text: "Controle de estoque", included: true },
      { text: "Sem anúncios", included: true },
      { text: "Agente de mensagens", included: true },
      { text: "Calculadora de frete", included: true },
      { text: "Versão mobile responsiva", included: true },
      { text: "Categorias e subcategorias ilimitadas", included: true },
      { text: "Dashboard e relatórios avançados", included: true },
      { text: "Compartilhamento com suas redes sociais", included: true },
      { text: "Gateway e checkout de pagamentos", included: true },
    ],
    buttonText: "Começar grátis",
    buttonAction: "free",
  },
  {
    id: "pro",
    name: "PRO",
    displayName: "Plano PRO",
    subtitle: "",
    monthlyPrice: 29.97,
    features: [],
    previousPlanIncluded: {
      planName: "Plano GRÁTIS",
      planLabel: "GRÁTIS",
      labelColor: "#22c55e",
      labelBgColor: "#dcfce7",
      description: "Tudo o que o plano GRÁTIS oferece, e mais:",
    },
    extraFeatures: [
      { text: "Até 150 produtos cadastrados" },
      { text: "Até 300 clientes ativos" },
      { text: "Personalização total do seu site (sua logo e cores)" },
      { text: "Cupons de desconto ilimitado" },
    ],
    buttonText: "Alterar para este plano",
    buttonAction: "upgrade",
  },
  {
    id: "premium",
    name: "PREMIUM",
    displayName: "Plano PREMIUM",
    subtitle: "",
    monthlyPrice: 49.97,
    features: [],
    previousPlanIncluded: {
      planName: "Plano PRO",
      planLabel: "PRO",
      labelColor: "#f97316",
      labelBgColor: "#fff7ed",
      description: "Tudo o que o plano PRO oferece, e mais:",
    },
    extraFeatures: [
      { text: "Produtos ilimitados" },
      { text: "Clientes ilimitados" },
      { text: "Editor de imagens com IA" },
      { text: "Vínculo de domínio próprio" },
      { text: "Suporte dedicado via e-mail e WhatsApp" },
    ],
    buttonText: "Alterar para este plano",
    buttonAction: "upgrade",
  },
];

const Financeiro = () => {
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

    fetchCurrentPlan();
  }, [user]);

  const calculateAnnualPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    const annualTotal = monthlyPrice * 12;
    const discounted = annualTotal * 0.7; // 30% off = (valor_mensal × 12) − 30%
    return discounted;
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

  const getPriceSuffix = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return "/mês";
    return billingPeriod === "monthly" ? "/mês" : "/ano";
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Title - Left aligned, following dashboard pattern */}
        <h1 className="text-2xl font-semibold text-foreground">
          Meu Plano / Planos
        </h1>

        {/* Content Card Container */}
        <Card className="p-6">

        {/* Toggle Mensal/Anual */}
        <div className="flex justify-center pb-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="text-center mb-4">
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
                    <span className="text-gray-800 text-sm">{getPriceSuffix(plan)}</span>
                  </div>
                  {billingPeriod === "annual" && plan.monthlyPrice > 0 && (
                    <p 
                      className="text-sm font-bold mt-1"
                      style={{ color: VM_PRIMARY }}
                    >
                      30% de desconto no plano anual
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div
                  className="h-0.5 w-full mb-4"
                  style={{ backgroundColor: VM_ORANGE }}
                />

                {/* Content Area */}
                <div className="flex-1 flex flex-col">
                  {/* Plano GRÁTIS - Lista completa de recursos */}
                  {plan.id === "gratis" && (
                    <div className="space-y-3 mb-6">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <img 
                            src={editIcon} 
                            alt="Incluído" 
                            className="w-4 h-4 mt-0.5 flex-shrink-0"
                          />
                          <span className="text-sm font-medium text-black">
                            {feature.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PRO e PREMIUM - Card do plano anterior + recursos extras */}
                  {plan.previousPlanIncluded && (
                    <>
                      {/* Card simulando plano anterior */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: plan.previousPlanIncluded.labelBgColor,
                              color: plan.previousPlanIncluded.labelColor,
                            }}
                          >
                            {plan.previousPlanIncluded.planLabel}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {plan.previousPlanIncluded.description}
                        </p>
                      </div>

                      {/* Recursos extras em verde */}
                      {plan.extraFeatures && plan.extraFeatures.length > 0 && (
                        <div className="space-y-3 mb-6">
                          {plan.extraFeatures.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <img 
                                src={editIcon} 
                                alt="Incluído" 
                                className="w-4 h-4 mt-0.5 flex-shrink-0"
                              />
                              <span className="text-sm font-medium text-black">
                                {feature.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handlePlanAction(plan)}
                  disabled={isCurrent}
                  className={cn(
                    "w-full py-3 font-semibold text-white transition-all mt-auto",
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
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;
