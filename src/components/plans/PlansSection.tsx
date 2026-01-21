import { useState, useCallback } from "react";
import { CircleDollarSign, Coins, LockOpen, Trophy, Check, Star, Zap, Shield, Gift, Award, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import editIcon from "@/assets/edit-icon.png";
import { useCMSContent } from "@/hooks/useCMSContent";

// VirtualMercado default colors
const VM_PRIMARY = "#6a1b9a";
const VM_ORANGE = "#f97316";
const VM_GREEN = "#16a34a";

// Icon mapping for dynamic icons
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  CircleDollarSign,
  Coins,
  LockOpen,
  Trophy,
  Check,
  Star,
  Zap,
  Shield,
  Gift,
  Award,
  Crown,
};

// Default guarantees (fallback)
const DEFAULT_GUARANTEES = [
  { icon: "CircleDollarSign", text: "Garantia de 7 dias" },
  { icon: "Coins", text: "Sem comissão sobre as vendas" },
  { icon: "LockOpen", text: "Cancele a qualquer momento, sem multas ou taxas" },
  { icon: "Trophy", text: "Plano escolhido por milhares de assinantes" },
];

// Default plans (fallback)
const DEFAULT_PLANS = [
  {
    id: "gratis",
    name: "GRÁTIS",
    display_name: "Plano GRÁTIS",
    subtitle: "Comece a vender agora, sem custos.",
    monthly_price: 0,
    button_text: "Começar grátis",
    badge_text: "",
    badge_active: false,
    badge_color: "#f97316",
    features: [
      { icon: "Check", text: "Até 20 produtos cadastrados" },
      { icon: "Check", text: "Até 40 clientes ativos" },
      { icon: "Check", text: "Pedidos ilimitados" },
      { icon: "Check", text: "ERP (Gestor Virtual) integrado" },
      { icon: "Check", text: "Frete personalizado" },
      { icon: "Check", text: "Gerador de catálogo PDF ilimitado" },
      { icon: "Check", text: "Controle de estoque" },
      { icon: "Check", text: "Sem anúncios" },
      { icon: "Check", text: "Agente de mensagens" },
      { icon: "Check", text: "Calculadora de frete" },
      { icon: "Check", text: "Versão mobile responsiva" },
      { icon: "Check", text: "Categorias e subcategorias ilimitadas" },
      { icon: "Check", text: "Dashboard e relatórios avançados" },
      { icon: "Check", text: "Compartilhamento com suas redes sociais" },
      { icon: "Check", text: "Gateway e checkout de pagamentos" },
    ],
  },
  {
    id: "pro",
    name: "PRO",
    display_name: "Plano PRO",
    subtitle: "O melhor custo benefício do mercado online.",
    monthly_price: 29.97,
    button_text: "Escolher PRO",
    badge_text: "Recomendado",
    badge_active: true,
    badge_color: "#f97316",
    previous_plan: {
      name: "Plano GRÁTIS",
      label: "GRÁTIS",
      description: "Tudo o que o plano GRÁTIS oferece, e mais:",
    },
    features: [
      { icon: "Check", text: "Até 150 produtos cadastrados" },
      { icon: "Check", text: "Até 300 clientes ativos" },
      { icon: "Check", text: "Personalização total do seu site (sua logo e cores)" },
      { icon: "Check", text: "Cupons de desconto ilimitado" },
    ],
  },
  {
    id: "premium",
    name: "PREMIUM",
    display_name: "Plano PREMIUM",
    subtitle: "A solução ideal para quem quer escalar mais rápido as vendas.",
    monthly_price: 49.97,
    button_text: "Escolher PREMIUM",
    badge_text: "",
    badge_active: false,
    badge_color: "#f97316",
    previous_plan: {
      name: "Plano PRO",
      label: "PRO",
      description: "Tudo o que o plano PRO oferece, e mais:",
    },
    features: [
      { icon: "Check", text: "Produtos ilimitados" },
      { icon: "Check", text: "Clientes ilimitados" },
      { icon: "Check", text: "Editor de imagens com IA" },
      { icon: "Check", text: "Vínculo de domínio próprio" },
      { icon: "Check", text: "Suporte dedicado via e-mail e WhatsApp" },
    ],
  },
];

interface PlansSectionProps {
  currentPlan?: string;
  isLandingPage?: boolean;
  onPlanAction?: (planId: string, action: "free" | "current" | "upgrade") => void;
}

export const PlansSection = ({ currentPlan = "", isLandingPage = false, onPlanAction }: PlansSectionProps) => {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const { data: cmsContent } = useCMSContent();
  const navigate = useNavigate();

  // Get plans content from CMS or use defaults
  const plansContent = cmsContent?.plans || {};
  // Use defaults if arrays are empty or undefined
  const plans = (plansContent.plans && plansContent.plans.length > 0) ? plansContent.plans : DEFAULT_PLANS;
  const guarantees = (plansContent.guarantees && plansContent.guarantees.length > 0) ? plansContent.guarantees : DEFAULT_GUARANTEES;
  const toggleMonthly = plansContent.toggle_monthly || "Mensal";
  const toggleAnnual = plansContent.toggle_annual || "Anual";
  const discountBadge = plansContent.discount_badge || "-30% DESC.";
  const annualDiscountText = plansContent.annual_discount_text || "- 30% de desconto no plano anual";
  const sectionTitle = plansContent.modal_title || "Escolha o plano ideal para você";
  const sectionSubtitle = plansContent.modal_subtitle || "Comece grátis e faça upgrade quando quiser";

  // Smooth navigation with page transition animation
  const handleSmoothNavigation = useCallback((path: string) => {
    const pageContent = document.querySelector('[data-page-content]');
    if (pageContent) {
      pageContent.classList.add('page-exit');
      setTimeout(() => {
        navigate(path);
      }, 700); // Slower transition to checkout
    } else {
      navigate(path);
    }
  }, [navigate]);

  const calculateAnnualPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    const annualTotal = monthlyPrice * 12;
    const discounted = annualTotal * 0.7; // 30% off
    return discounted;
  };

  const getDisplayPrice = (monthlyPrice: number) => {
    if (billingPeriod === "monthly") {
      return monthlyPrice;
    }
    return calculateAnnualPrice(monthlyPrice);
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "0";
    return price.toFixed(2).replace(".", ",");
  };

  const getPriceSuffix = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return "/mês";
    return billingPeriod === "monthly" ? "/mês" : "/ano";
  };

  const isCurrentPlan = (planId: string) => planId === currentPlan;

  const getButtonAction = (planId: string): "free" | "current" | "upgrade" => {
    if (planId === "gratis") return "free";
    if (isCurrentPlan(planId)) return "current";
    return "upgrade";
  };

  const getIconComponent = (iconName: string) => {
    return ICON_MAP[iconName] || Check;
  };

  return (
    <div className="w-full">
      {/* Section Header - from CMS */}
      {isLandingPage && (
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            {sectionTitle}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            {sectionSubtitle}
          </p>
        </div>
      )}

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
            {toggleMonthly}
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
              {toggleAnnual}
            </button>
            {billingPeriod === "monthly" && (
              <span 
                className="px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap"
                style={{ backgroundColor: VM_ORANGE }}
              >
                {discountBadge}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className={cn(
        "grid gap-6 md:gap-8 lg:gap-10",
        isLandingPage 
          ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto" 
          : "grid-cols-1 md:grid-cols-3"
      )}>
        {plans.map((plan: any) => {
          const isCurrent = isCurrentPlan(plan.id);
          const price = getDisplayPrice(plan.monthly_price);
          const isProPlan = plan.id === "pro";
          const showBadge = plan.badge_active && plan.badge_text;

          return (
            <div
              key={plan.id}
              className={cn(
                "bg-white rounded-xl flex flex-col relative transition-all",
                isLandingPage ? "p-4 md:p-5" : "p-6",
                isCurrent
                  ? "border-2 shadow-lg scale-[1.02]"
                  : (showBadge && isLandingPage)
                    ? "border-[3px] shadow-lg"
                    : "border border-gray-200"
              )}
              style={{
                borderColor: isCurrent ? VM_PRIMARY : (showBadge && isLandingPage ? VM_PRIMARY : undefined),
              }}
            >
              {/* Badge */}
              {showBadge && isLandingPage && (
                <div 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: plan.badge_color || VM_ORANGE }}
                >
                  {plan.badge_text}
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
                  {plan.display_name}
                </h3>
                
                {/* Valor anual sem desconto (tachado) */}
                {billingPeriod === "annual" && plan.monthly_price > 0 && (
                  <p className={cn(
                    "text-gray-500 line-through mb-1",
                    isLandingPage ? "text-base" : "text-lg"
                  )}>
                    R$ {formatPrice(plan.monthly_price * 12)}
                  </p>
                )}
                
                <div className="flex items-baseline justify-center gap-1">
                  <span className={cn(
                    "font-bold text-gray-800",
                    isLandingPage ? "text-2xl md:text-3xl" : "text-3xl"
                  )}>
                    R$ {formatPrice(price)}
                  </span>
                  <span className="text-gray-800 text-sm">{getPriceSuffix(plan.monthly_price)}</span>
                </div>
                
                {plan.subtitle && (
                  <p className={cn(
                    "text-gray-600 text-left mt-2",
                    isLandingPage ? "text-xs md:text-sm" : "text-sm"
                  )}>
                    {plan.subtitle.split('\n').map((line: string, i: number) => (
                      <span key={i}>
                        {line}
                        {i < plan.subtitle.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                )}
                
                {billingPeriod === "annual" && plan.monthly_price > 0 && (
                  <p 
                    className={cn(
                      "font-bold mt-1",
                      isLandingPage ? "text-xs md:text-sm" : "text-sm"
                    )}
                    style={{ color: VM_PRIMARY }}
                  >
                    {annualDiscountText}
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
                    {plan.features.map((feature: any, idx: number) => (
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
                {plan.previous_plan && (
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
                        {plan.previous_plan.name}
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
                      {plan.previous_plan.description.split(plan.previous_plan.label)[0]}
                      <span className="font-bold">{plan.previous_plan.label}</span>
                      {plan.previous_plan.description.split(plan.previous_plan.label)[1]}
                    </p>

                    {/* Recursos extras */}
                    {plan.features && plan.features.length > 0 && (
                      <div className={cn(
                        "mb-6",
                        isLandingPage ? "space-y-2" : "space-y-3"
                      )}>
                        {plan.features.map((feature: any, idx: number) => (
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
                    {guarantees.map((guarantee: any, idx: number) => {
                      const IconComponent = getIconComponent(guarantee.icon);
                      return (
                        <div key={idx} className="flex items-start gap-2.5">
                          <IconComponent 
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
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Button */}
              {isLandingPage ? (
                <Button
                  onClick={() => {
                    const path = plan.id === "gratis" 
                      ? "/register" 
                      : `/gestor/checkout-assinatura?plano=${plan.id}&ciclo=${billingPeriod === "monthly" ? "mensal" : "anual"}&origem=landing`;
                    handleSmoothNavigation(path);
                  }}
                  className={cn(
                    "w-full font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg mt-auto",
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
                  {plan.button_text}
                </Button>
              ) : (
                <Button
                  onClick={() => onPlanAction?.(plan.id, getButtonAction(plan.id))}
                  disabled={isCurrent}
                  className={cn(
                    "w-full py-3 font-semibold text-white transition-all duration-300 mt-auto",
                    isCurrent ? "cursor-default" : "hover:scale-105 hover:shadow-lg"
                  )}
                  style={{
                    backgroundColor: isCurrent ? VM_PRIMARY : VM_ORANGE,
                    opacity: 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = "#ea580c";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = VM_ORANGE;
                    }
                  }}
                >
                  {isCurrent ? "Meu plano atual" : plan.button_text}
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
