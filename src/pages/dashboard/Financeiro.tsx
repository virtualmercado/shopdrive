import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PlansSection } from "@/components/plans/PlansSection";
import { PaymentDataSection } from "@/components/financeiro/PaymentDataSection";
import { InvoiceHistorySection } from "@/components/financeiro/InvoiceHistorySection";
import { SubscriptionStatusAlert } from "@/components/financeiro/SubscriptionStatusAlert";
import { Crown } from "lucide-react";

interface SubscriptionInfo {
  id: string;
  status: string;
  billingCycle: "monthly" | "annual";
  planId: string;
  cardToken?: string;
  paymentMethod?: string;
  // New fields for status tracking
  declineType?: string | null;
  lastDeclineCode?: string | null;
  lastDeclineMessage?: string | null;
  gracePeriodEndsAt?: string | null;
  nextRetryAt?: string | null;
  retryCount?: number | null;
  requiresCardUpdate?: boolean;
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentSectionRef = useRef<HTMLDivElement>(null);

  // Read contextual highlight from URL parameter (e.g., ?highlight=premium)
  const highlightPlan = searchParams.get("highlight");

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

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!user) return;

      // Fetch master subscription with all new status fields
      const { data: masterSub, error: masterSubError } = await supabase
        .from("master_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "pending", "past_due", "suspended", "payment_failed", "grace_period"])
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
          // New status tracking fields
          declineType: masterSub.decline_type,
          lastDeclineCode: masterSub.last_decline_code,
          lastDeclineMessage: masterSub.last_decline_message,
          gracePeriodEndsAt: masterSub.grace_period_ends_at,
          nextRetryAt: masterSub.next_retry_at,
          retryCount: masterSub.retry_count,
          requiresCardUpdate: masterSub.requires_card_update || false,
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
      handleSmoothNavigation("/register");
    } else {
      // Redirect to VM checkout for PRO/PREMIUM plans with smooth transition
      handleSmoothNavigation(`/gestor/checkout-assinatura?plano=${planId}&ciclo=mensal&origem=painel_lojista`);
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

    // Update subscription state to reflect card is now active and clear error states
    if (subscription) {
      setSubscription({
        ...subscription,
        cardToken: "validated",
        paymentMethod: "credit_card",
        status: "active", // Optimistic update - will be confirmed by backend
        requiresCardUpdate: false,
        declineType: null,
        lastDeclineMessage: null,
      });
    }
  };

  const scrollToPaymentSection = () => {
    paymentSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Status Alert - Show at the top if there's an issue */}
        {subscription && (
          <SubscriptionStatusAlert
            status={subscription.status}
            declineType={subscription.declineType}
            lastDeclineMessage={subscription.lastDeclineMessage}
            gracePeriodEndsAt={subscription.gracePeriodEndsAt}
            nextRetryAt={subscription.nextRetryAt}
            retryCount={subscription.retryCount}
            requiresCardUpdate={subscription.requiresCardUpdate}
            onUpdateCard={scrollToPaymentSection}
          />
        )}

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
            highlightPlan={highlightPlan}
          />
        </Card>

        {/* Payment Data Card Container - Only show if has subscription */}
        {subscription && (
          <Card className="p-6" ref={paymentSectionRef}>
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
