import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook data
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const { type, data, action } = body;

    // Mercado Pago sends different formats
    // IPN: { topic: 'payment', id: '123' }
    // Webhook: { type: 'payment', data: { id: '123' } }
    
    let paymentId: string | null = null;
    let topic = type || body.topic;

    if (data?.id) {
      paymentId = data.id.toString();
    } else if (body.id && body.topic === "payment") {
      paymentId = body.id.toString();
    } else if (body.resource) {
      // Extract ID from resource URL
      const resourceParts = body.resource.split("/");
      paymentId = resourceParts[resourceParts.length - 1];
    }

    console.log("Parsed webhook:", { topic, paymentId, action });

    if (!paymentId && topic !== "test") {
      console.log("No payment ID found, ignoring webhook");
      return new Response(
        JSON.stringify({ received: true, message: "No payment ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle test webhook
    if (topic === "test" || action === "test") {
      console.log("Test webhook received");
      return new Response(
        JSON.stringify({ received: true, message: "Test webhook acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (topic !== "payment" && topic !== "merchant_order") {
      console.log("Ignoring non-payment webhook:", topic);
      return new Response(
        JSON.stringify({ received: true, message: `Topic ${topic} ignored` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find payment in our database
    const { data: payment, error: paymentError } = await supabase
      .from("master_subscription_payments")
      .select("*, master_subscriptions(*)")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();

    if (paymentError) {
      console.error("Error fetching payment:", paymentError);
    }

    if (!payment) {
      console.log("Payment not found in database:", paymentId);
      return new Response(
        JSON.stringify({ received: true, message: "Payment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found payment:", payment.id, "subscription:", payment.subscription_id);

    // Get gateway credentials to fetch payment details from MP
    const { data: gateway } = await supabase
      .from("master_payment_gateways")
      .select("mercadopago_access_token")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (!gateway?.mercadopago_access_token) {
      console.error("No gateway credentials found");
      return new Response(
        JSON.stringify({ error: "Gateway credentials not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current payment status from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
      },
    });

    if (!mpResponse.ok) {
      console.error("Error fetching MP payment:", await mpResponse.text());
      return new Response(
        JSON.stringify({ error: "Error fetching payment from MP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpPayment = await mpResponse.json();
    console.log("MP payment status:", mpPayment.status, mpPayment.status_detail);

    const previousStatus = payment.status;
    let newPaymentStatus = payment.status;
    let newSubscriptionStatus = payment.master_subscriptions?.status;

    // Map MP status to our status
    switch (mpPayment.status) {
      case "approved":
        newPaymentStatus = "paid";
        newSubscriptionStatus = "active";
        break;
      case "pending":
      case "in_process":
        newPaymentStatus = "pending";
        break;
      case "rejected":
        newPaymentStatus = "failed";
        if (payment.master_subscriptions?.billing_cycle === "monthly") {
          newSubscriptionStatus = "inadimplent";
        } else {
          newSubscriptionStatus = "cancelled";
        }
        break;
      case "cancelled":
        newPaymentStatus = "cancelled";
        newSubscriptionStatus = "cancelled";
        break;
      case "refunded":
        newPaymentStatus = "refunded";
        break;
    }

    console.log("Status update:", { previousStatus, newPaymentStatus, newSubscriptionStatus });

    // Update payment record
    const paymentUpdate: any = {
      status: newPaymentStatus,
      gateway_status: mpPayment.status,
      gateway_response: mpPayment,
      updated_at: new Date().toISOString(),
    };

    if (mpPayment.status === "approved" && !payment.paid_at) {
      paymentUpdate.paid_at = mpPayment.date_approved || new Date().toISOString();
    }

    if (mpPayment.status === "refunded" && !payment.refunded_at) {
      paymentUpdate.refunded_at = new Date().toISOString();
    }

    await supabase
      .from("master_subscription_payments")
      .update(paymentUpdate)
      .eq("id", payment.id);

    // Update subscription if status changed
    if (newSubscriptionStatus && newSubscriptionStatus !== payment.master_subscriptions?.status) {
      const subscriptionUpdate: any = {
        status: newSubscriptionStatus,
        updated_at: new Date().toISOString(),
      };

      if (newSubscriptionStatus === "active" && !payment.master_subscriptions?.started_at) {
        subscriptionUpdate.started_at = new Date().toISOString();
      }

      if (newSubscriptionStatus === "cancelled" && !payment.master_subscriptions?.cancelled_at) {
        subscriptionUpdate.cancelled_at = new Date().toISOString();
      }

      await supabase
        .from("master_subscriptions")
        .update(subscriptionUpdate)
        .eq("id", payment.subscription_id);

      // Log the status change
      await supabase.from("master_subscription_logs").insert({
        subscription_id: payment.subscription_id,
        user_id: payment.user_id,
        payment_id: payment.id,
        event_type: `subscription_${newSubscriptionStatus}`,
        event_description: `Status alterado de ${payment.master_subscriptions?.status} para ${newSubscriptionStatus}`,
        metadata: {
          previousStatus: payment.master_subscriptions?.status,
          newStatus: newSubscriptionStatus,
          mpStatus: mpPayment.status,
          mpStatusDetail: mpPayment.status_detail,
        }
      });
    }

    // Log payment status change
    if (previousStatus !== newPaymentStatus) {
      await supabase.from("master_subscription_logs").insert({
        subscription_id: payment.subscription_id,
        user_id: payment.user_id,
        payment_id: payment.id,
        event_type: `payment_${newPaymentStatus}`,
        event_description: `Pagamento ${newPaymentStatus === "paid" ? "confirmado" : newPaymentStatus}`,
        metadata: {
          previousStatus,
          newStatus: newPaymentStatus,
          mpPaymentId: paymentId,
          mpStatus: mpPayment.status,
        }
      });
    }

    console.log("Webhook processed successfully");

    return new Response(
      JSON.stringify({ 
        received: true, 
        paymentId: payment.id,
        subscriptionId: payment.subscription_id,
        newStatus: newPaymentStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook processing error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
