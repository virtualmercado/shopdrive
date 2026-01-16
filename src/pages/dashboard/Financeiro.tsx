import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PlansSection } from "@/components/plans/PlansSection";
import { PaymentDataSection } from "@/components/financeiro/PaymentDataSection";
import { InvoiceHistorySection } from "@/components/financeiro/InvoiceHistorySection";
import { Crown } from "lucide-react";

interface SubscriptionInfo {
  id: string;
  status: string;
  billingCycle: "monthly" | "annual";
  planId: string;
  cardToken?: string;
  paymentMethod?: string;
}

interface SavedCard {
  holderName: string;
  lastFourDigits: string;
  expirationMonth: string;
  expirationYear: string;
  brand?: string;
}

const Financeiro = () => {
  const [currentPlan, setCurrentPlan] = useState<string>("gratis");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!user) return;

      // Fetch master subscription
      const { data: masterSub, error: masterSubError } = await supabase
        .from("master_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "pending", "payment_failed", "grace_period"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (masterSub && !masterSubError) {
        setCurrentPlan(masterSub.plan_id);
        setSubscription({
          id: masterSub.id,
          status: masterSub.status,
          billingCycle: masterSub.billing_cycle as "monthly" | "annual",
          planId: masterSub.plan_id,
          cardToken: masterSub.card_token || undefined,
          paymentMethod: masterSub.card_token ? "credit_card" : undefined,
        });

        // Set saved card info if exists
        if (masterSub.card_last_four) {
          setSavedCard({
            holderName: "TITULAR DO CARTÃO", // Not stored for security
            lastFourDigits: masterSub.card_last_four,
            expirationMonth: "**",
            expirationYear: "****",
            brand: masterSub.card_brand || undefined,
          });
        }
      } else {
        // Fallback to old subscriptions table
        const { data: oldSub } = await supabase
          .from("subscriptions")
          .select("plan_id, subscription_plans(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        if (oldSub?.subscription_plans) {
          const planName = (oldSub.subscription_plans as { name: string }).name?.toLowerCase();
          if (planName?.includes("pro")) {
            setCurrentPlan("pro");
          } else if (planName?.includes("premium")) {
            setCurrentPlan("premium");
          } else {
            setCurrentPlan("gratis");
          }
        }
      }
    };

    fetchSubscriptionData();
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

  const handleCardValidated = (cardData: {
    lastFourDigits: string;
    brand: string;
    holderName: string;
    expiry: string;
  }) => {
    const [month, year] = cardData.expiry.split("/");
    setSavedCard({
      holderName: cardData.holderName,
      lastFourDigits: cardData.lastFourDigits,
      expirationMonth: month,
      expirationYear: year,
      brand: cardData.brand,
    });

    // Update subscription state to reflect card is now active
    if (subscription) {
      setSubscription({
        ...subscription,
        cardToken: "validated",
        paymentMethod: "credit_card",
      });
    }
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

        {/* Payment Data Card Container - Only show if has subscription */}
        {subscription && (
          <Card className="p-6">
            <PaymentDataSection
              savedCard={savedCard}
              subscription={subscription}
              onCardValidated={handleCardValidated}
            />
          </Card>
        )}

        {/* Invoice History Card Container */}
        <Card className="p-6">
          <InvoiceHistorySection />
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;
