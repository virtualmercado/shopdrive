import { useState } from "react";
import { Pencil, CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { CardForm } from "./CardForm";
import { CardValidationStatus, ValidationStatus } from "./CardValidationStatus";
import { AutomaticPaymentToggle } from "./AutomaticPaymentToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// VirtualMercado default colors
const VM_PRIMARY = "#6a1b9a";

interface SavedCard {
  holderName: string;
  lastFourDigits: string;
  expirationMonth: string;
  expirationYear: string;
  brand?: string;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  billingCycle: "monthly" | "annual";
  planId: string;
  cardToken?: string;
  paymentMethod?: string;
}

interface PaymentDataSectionProps {
  savedCard?: SavedCard | null;
  subscription?: SubscriptionInfo | null;
  onCardValidated?: (cardData: {
    lastFourDigits: string;
    brand: string;
    holderName: string;
    expiry: string;
  }) => void;
}

export const PaymentDataSection = ({
  savedCard = null,
  subscription = null,
  onCardValidated,
}: PaymentDataSectionProps) => {
  const { primaryColor } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("idle");
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [currentCard, setCurrentCard] = useState<SavedCard | null>(savedCard);

  const activeColor = primaryColor || VM_PRIMARY;

  // Determine if automatic payment is active
  // Active when: monthly plan + card validated + subscription active
  const isAutomaticPaymentActive = 
    subscription?.billingCycle === "monthly" &&
    subscription?.status === "active" &&
    !!subscription?.cardToken;

  // Should show payment section?
  // Only for monthly plans OR annual plans paid via card
  const shouldShowPaymentSection = 
    subscription?.billingCycle === "monthly" ||
    (subscription?.billingCycle === "annual" && subscription?.paymentMethod === "credit_card");

  const handleCancelEdit = () => {
    setIsEditing(false);
    setValidationStatus("idle");
    setValidationMessage("");
  };

  const handleValidateCard = async (cardData: {
    cardNumber: string;
    holderName: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
    cardToken?: string;
    paymentMethodId?: string;
  }) => {
    if (!cardData.cardToken) {
      setValidationStatus("error");
      setValidationMessage("Não foi possível processar os dados do cartão. Tente novamente.");
      return;
    }

    setIsValidating(true);
    setValidationStatus("idle");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Sessão expirada");
      }

      const response = await supabase.functions.invoke("validate-card", {
        body: {
          cardToken: cardData.cardToken,
          paymentMethodId: cardData.paymentMethodId,
          holderName: cardData.holderName,
          expirationMonth: cardData.expirationMonth,
          expirationYear: cardData.expirationYear,
          lastFourDigits: cardData.cardNumber.slice(-4),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (result.success) {
        setValidationStatus("success");
        setValidationMessage(result.message);
        setIsEditing(false);
        
        // Update local card state
        setCurrentCard({
          holderName: cardData.holderName,
          lastFourDigits: cardData.cardNumber.slice(-4),
          expirationMonth: cardData.expirationMonth,
          expirationYear: cardData.expirationYear,
          brand: cardData.paymentMethodId,
        });

        // Notify parent
        onCardValidated?.({
          lastFourDigits: cardData.cardNumber.slice(-4),
          brand: cardData.paymentMethodId || "unknown",
          holderName: cardData.holderName,
          expiry: `${cardData.expirationMonth}/${cardData.expirationYear}`,
        });

        toast.success("Cartão validado com sucesso!");
      } else if (result.status === "rejected") {
        setValidationStatus("rejected");
        setValidationMessage(result.error);
      } else {
        setValidationStatus("error");
        setValidationMessage(result.error || "Erro na validação");
      }
    } catch (error: any) {
      console.error("Card validation error:", error);
      setValidationStatus("error");
      setValidationMessage(error.message || "Erro ao validar cartão");
    } finally {
      setIsValidating(false);
    }
  };

  // Don't render if section shouldn't be shown
  if (!shouldShowPaymentSection && subscription) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
            <CreditCard className="h-4 w-4 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Dados para pagamento
          </h2>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Gerencie o cartão de crédito vinculado à sua assinatura
        </p>
      </div>

      {/* Automatic Payment Toggle - Only for monthly */}
      {subscription?.billingCycle === "monthly" && (
        <AutomaticPaymentToggle
          isActive={isAutomaticPaymentActive}
          billingCycle={subscription.billingCycle}
          primaryColor={activeColor}
        />
      )}

      {/* Validation Status Messages */}
      <CardValidationStatus 
        status={validationStatus} 
        message={validationMessage}
      />

      {/* Card Summary or Edit Form */}
      {currentCard && !isEditing ? (
        // Saved card summary view
        <div className="border border-border rounded-lg p-4 bg-muted/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nome impresso</p>
                <p className="text-sm font-medium text-foreground">
                  {currentCard.holderName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Número do cartão</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    **** **** **** {currentCard.lastFourDigits}
                  </p>
                  {currentCard.brand && (
                    <span className="text-xs text-muted-foreground uppercase">
                      {currentCard.brand}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Data de expiração</p>
                <p className="text-sm font-medium text-foreground">
                  {currentCard.expirationMonth}/{currentCard.expirationYear}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="shrink-0 gap-2"
              style={{
                borderColor: activeColor,
                color: activeColor,
              }}
            >
              <Pencil className="h-4 w-4" />
              Alterar cartão
            </Button>
          </div>
        </div>
      ) : isEditing || !currentCard ? (
        // Card edit form
        <div className="border border-border rounded-lg p-4 md:p-6 bg-background">
          <CardForm
            onValidate={handleValidateCard}
            onCancel={currentCard ? handleCancelEdit : undefined}
            showCancelButton={!!currentCard}
            isLoading={isValidating}
            primaryColor={activeColor}
            initialData={currentCard ? {
              holderName: currentCard.holderName,
              expirationMonth: currentCard.expirationMonth,
              expirationYear: currentCard.expirationYear,
            } : undefined}
          />
        </div>
      ) : null}

      {/* Security notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span>
          Seus dados são protegidos com criptografia de ponta a ponta. 
          Não armazenamos os dados do seu cartão.
        </span>
      </div>
    </div>
  );
};
