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

    const body = await req.json();

    console.log("Boleto webhook received:", JSON.stringify(body));

    let externalPaymentId: string | null = null;
    let paymentStatus: string | null = null;

    // Handle Mercado Pago webhook format
    if (body.type === "payment" && body.data?.id) {
      externalPaymentId = body.data.id.toString();
      
      // Check if payment was approved (for boleto)
      if (body.action === "payment.updated") {
        // Fetch payment details from Mercado Pago to verify status
        // The webhook only tells us there was an update, we need to check the actual status
        paymentStatus = "check_required";
      }
    }

    // Direct payment status update (when we already have the status)
    if (body.status && body.id) {
      externalPaymentId = body.id.toString();
      if (body.status === "approved") {
        paymentStatus = "approved";
      }
    }

    if (!externalPaymentId) {
      console.log("No payment ID found in webhook");
      return new Response(
        JSON.stringify({ received: true, processed: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the boleto payment by external ID
    const { data: boletoPayment, error: findError } = await supabase
      .from("boleto_payments")
      .select("*")
      .eq("external_payment_id", externalPaymentId)
      .maybeSingle();

    if (findError) {
      console.error("Error finding boleto payment:", findError);
      return new Response(
        JSON.stringify({ received: true, processed: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!boletoPayment) {
      // Try to find in pix_payments as fallback (webhook might come to wrong endpoint)
      const { data: pixPayment } = await supabase
        .from("pix_payments")
        .select("*")
        .eq("external_payment_id", externalPaymentId)
        .maybeSingle();

      if (pixPayment) {
        console.log("Payment found in pix_payments, this is a PIX payment");
        return new Response(
          JSON.stringify({ received: true, processed: false, reason: "PIX payment, use pix-webhook" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Boleto payment not found for external ID:", externalPaymentId);
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: "Payment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we need to check the payment status with MP API
    if (paymentStatus === "check_required") {
      // Get payment settings to get access token
      const { data: paymentSettings } = await supabase
        .from("payment_settings")
        .select("mercadopago_access_token")
        .eq("user_id", boletoPayment.store_owner_id)
        .single();

      if (paymentSettings?.mercadopago_access_token) {
        try {
          const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${externalPaymentId}`,
            {
              headers: {
                "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
              },
            }
          );

          if (mpResponse.ok) {
            const mpData = await mpResponse.json();
            console.log("MP payment status:", mpData.status);
            
            if (mpData.status === "approved") {
              paymentStatus = "approved";
            } else if (mpData.status === "rejected" || mpData.status === "cancelled") {
              paymentStatus = mpData.status;
            }
          }
        } catch (mpError) {
          console.error("Error fetching MP payment status:", mpError);
        }
      }
    }

    if (paymentStatus === "approved" && boletoPayment.status !== "approved") {
      console.log("Updating boleto payment to approved:", boletoPayment.id);

      // Update boleto payment status
      const { error: updateBoletoError } = await supabase
        .from("boleto_payments")
        .update({
          status: "approved",
          paid_at: new Date().toISOString(),
        })
        .eq("id", boletoPayment.id);

      if (updateBoletoError) {
        console.error("Error updating boleto payment:", updateBoletoError);
      }

      // Update order status
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({
          status: "paid",
          boleto_payment_status: "approved",
        })
        .eq("id", boletoPayment.order_id);

      if (updateOrderError) {
        console.error("Error updating order:", updateOrderError);
      }

      console.log("Boleto payment approved for order:", boletoPayment.order_id);

      return new Response(
        JSON.stringify({ received: true, processed: true, status: "approved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, processed: false, currentStatus: boletoPayment.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Boleto webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar webhook do boleto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
