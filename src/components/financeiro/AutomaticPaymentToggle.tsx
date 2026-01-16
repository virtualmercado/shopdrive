import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditCard, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutomaticPaymentToggleProps {
  isActive: boolean;
  billingCycle: "monthly" | "annual";
  primaryColor?: string;
  className?: string;
}

export const AutomaticPaymentToggle = ({
  isActive,
  billingCycle,
  primaryColor = "#6a1b9a",
  className,
}: AutomaticPaymentToggleProps) => {
  // Toggle only exists for monthly plans
  if (billingCycle !== "monthly") return null;

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 border rounded-lg",
        isActive 
          ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" 
          : "bg-muted/30 border-border",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div 
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            isActive ? "bg-green-100 dark:bg-green-900" : "bg-muted"
          )}
        >
          <CreditCard 
            className={cn(
              "h-5 w-5",
              isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            )} 
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-foreground">
            Pagamento automático no cartão
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive 
              ? "As cobranças serão realizadas automaticamente todo mês" 
              : "Ative cadastrando um cartão válido"}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch 
          checked={isActive} 
          disabled 
          aria-readonly="true"
          className={cn(
            isActive && "data-[state=checked]:bg-green-500"
          )}
        />
        <div 
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full",
            isActive 
              ? "bg-green-500 text-white" 
              : "bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-400"
          )}
        >
          {isActive ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </div>
      </div>
    </div>
  );
};
