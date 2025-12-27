import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PlansSection } from "@/components/plans/PlansSection";

const Financeiro = () => {
  const [currentPlan, setCurrentPlan] = useState<string>("gratis");
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
  }, [user]);

  const handlePlanAction = (planId: string, action: "free" | "current" | "upgrade") => {
    if (planId === currentPlan) return;
    
    if (action === "free") {
      window.location.href = "/register";
    } else {
      // Will redirect to master panel checkout in the future
      console.log("Redirect to checkout for plan:", planId);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Title - Left aligned, following dashboard pattern */}
        <h1 className="text-2xl font-semibold text-foreground">
          Meu Plano / Planos
        </h1>

        {/* Content Card Container */}
        <Card className="p-6">
          <PlansSection 
            currentPlan={currentPlan} 
            onPlanAction={handlePlanAction}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;
