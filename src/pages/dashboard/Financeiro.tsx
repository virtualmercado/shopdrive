import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PlansSection } from "@/components/plans/PlansSection";
import { PaymentDataSection } from "@/components/financeiro/PaymentDataSection";
import { InvoiceHistorySection } from "@/components/financeiro/InvoiceHistorySection";
import { Crown } from "lucide-react";

// Mock saved card for demonstration - in production this would come from the database
const mockSavedCard = {
  holderName: "GENILSON R DE OLIVEIRA",
  lastFourDigits: "0104",
  expirationMonth: "12",
  expirationYear: "2023",
};

const Financeiro = () => {
  const [currentPlan, setCurrentPlan] = useState<string>("gratis");
  const [savedCard, setSavedCard] = useState<typeof mockSavedCard | null>(null);
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
    
    // For demonstration, simulate having a saved card
    // In production, this would fetch from the database
    setSavedCard(mockSavedCard);
  }, [user]);

  const handlePlanAction = (planId: string, action: "free" | "current" | "upgrade") => {
    if (planId === currentPlan) return;
    
    if (action === "free") {
      window.location.href = "/register";
    } else {
      // Redirect to VM checkout for PRO/PREMIUM plans
      window.location.href = `/gestor/checkout-assinatura?plano=${planId}&ciclo=mensal&origem=painel_lojista`;
    }
  };

  const handleCardSave = (cardData: {
    cardNumber: string;
    holderName: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
  }) => {
    // In production, this would save to the database and validate with payment gateway
    console.log("Card data to save:", cardData);
    setSavedCard({
      holderName: cardData.holderName,
      lastFourDigits: cardData.cardNumber.replace(/\s/g, "").slice(-4),
      expirationMonth: cardData.expirationMonth,
      expirationYear: cardData.expirationYear,
    });
  };

  const handlePaymentMethodChange = (method: "card" | "boleto") => {
    console.log("Payment method changed to:", method);
    // In production, this would update the user's preferred payment method
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Plans Card Container */}
        <Card className="p-6">
          {/* Header for Plans Section */}
          <div className="space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <Crown className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Meu Plano / Planos
              </h2>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Gerencie sua assinatura e conheça nossos planos
            </p>
          </div>
          <PlansSection 
            currentPlan={currentPlan} 
            onPlanAction={handlePlanAction}
          />
        </Card>

        {/* Payment Data Card Container */}
        <Card className="p-6">
          <PaymentDataSection
            savedCard={savedCard}
            onCardSave={handleCardSave}
            onPaymentMethodChange={handlePaymentMethodChange}
          />
        </Card>

        {/* Invoice History Card Container */}
        <Card className="p-6">
          <InvoiceHistorySection />
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;
