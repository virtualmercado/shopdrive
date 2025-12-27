import { useState } from "react";
import { CircleDollarSign, Coins, LockOpen, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import editIcon from "@/assets/edit-icon.png";

// VirtualMercado default colors
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
      { text: "Até 40 clientes ativos", included: true },
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
    buttonText: "Escolher PRO",
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
    buttonText: "Escolher PREMIUM",
    buttonAction: "upgrade",
  },
];

interface PlansSectionProps {
  currentPlan?: string;
  isLandingPage?: boolean;
  onPlanAction?: (planId: string, action: "free" | "current" | "upgrade") => void;
}

export const PlansSection = ({ currentPlan = "", isLandingPage = false, onPlanAction }: PlansSectionProps) => {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  const calculateAnnualPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    const annualTotal = monthlyPrice * 12;
    const discounted = annualTotal * 0.7; // 30% off
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

  const isCurrentPlan = (planId: string) => planId === currentPlan;

  return (
    <div className="w-full">
      {/* Toggle Mensal/Anual */}
      <div className="flex justify-center pb-6">
        <div className="inline-flex items-center rounded-lg bg-gray-100 p-1 gap-1">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={cn(
              "px-6 md:px-8 py-2.5 rounded-md text-sm font-semibold transition-all",
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
                "px-6 md:px-8 py-2.5 rounded-md text-sm font-semibold transition-all",
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
      <div className={cn(
        "grid gap-4 md:gap-6",
        isLandingPage 
          ? "grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto" 
          : "grid-cols-1 md:grid-cols-3"
      )}>
        {PLANS.map((plan) => {
          const isCurrent = isCurrentPlan(plan.id);
          const price = getDisplayPrice(plan);

          const isProPlan = plan.id === "pro";

          return (
            <div
              key={plan.id}
              className={cn(
                "bg-white rounded-xl flex flex-col relative transition-all",
                isLandingPage ? "p-4 md:p-5" : "p-6",
                isCurrent
                  ? "border-2 shadow-lg scale-[1.02]"
                  : isProPlan && isLandingPage
                    ? "border-[3px] shadow-lg"
                    : "border border-gray-200"
              )}
              style={{
                borderColor: isCurrent ? VM_PRIMARY : (isProPlan && isLandingPage ? VM_PRIMARY : undefined),
              }}
            >
              {/* Badge Recomendado para Plano PRO na Landing Page */}
              {isProPlan && isLandingPage && (
                <div 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: VM_ORANGE }}
                >
                  Recomendado
                </div>
              )}
              {/* Plan Header */}
              <div className="text-center mb-4">
                <h3
                  className={cn(
                    "font-bold italic mb-3",
                    isLandingPage ? "text-base md:text-lg" : "text-lg"
                  )}
                  style={{ color: VM_PRIMARY }}
                >
                  {plan.displayName}
                </h3>
                
                {/* Valor anual sem desconto (tachado) */}
                {billingPeriod === "annual" && plan.monthlyPrice > 0 && (
                  <p className={cn(
                    "text-gray-500 line-through mb-1",
                    isLandingPage ? "text-base" : "text-lg"
                  )}>
                    R$ {formatPrice(plan.monthlyPrice * 12)}
                  </p>
                )}
                
                <div className="flex items-baseline justify-center gap-1">
                  <span className={cn(
                    "font-bold text-gray-800",
                    isLandingPage ? "text-2xl md:text-3xl" : "text-3xl"
                  )}>
                    R$ {formatPrice(price)}
                  </span>
                  <span className="text-gray-800 text-sm">{getPriceSuffix(plan)}</span>
                </div>
                {plan.id === "gratis" && (
                  <p className={cn(
                    "text-gray-600 text-left mt-2",
                    isLandingPage ? "text-xs md:text-sm" : "text-sm"
                  )}>
                    Comece a vender agora,<br />sem custos.
                  </p>
                )}
                {plan.id === "pro" && (
                  <p className={cn(
                    "text-gray-600 text-left mt-2",
                    isLandingPage ? "text-xs md:text-sm" : "text-sm"
                  )}>
                    O melhor custo benefício<br />do mercado online.
                  </p>
                )}
                {plan.id === "premium" && (
                  <p className={cn(
                    "text-gray-600 text-left mt-2",
                    isLandingPage ? "text-xs md:text-sm" : "text-sm"
                  )}>
                    A solução ideal para quem quer<br />escalar mais rápido as vendas.
                  </p>
                )}
                {billingPeriod === "annual" && plan.monthlyPrice > 0 && (
                  <p 
                    className={cn(
                      "font-bold mt-1",
                      isLandingPage ? "text-xs md:text-sm" : "text-sm"
                    )}
                    style={{ color: VM_PRIMARY }}
                  >
                    - 30% de desconto no plano anual
                  </p>
                )}
              </div>

              {/* Divider */}
              <div
                className="h-px w-full mb-4"
                style={{ backgroundColor: VM_ORANGE }}
              />

              {/* Content Area */}
              <div className="flex-1 flex flex-col">
                {/* Plano GRÁTIS - Lista completa de recursos */}
                {plan.id === "gratis" && (
                  <div className={cn(
                    "mb-6",
                    isLandingPage ? "space-y-2" : "space-y-3"
                  )}>
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <img 
                          src={editIcon} 
                          alt="Incluído" 
                          className={cn(
                            "mt-0.5 flex-shrink-0",
                            isLandingPage ? "w-3 h-3 md:w-4 md:h-4" : "w-4 h-4"
                          )}
                        />
                        <span className={cn(
                          "font-medium text-black",
                          isLandingPage ? "text-xs md:text-sm" : "text-sm"
                        )}>
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
                      className={cn(
                        "rounded-lg mb-3",
                        isLandingPage ? "p-3" : "p-4"
                      )}
                      style={{ backgroundColor: "#f3e8ff" }}
                    >
                      <p 
                        className={cn(
                          "font-medium text-center mb-3 italic",
                          isLandingPage ? "text-xs md:text-sm" : "text-sm"
                        )}
                        style={{ color: VM_PRIMARY }}
                      >
                        {plan.previousPlanIncluded.planName}
                      </p>
                      
                      <div className={cn(
                        isLandingPage ? "space-y-2" : "space-y-2.5"
                      )}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((_, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <svg 
                              className={cn(
                                "flex-shrink-0",
                                isLandingPage ? "w-3 h-3 md:w-4 md:h-4" : "w-4 h-4"
                              )}
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
                                className={cn(
                                  "rounded-full",
                                  isLandingPage ? "h-2" : "h-2.5"
                                )}
                                style={{ 
                                  backgroundColor: "#c4b5fd",
                                  width: idx % 3 === 0 ? "45%" : idx % 3 === 1 ? "60%" : "35%"
                                }}
                              />
                              <div 
                                className={cn(
                                  "rounded-full",
                                  isLandingPage ? "h-2" : "h-2.5"
                                )}
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
                    <p className={cn(
                      "text-gray-700 mb-4",
                      isLandingPage ? "text-xs md:text-sm" : "text-sm"
                    )}>
                      {plan.previousPlanIncluded.description.split(plan.previousPlanIncluded.planLabel)[0]}
                      <span className="font-bold">{plan.previousPlanIncluded.planLabel}</span>
                      {plan.previousPlanIncluded.description.split(plan.previousPlanIncluded.planLabel)[1]}
                    </p>

                    {/* Recursos extras */}
                    {plan.extraFeatures && plan.extraFeatures.length > 0 && (
                      <div className={cn(
                        "mb-6",
                        isLandingPage ? "space-y-2" : "space-y-3"
                      )}>
                        {plan.extraFeatures.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <img 
                              src={editIcon} 
                              alt="Incluído" 
                              className={cn(
                                "mt-0.5 flex-shrink-0",
                                isLandingPage ? "w-3 h-3 md:w-4 md:h-4" : "w-4 h-4"
                              )}
                            />
                            <span className={cn(
                              "font-medium text-black",
                              isLandingPage ? "text-xs md:text-sm" : "text-sm"
                            )}>
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
                  <div className={cn(
                    "mt-auto mb-5",
                    isLandingPage ? "space-y-2" : "space-y-3"
                  )}>
                    {PLAN_GUARANTEES.map((guarantee, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <guarantee.icon 
                          className={cn(
                            "flex-shrink-0 mt-0.5",
                            isLandingPage ? "w-4 h-4 md:w-5 md:h-5" : "w-5 h-5"
                          )}
                          style={{ color: VM_GREEN }}
                          strokeWidth={2}
                        />
                        <span 
                          className={cn(
                            "font-semibold",
                            isLandingPage ? "text-xs md:text-sm" : "text-sm"
                          )}
                          style={{ color: VM_GREEN }}
                        >
                          {guarantee.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              {isLandingPage ? (
                <Link to="/register" className="mt-auto">
                  <Button
                    className={cn(
                      "w-full font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg",
                      isLandingPage ? "py-2.5" : "py-3"
                    )}
                    style={{
                      backgroundColor: VM_ORANGE,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#ea580c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = VM_ORANGE;
                    }}
                  >
                    {plan.buttonText}
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={() => onPlanAction?.(plan.id, plan.buttonAction)}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlansSection;
