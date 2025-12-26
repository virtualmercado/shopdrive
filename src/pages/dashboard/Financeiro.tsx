import { useState, useEffect } from "react";
import { CircleDollarSign, Coins, LockOpen, Trophy } from "lucide-react";
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
const VM_GREEN = "#16a34a";

// Garantias fixas padrão para PRO e PREMIUM
const PLAN_GUARANTEES = [
  { icon: CircleDollarSign, text: "Garantia de 7 dias" },
  { icon: Coins, text: "Sem comissão sobre as vendas" },
  { icon: LockOpen, text: "Cancele a qualquer momento, sem multas ou taxas" },
  { icon: Trophy, text: "Plano escolhido por milhares de assinantes" },
];

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
          <div className="inline-flex items-center rounded-lg bg-gray-100 p-1 gap-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "px-8 py-2.5 rounded-md text-sm font-semibold transition-all",
                billingPeriod === "monthly"
                  ? "text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              )}
              style={{
                backgroundColor: billingPeriod === "monthly" ? VM_PRIMARY : "transparent",
              }}
            >
              Mensal
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBillingPeriod("annual")}
                className={cn(
                  "px-8 py-2.5 rounded-md text-sm font-semibold transition-all",
                  billingPeriod === "annual"
                    ? "text-white shadow-sm"
                    : "hover:text-gray-800"
                )}
                style={{
                  backgroundColor: billingPeriod === "annual" ? VM_PRIMARY : "transparent",
                  color: billingPeriod === "annual" ? "white" : VM_PRIMARY,
                }}
              >
                Anual
              </button>
              {/* Discount badge - visible only when monthly is selected */}
              {billingPeriod === "monthly" && (
                <span 
                  className="px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap"
                  style={{ backgroundColor: VM_ORANGE }}
                >
                  -30% DESC.
                </span>
              )}
            </div>
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
                  {plan.id === "gratis" && (
                    <p className="text-sm text-gray-600 text-left mt-2">
                      Comece a vender agora,<br />sem custos.
                    </p>
                  )}
                  {plan.id === "pro" && (
                    <p className="text-sm text-gray-600 text-left mt-2">
                      O melhor custo benefício<br />do mercado online.
                    </p>
                  )}
                  {plan.id === "premium" && (
                    <p className="text-sm text-gray-600 text-left mt-2">
                      A solução ideal para quem quer<br />escalar mais rápido as vendas.
                    </p>
                  )}
                  {billingPeriod === "annual" && plan.monthlyPrice > 0 && (
                    <p 
                      className="text-sm font-bold mt-1"
                      style={{ color: VM_PRIMARY }}
                    >
                      - 30% de desconto no plano anual
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

                  {/* PRO e PREMIUM - Card visual do plano anterior + recursos extras */}
                  {plan.previousPlanIncluded && (
                    <>
                      {/* Box visual simulando recursos do plano anterior */}
                      <div 
                        className="rounded-lg p-4 mb-3"
                        style={{ backgroundColor: "#f3e8ff" }}
                      >
                        {/* Título do plano anterior */}
                        <p 
                          className="text-sm font-medium text-center mb-3 italic"
                          style={{ color: VM_PRIMARY }}
                        >
                          {plan.previousPlanIncluded.planName}
                        </p>
                        
                        {/* Linhas simulando recursos com check icons e barras roxas */}
                        <div className="space-y-2.5">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((_, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <svg 
                                className="w-4 h-4 flex-shrink-0" 
                                viewBox="0 0 20 20" 
                                fill="none"
                                style={{ color: "#c4b5fd" }}
                              >
                                <path 
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                                  fill="currentColor"
                                />
                              </svg>
                              <div className="flex gap-1.5 flex-1">
                                <div 
                                  className="h-2.5 rounded-full"
                                  style={{ 
                                    backgroundColor: "#c4b5fd",
                                    width: idx % 3 === 0 ? "45%" : idx % 3 === 1 ? "60%" : "35%"
                                  }}
                                />
                                <div 
                                  className="h-2.5 rounded-full"
                                  style={{ 
                                    backgroundColor: "#c4b5fd",
                                    width: idx % 3 === 0 ? "30%" : idx % 3 === 1 ? "20%" : "40%"
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Texto fora do box */}
                      <p className="text-sm text-gray-700 mb-4">
                        {plan.previousPlanIncluded.description.split(plan.previousPlanIncluded.planLabel)[0]}
                        <span className="font-bold">{plan.previousPlanIncluded.planLabel}</span>
                        {plan.previousPlanIncluded.description.split(plan.previousPlanIncluded.planLabel)[1]}
                      </p>

                      {/* Recursos extras */}
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

                  {/* Garantias fixas - apenas para PRO e PREMIUM */}
                  {(plan.id === "pro" || plan.id === "premium") && (
                    <div className="space-y-3 mt-auto mb-5">
                      {PLAN_GUARANTEES.map((guarantee, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <guarantee.icon 
                            className="w-5 h-5 flex-shrink-0 mt-0.5" 
                            style={{ color: VM_GREEN }}
                            strokeWidth={2}
                          />
                          <span className="text-sm font-semibold text-black">
                            {guarantee.text}
                          </span>
                        </div>
                      ))}
                    </div>
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
