import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Info, Loader2, CreditCard, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBannerDismiss } from "@/hooks/useBannerDismiss";
import { 
  useBillingStatus, 
  useBillingAlertContent, 
  useBillingSettings,
  BillingStatus 
} from "@/hooks/useBillingStatus";

interface AlertConfig {
  icon: React.ElementType;
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconClass: string;
}

const alertConfigs: Record<string, AlertConfig> = {
  past_due: {
    icon: AlertTriangle,
    bgClass: "bg-amber-50",
    textClass: "text-amber-900",
    borderClass: "border-amber-300",
    iconClass: "text-amber-600",
  },
  in_grace_period: {
    icon: AlertTriangle,
    bgClass: "bg-red-50",
    textClass: "text-red-900",
    borderClass: "border-red-300",
    iconClass: "text-red-600",
  },
  processing: {
    icon: Loader2,
    bgClass: "bg-blue-50",
    textClass: "text-blue-900",
    borderClass: "border-blue-300",
    iconClass: "text-blue-600",
  },
  downgraded: {
    icon: Info,
    bgClass: "bg-gray-50",
    textClass: "text-gray-900",
    borderClass: "border-gray-300",
    iconClass: "text-gray-600",
  },
  expired: {
    icon: XCircle,
    bgClass: "bg-orange-50",
    textClass: "text-orange-900",
    borderClass: "border-orange-300",
    iconClass: "text-orange-600",
  },
};

const replacePlaceholders = (
  message: string,
  billingInfo: {
    daysRemaining: number;
    planName: string;
    billingCycle: string;
    gracePeriodEndsAt: string | null;
  }
): string => {
  let result = message;
  
  result = result.replace(/{diasRestantes}/g, String(billingInfo.daysRemaining));
  result = result.replace(/{nomePlano}/g, billingInfo.planName);
  result = result.replace(/{ciclo}/g, billingInfo.billingCycle === "monthly" ? "mensal" : "anual");
  
  if (billingInfo.gracePeriodEndsAt) {
    const date = new Date(billingInfo.gracePeriodEndsAt);
    result = result.replace(/{dataVencimento}/g, date.toLocaleDateString("pt-BR"));
  }
  
  return result;
};

const getProcessingMessageByPaymentMethod = (
  paymentMethod: string | null
): { title: string; message: string } => {
  switch (paymentMethod) {
    case "pix":
      return {
        title: "⏳ Aguardando pagamento via PIX",
        message: "A confirmação ocorre normalmente em poucos segundos. Se já realizou o pagamento, aguarde a atualização automática.",
      };
    case "boleto":
      return {
        title: "⏳ Boleto em compensação",
        message: "A confirmação do pagamento por boleto pode levar de 1 a 3 dias úteis.",
      };
    case "credit_card":
      return {
        title: "✅ Processando pagamento",
        message: "Pagamento por cartão é confirmado automaticamente após aprovação.",
      };
    default:
      return {
        title: "⏳ Pagamento em processamento",
        message: "Seu pagamento está sendo processado. Aguarde a confirmação.",
      };
  }
};

export const GlobalBillingAlert = () => {
  const navigate = useNavigate();
  const { data: billingInfo, isLoading: billingLoading } = useBillingStatus();
  const { data: alertContent } = useBillingAlertContent();
  const { data: settings } = useBillingSettings();

  const status = billingInfo?.status || "active";

  const { isVisible, dismiss } = useBannerDismiss({
    bannerId: "global_billing",
    status,
    dismissHours: status === "in_grace_period" ? 2 : 6,
    autoHideMs: status === "processing" ? undefined : undefined,
  });

  // Don't show anything while loading
  if (billingLoading) {
    return null;
  }

  // Don't show if settings disabled
  if (settings && !settings.enabled) {
    return null;
  }

  // Don't show if no billing info or status is active
  if (!billingInfo || billingInfo.status === "active") {
    return null;
  }

  // Don't show for no_charge accounts
  if (billingInfo.noCharge) {
    return null;
  }

  if (!isVisible) return null;

  // Map billing status to alert key
  const getAlertKey = (status: BillingStatus): string => {
    if (status === "in_grace_period") return "in_grace_period";
    if (status === "processing") return "processing";
    if (status === "downgraded") return "downgraded";
    if (status === "expired") return "expired";
    return "past_due";
  };

  const alertKey = getAlertKey(billingInfo.status);
  const content = alertContent?.[alertKey];
  const config = alertConfigs[alertKey] || alertConfigs.past_due;

  // For "expired" we use hardcoded content (not in CMS) — fall through if missing
  const isExpired = alertKey === "expired";
  if (!content && !isExpired) {
    return null;
  }

  const Icon = config.icon;
  const isSpinning = alertKey === "processing";

  const handleCtaClick = () => {
    // Fluxo A — Regularizar fatura: mantém o plano atual e abre o checkout
    // da assinatura vigente, sem permitir troca de plano.
    const planId = billingInfo?.planId || "pro";
    const cycleParam = billingInfo?.billingCycle === "annual" ? "anual" : "mensal";
    navigate(
      `/gestor/checkout-assinatura?plano=${planId}&ciclo=${cycleParam}&origem=regularizar&flow=pay_invoice`
    );
  };

  // Override CMS content for "processing" status with payment-method-specific messages
  let displayTitle = content?.title || "";
  let displayMessage = content
    ? replacePlaceholders(content.message, {
        daysRemaining: billingInfo.daysRemaining,
        planName: billingInfo.planName,
        billingCycle: billingInfo.billingCycle,
        gracePeriodEndsAt: billingInfo.gracePeriodEndsAt,
      })
    : "";
  let displayCtaText = content?.cta_text || "";

  if (alertKey === "processing") {
    const methodMessages = getProcessingMessageByPaymentMethod(billingInfo.paymentMethod);
    displayTitle = methodMessages.title;
    displayMessage = methodMessages.message;
  } else if (isExpired) {
    displayTitle = "❌ Pagamento expirado";
    displayMessage = billingInfo.paymentMethod === "pix"
      ? "Seu PIX expirou sem confirmação. Gere um novo código para continuar."
      : "Seu pagamento expirou. Inicie uma nova assinatura para continuar.";
    displayCtaText = "Gerar novo pagamento";
  }

  return (
    <div 
      className={cn(
        "w-full px-4 py-3 border-b-2 relative transition-all duration-300 animate-in fade-in slide-in-from-top-1",
        config.bgClass,
        config.borderClass
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 max-w-7xl mx-auto pr-8">
        <div className="flex items-start gap-3">
          <Icon 
            className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              config.iconClass,
              isSpinning && "animate-spin"
            )} 
          />
          <div className="space-y-1">
            <p className={cn("font-semibold text-sm", config.textClass)}>
              {displayTitle}
            </p>
            <p className={cn("text-sm", config.textClass, "opacity-90")}>
              {displayMessage}
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleCtaClick}
          size="sm"
          className={cn(
            "shrink-0 gap-2",
            alertKey === "in_grace_period" && "bg-red-600 hover:bg-red-700 text-white",
            alertKey === "past_due" && "bg-amber-600 hover:bg-amber-700 text-white",
            alertKey === "processing" && "bg-blue-600 hover:bg-blue-700 text-white",
            alertKey === "downgraded" && "bg-gray-700 hover:bg-gray-800 text-white",
            alertKey === "expired" && "bg-orange-600 hover:bg-orange-700 text-white"
          )}
        >
          {(alertKey === "past_due" || alertKey === "in_grace_period") && (
            <CreditCard className="h-4 w-4" />
          )}
          {displayCtaText}
        </Button>
      </div>

      <button
        onClick={dismiss}
        className={cn(
          "absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-black/5",
          config.iconClass
        )}
        aria-label="Fechar alerta"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
