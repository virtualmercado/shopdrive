import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Info, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export const GlobalBillingAlert = () => {
  const navigate = useNavigate();
  const { data: billingInfo, isLoading: billingLoading } = useBillingStatus();
  const { data: alertContent } = useBillingAlertContent();
  const { data: settings } = useBillingSettings();

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

  // Map billing status to alert key
  const getAlertKey = (status: BillingStatus): string => {
    if (status === "in_grace_period") return "in_grace_period";
    if (status === "processing") return "processing";
    if (status === "downgraded") return "downgraded";
    return "past_due";
  };

  const alertKey = getAlertKey(billingInfo.status);
  const content = alertContent?.[alertKey];
  const config = alertConfigs[alertKey] || alertConfigs.past_due;

  if (!content) {
    return null;
  }

  const Icon = config.icon;
  const isSpinning = alertKey === "processing";

  const handleCtaClick = () => {
    navigate(content.cta_url);
  };

  const displayMessage = replacePlaceholders(content.message, {
    daysRemaining: billingInfo.daysRemaining,
    planName: billingInfo.planName,
    billingCycle: billingInfo.billingCycle,
    gracePeriodEndsAt: billingInfo.gracePeriodEndsAt,
  });

  return (
    <div 
      className={cn(
        "w-full px-4 py-3 border-b-2",
        config.bgClass,
        config.borderClass
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 max-w-7xl mx-auto">
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
              {content.title}
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
            alertKey === "downgraded" && "bg-gray-700 hover:bg-gray-800 text-white"
          )}
        >
          {(alertKey === "past_due" || alertKey === "in_grace_period") && (
            <CreditCard className="h-4 w-4" />
          )}
          {content.cta_text}
        </Button>
      </div>
    </div>
  );
};
