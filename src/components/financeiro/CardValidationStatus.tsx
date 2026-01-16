import { CheckCircle2, AlertCircle, XCircle, Clock, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type ValidationStatus = "success" | "error" | "rejected" | "pending" | "idle";

interface CardValidationStatusProps {
  status: ValidationStatus;
  message?: string;
  className?: string;
}

const statusConfig: Record<ValidationStatus, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  defaultMessage: string;
  variant: "default" | "destructive";
  bgClass: string;
  iconClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    title: "Cartão validado com sucesso",
    defaultMessage: "O pagamento automático está ativo e as cobranças ocorrerão conforme o seu plano contratado.",
    variant: "default",
    bgClass: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
    iconClass: "text-green-600 dark:text-green-400",
  },
  error: {
    icon: AlertCircle,
    title: "Não foi possível validar o cartão",
    defaultMessage: "Verifique os dados informados ou utilize outro cartão de crédito válido.",
    variant: "destructive",
    bgClass: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
    iconClass: "text-yellow-600 dark:text-yellow-400",
  },
  rejected: {
    icon: XCircle,
    title: "Cartão recusado pelo emissor",
    defaultMessage: "O banco emissor não autorizou a validação. Tente outro cartão ou entre em contato com seu banco.",
    variant: "destructive",
    bgClass: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
    iconClass: "text-red-600 dark:text-red-400",
  },
  pending: {
    icon: Clock,
    title: "Problema na cobrança automática",
    defaultMessage: "Não foi possível realizar a cobrança no cartão cadastrado. Atualize os dados do cartão em até 7 dias para evitar a suspensão do plano.",
    variant: "default",
    bgClass: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  idle: {
    icon: CreditCard,
    title: "",
    defaultMessage: "",
    variant: "default",
    bgClass: "",
    iconClass: "",
  },
};

export const CardValidationStatus = ({ 
  status, 
  message,
  className 
}: CardValidationStatusProps) => {
  if (status === "idle") return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Alert className={cn(config.bgClass, className)}>
      <Icon className={cn("h-4 w-4", config.iconClass)} />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>
        {message || config.defaultMessage}
      </AlertDescription>
    </Alert>
  );
};
