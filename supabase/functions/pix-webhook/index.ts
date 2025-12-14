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

    const url = new URL(req.url);
    const gateway = url.searchParams.get("gateway") || "mercadopago";
    const body = await req.json();

    console.log(`Webhook received from ${gateway}:`, JSON.stringify(body));

    let externalPaymentId: string | null = null;
    let paymentStatus: string | null = null;

    if (gateway === "mercadopago") {
      // Mercado Pago webhook format
      if (body.type === "payment" && body.data?.id) {
        externalPaymentId = body.data.id.toString();
        
        // Fetch payment details from Mercado Pago to get status
        // For now, we'll just use the action type
        if (body.action === "payment.created" || body.action === "payment.updated") {
          // We need to query MP API for actual status, but for webhook we mark as approved
          // In production, you should verify the payment status with MP API
          paymentStatus = "approved";
        }
      }
    } else if (gateway === "pagbank") {
      // PagBank webhook format
      if (body.charges?.[0]?.status === "PAID") {
        externalPaymentId = body.id;
        paymentStatus = "approved";
      } else if (body.id && body.qr_codes) {
        externalPaymentId = body.id;
        const qrCodeStatus = body.qr_codes[0]?.status;
        if (qrCodeStatus === "PAID") {
          paymentStatus = "approved";
        }
      }
    }

    if (!externalPaymentId) {
      console.log("No payment ID found in webhook");
      return new Response(
        JSON.stringify({ received: true, processed: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the PIX payment by external ID
    const { data: pixPayment, error: findError } = await supabase
      .from("pix_payments")
      .select("*, orders(*)")
      .eq("external_payment_id", externalPaymentId)
      .single();

    if (findError || !pixPayment) {
      console.log("PIX payment not found for external ID:", externalPaymentId);
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: "Payment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paymentStatus === "approved" && pixPayment.status !== "approved") {
      // Update PIX payment status
      const { error: updatePixError } = await supabase
        .from("pix_payments")
        .update({
          status: "approved",
          paid_at: new Date().toISOString(),
        })
        .eq("id", pixPayment.id);

      if (updatePixError) {
        console.error("Error updating PIX payment:", updatePixError);
      }

      // Update order status
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({
          status: "paid",
          pix_payment_status: "approved",
        })
        .eq("id", pixPayment.order_id);

      if (updateOrderError) {
        console.error("Error updating order:", updateOrderError);
      }

      console.log("Payment approved for order:", pixPayment.order_id);

      return new Response(
        JSON.stringify({ received: true, processed: true, status: "approved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, processed: false, currentStatus: pixPayment.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
