import { AlertTriangle, AlertCircle, CreditCard, Clock, XCircle, X, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBannerDismiss } from "@/hooks/useBannerDismiss";

interface SubscriptionStatusAlertProps {
  status: string;
  declineType?: string | null;
  lastDeclineMessage?: string | null;
  gracePeriodEndsAt?: string | null;
  nextRetryAt?: string | null;
  retryCount?: number | null;
  requiresCardUpdate?: boolean;
  onUpdateCard?: () => void;
  statusTimestamp?: string | null;
  paymentMethod?: string | null;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDaysRemaining = (dateString: string): number => {
  const endDate = new Date(dateString);
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const MS_48H = 48 * 60 * 60 * 1000;
const MS_5S = 5000;

export const SubscriptionStatusAlert = ({
  status,
  declineType,
  lastDeclineMessage,
  gracePeriodEndsAt,
  nextRetryAt,
  retryCount,
  requiresCardUpdate,
  onUpdateCard,
  statusTimestamp,
  paymentMethod,
}: SubscriptionStatusAlertProps) => {
  // Determine dismiss behavior per status
  const getDismissConfig = () => {
    switch (status) {
      case "pending":
      case "processing":
        return { autoHideMs: undefined, maxDisplayMs: MS_48H, dismissHours: 6 };
      case "active":
        // "approved" scenario - brief green confirmation
        return { autoHideMs: MS_5S, maxDisplayMs: undefined, dismissHours: 24 };
      case "past_due":
      case "payment_failed":
        return { autoHideMs: undefined, maxDisplayMs: undefined, dismissHours: 4 };
      case "suspended":
      case "cancelled":
        return { autoHideMs: undefined, maxDisplayMs: undefined, dismissHours: 2 };
      default:
        return { autoHideMs: undefined, maxDisplayMs: undefined, dismissHours: 6 };
    }
  };

  const dismissConfig = getDismissConfig();

  const { isVisible, dismiss } = useBannerDismiss({
    bannerId: "subscription_status",
    status,
    autoHideMs: dismissConfig.autoHideMs,
    maxDisplayMs: dismissConfig.maxDisplayMs,
    dismissHours: dismissConfig.dismissHours,
    statusTimestamp,
  });

  // Don't show for truly active accounts (no recent payment event)
  if (status === "active" && !statusTimestamp) {
    return null;
  }

  // Only show alerts for specific statuses
  if (!["active", "pending", "processing", "past_due", "payment_failed", "suspended", "cancelled", "expired"].includes(status)) {
    return null;
  }

  if (!isVisible) return null;

  const daysRemaining = gracePeriodEndsAt ? getDaysRemaining(gracePeriodEndsAt) : 0;
  const isHardDecline = declineType === "hard" || requiresCardUpdate;

  // Active/approved status - brief green confirmation
  if (status === "active" && statusTimestamp) {
    return (
      <Alert className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 relative transition-all duration-300 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-3 pr-8">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <AlertTitle className="font-semibold text-emerald-900">
              Pagamento aprovado!
            </AlertTitle>
            <AlertDescription className="text-sm text-emerald-800">
              Seu pagamento foi processado com sucesso.
            </AlertDescription>
          </div>
        </div>
        <CloseButton onClick={dismiss} className="text-emerald-600 hover:text-emerald-800" />
      </Alert>
    );
  }

  // Pending/processing status
  if (status === "pending" || status === "processing") {
    const getProcessingContent = () => {
      switch (paymentMethod) {
        case "pix":
          return {
            title: "Aguardando pagamento via PIX",
            description: "A confirmação ocorre normalmente em poucos segundos. Se já realizou o pagamento, aguarde a atualização automática.",
          };
        case "boleto":
          return {
            title: "Boleto em compensação",
            description: "A confirmação do pagamento por boleto pode levar de 1 a 3 dias úteis.",
          };
        case "credit_card":
          return {
            title: "Processando pagamento",
            description: "Pagamento por cartão é confirmado automaticamente após aprovação.",
          };
        default:
          return {
            title: "Pagamento em processamento",
            description: "Seu pagamento está sendo processado. Aguarde a confirmação.",
          };
      }
    };
    const processingContent = getProcessingContent();

    return (
      <Alert className="bg-blue-50 border-2 border-blue-300 text-blue-900 relative transition-all duration-300 animate-in fade-in slide-in-from-top-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pr-8">
          <div className="flex gap-3">
            <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <AlertTitle className="font-semibold text-blue-900">
                {processingContent.title}
              </AlertTitle>
              <AlertDescription className="text-sm text-blue-800">
                {processingContent.description}
              </AlertDescription>
            </div>
          </div>
        </div>
        <CloseButton onClick={dismiss} className="text-blue-600 hover:text-blue-800" />
      </Alert>
    );
  }

  // Past due status
  if (status === "past_due" || status === "payment_failed") {
    return (
      <Alert
        variant="destructive"
        className={cn(
          "border-2 relative transition-all duration-300 animate-in fade-in slide-in-from-top-2",
          isHardDecline
            ? "bg-red-50 border-red-300 text-red-900"
            : "bg-amber-50 border-amber-300 text-amber-900"
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pr-8">
          <div className="flex gap-3">
            {isHardDecline ? (
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <AlertTitle className={cn(
                "font-semibold",
                isHardDecline ? "text-red-900" : "text-amber-900"
              )}>
                {isHardDecline
                  ? "Pagamento recusado - Atualização necessária"
                  : "Pagamento pendente"}
              </AlertTitle>
              <AlertDescription className={cn(
                "text-sm",
                isHardDecline ? "text-red-800" : "text-amber-800"
              )}>
                {lastDeclineMessage || "Houve um problema com seu pagamento."}
                {daysRemaining > 0 && (
                  <span className="block mt-1 font-medium">
                    Você tem {daysRemaining} dia{daysRemaining !== 1 ? "s" : ""} para regularizar
                    (até {gracePeriodEndsAt && formatDate(gracePeriodEndsAt)}).
                  </span>
                )}
                {!isHardDecline && nextRetryAt && (
                  <span className="block mt-1 text-xs">
                    Próxima tentativa automática: {formatDateTime(nextRetryAt)}
                    (tentativa {(retryCount || 0) + 1})
                  </span>
                )}
              </AlertDescription>
            </div>
          </div>

          {isHardDecline && onUpdateCard && (
            <Button
              onClick={onUpdateCard}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Atualizar cartão
            </Button>
          )}
        </div>
        <CloseButton
          onClick={dismiss}
          className={isHardDecline ? "text-red-600 hover:text-red-800" : "text-amber-600 hover:text-amber-800"}
        />
      </Alert>
    );
  }

  // Suspended status
  if (status === "suspended") {
    return (
      <Alert
        variant="destructive"
        className="bg-red-50 border-2 border-red-400 text-red-900 relative transition-all duration-300 animate-in fade-in slide-in-from-top-2"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pr-8">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="font-semibold text-red-900">
                Assinatura suspensa
              </AlertTitle>
              <AlertDescription className="text-sm text-red-800">
                Sua assinatura foi suspensa por falta de pagamento.
                Atualize seu cartão para reativar seu plano e recuperar o acesso completo.
              </AlertDescription>
            </div>
          </div>

          {onUpdateCard && (
            <Button
              onClick={onUpdateCard}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Atualizar cartão
            </Button>
          )}
        </div>
        <CloseButton onClick={dismiss} className="text-red-600 hover:text-red-800" />
      </Alert>
    );
  }

  // Expired status (PIX vencido / pagamento não concluído)
  if (status === "expired") {
    const expiredMessage = paymentMethod === "pix"
      ? "Seu PIX expirou sem confirmação. Gere um novo código para continuar."
      : paymentMethod === "boleto"
        ? "Seu boleto expirou. Gere um novo pagamento para continuar."
        : "Seu pagamento expirou. Inicie uma nova assinatura para continuar.";

    return (
      <Alert className="bg-orange-50 border-2 border-orange-300 text-orange-900 relative transition-all duration-300 animate-in fade-in slide-in-from-top-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pr-8">
          <div className="flex gap-3">
            <XCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="font-semibold text-orange-900">
                Pagamento expirado
              </AlertTitle>
              <AlertDescription className="text-sm text-orange-800">
                {expiredMessage}
              </AlertDescription>
            </div>
          </div>
          {onUpdateCard && (
            <Button
              onClick={onUpdateCard}
              className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              Gerar novo pagamento
            </Button>
          )}
        </div>
        <CloseButton onClick={dismiss} className="text-orange-600 hover:text-orange-800" />
      </Alert>
    );
  }

  // Cancelled status
  if (status === "cancelled") {
    return (
      <Alert className="bg-gray-50 border-2 border-gray-300 text-gray-900 relative transition-all duration-300 animate-in fade-in slide-in-from-top-2">
        <div className="flex gap-3 pr-8">
          <Clock className="h-5 w-5 text-gray-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <AlertTitle className="font-semibold text-gray-900">
              Assinatura cancelada
            </AlertTitle>
            <AlertDescription className="text-sm text-gray-700">
              Sua assinatura foi cancelada. Para continuar utilizando os recursos premium,
              faça uma nova assinatura.
            </AlertDescription>
          </div>
        </div>
        <CloseButton onClick={dismiss} className="text-gray-500 hover:text-gray-700" />
      </Alert>
    );
  }

  return null;
};

// Close button component
const CloseButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-black/5",
      className
    )}
    aria-label="Fechar alerta"
  >
    <X className="h-4 w-4" />
  </button>
);
