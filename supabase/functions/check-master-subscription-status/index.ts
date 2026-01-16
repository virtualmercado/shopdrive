import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckStatusRequest {
  subscriptionId?: string;
  paymentId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { subscriptionId, paymentId }: CheckStatusRequest = await req.json();

    console.log("Checking status:", { subscriptionId, paymentId, userId });

    // Build query based on provided parameters
    let query = supabase
      .from("master_subscriptions")
      .select(`
        *,
        master_subscription_payments (
          id,
          status,
          payment_method,
          amount,
          pix_qr_code,
          pix_qr_code_base64,
          pix_expires_at,
          boleto_url,
          boleto_barcode,
          boleto_digitable_line,
          boleto_expires_at,
          gateway_payment_id,
          paid_at,
          created_at
        )
      `)
      .eq("user_id", userId);

    if (subscriptionId) {
      query = query.eq("id", subscriptionId);
    }

    const { data: subscription, error: subscriptionError } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error("Subscription query error:", subscriptionError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar assinatura" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscription) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: "Nenhuma assinatura encontrada" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If there's a pending payment, check its status with the gateway
    const pendingPayment = subscription.master_subscription_payments?.find(
      (p: any) => p.status === "pending" && p.gateway_payment_id
    );

    if (pendingPayment) {
      // Get gateway credentials
      const { data: gateway } = await supabase
        .from("master_payment_gateways")
        .select("mercadopago_access_token")
        .eq("is_active", true)
        .eq("is_default", true)
        .maybeSingle();

      if (gateway?.mercadopago_access_token) {
        try {
          const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${pendingPayment.gateway_payment_id}`,
            {
              headers: {
                "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
              },
            }
          );

          if (mpResponse.ok) {
            const mpPayment = await mpResponse.json();
            console.log("MP payment status:", mpPayment.status);

            // Update if status changed
            if (mpPayment.status === "approved" && pendingPayment.status !== "paid") {
              await supabase
                .from("master_subscription_payments")
                .update({
                  status: "paid",
                  gateway_status: mpPayment.status,
                  paid_at: mpPayment.date_approved || new Date().toISOString(),
                })
                .eq("id", pendingPayment.id);

              await supabase
                .from("master_subscriptions")
                .update({
                  status: "active",
                  started_at: new Date().toISOString(),
                })
                .eq("id", subscription.id);

              await supabase.from("master_subscription_logs").insert({
                subscription_id: subscription.id,
                user_id: userId,
                payment_id: pendingPayment.id,
                event_type: "subscription_activated",
                event_description: "Assinatura ativada via verificação de status",
              });

              // Update subscription object for response
              subscription.status = "active";
              pendingPayment.status = "paid";
            } else if (mpPayment.status === "rejected") {
              await supabase
                .from("master_subscription_payments")
                .update({
                  status: "failed",
                  gateway_status: mpPayment.status,
                })
                .eq("id", pendingPayment.id);

              pendingPayment.status = "failed";
            }
          }
        } catch (error) {
          console.error("Error checking MP payment:", error);
        }
      }
    }

    // Get latest payment
    const latestPayment = subscription.master_subscription_payments?.[0];

    return new Response(
      JSON.stringify({
        found: true,
        subscription: {
          id: subscription.id,
          planId: subscription.plan_id,
          billingCycle: subscription.billing_cycle,
          status: subscription.status,
          monthlyPrice: subscription.monthly_price,
          totalAmount: subscription.total_amount,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          startedAt: subscription.started_at,
          cancelledAt: subscription.cancelled_at,
        },
        latestPayment: latestPayment ? {
          id: latestPayment.id,
          status: latestPayment.status,
          paymentMethod: latestPayment.payment_method,
          amount: latestPayment.amount,
          paidAt: latestPayment.paid_at,
          pixQrCode: latestPayment.pix_qr_code,
          pixQrCodeBase64: latestPayment.pix_qr_code_base64,
          pixExpiresAt: latestPayment.pix_expires_at,
          boletoUrl: latestPayment.boleto_url,
          boletoBarcode: latestPayment.boleto_barcode,
          boletoDigitableLine: latestPayment.boleto_digitable_line,
          boletoExpiresAt: latestPayment.boleto_expires_at,
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Check status error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao verificar status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
