import { AlertTriangle, AlertCircle, CreditCard, Clock, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubscriptionStatusAlertProps {
  status: string;
  declineType?: string | null;
  lastDeclineMessage?: string | null;
  gracePeriodEndsAt?: string | null;
  nextRetryAt?: string | null;
  retryCount?: number | null;
  requiresCardUpdate?: boolean;
  onUpdateCard?: () => void;
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

export const SubscriptionStatusAlert = ({
  status,
  declineType,
  lastDeclineMessage,
  gracePeriodEndsAt,
  nextRetryAt,
  retryCount,
  requiresCardUpdate,
  onUpdateCard,
}: SubscriptionStatusAlertProps) => {
  // Only show alerts for problematic statuses
  if (status === "active" || status === "pending") {
    return null;
  }

  const daysRemaining = gracePeriodEndsAt ? getDaysRemaining(gracePeriodEndsAt) : 0;
  const isHardDecline = declineType === "hard" || requiresCardUpdate;

  // past_due status
  if (status === "past_due") {
    return (
      <Alert 
        variant="destructive" 
        className={cn(
          "border-2",
          isHardDecline 
            ? "bg-red-50 border-red-300 text-red-900" 
            : "bg-amber-50 border-amber-300 text-amber-900"
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
      </Alert>
    );
  }

  // suspended status
  if (status === "suspended") {
    return (
      <Alert 
        variant="destructive" 
        className="bg-red-50 border-2 border-red-400 text-red-900"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
      </Alert>
    );
  }

  // cancelled status
  if (status === "cancelled") {
    return (
      <Alert className="bg-gray-50 border-2 border-gray-300 text-gray-900">
        <div className="flex gap-3">
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
      </Alert>
    );
  }

  return null;
};
