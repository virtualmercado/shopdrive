import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify Mercado Pago webhook signature
async function verifyMercadoPagoSignature(
  req: Request,
  body: string,
  secret: string
): Promise<boolean> {
  try {
    const xSignature = req.headers.get("x-signature");
    const xRequestId = req.headers.get("x-request-id");
    
    if (!xSignature || !xRequestId) {
      console.log("Missing signature headers");
      return false;
    }

    // Parse x-signature header (format: ts=xxx,v1=xxx)
    const parts = xSignature.split(",");
    const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
    const hash = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!ts || !hash) {
      console.log("Invalid signature format");
      return false;
    }

    // Get data.id from body
    const bodyJson = JSON.parse(body);
    const dataId = bodyJson.data?.id?.toString() || "";

    // Build manifest string
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calculate HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
    const calculatedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = calculatedHash === hash;
    if (!isValid) {
      console.log("Signature mismatch:", { expected: hash, calculated: calculatedHash });
    }
    return isValid;
  } catch (error) {
    console.error("Error verifying Mercado Pago signature:", error);
    return false;
  }
}

// Verify PagBank webhook signature
async function verifyPagBankSignature(
  body: string,
  signature: string | null,
  token: string
): Promise<boolean> {
  try {
    if (!signature) {
      console.log("Missing PagBank signature header");
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(token),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = calculatedSignature === signature;
    if (!isValid) {
      console.log("PagBank signature mismatch");
    }
    return isValid;
  } catch (error) {
    console.error("Error verifying PagBank signature:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read body as text for signature verification
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    console.log("Boleto webhook received:", JSON.stringify(body));

    let externalPaymentId: string | null = null;
    let paymentStatus: string | null = null;
    let storeOwnerId: string | null = null;

    // Handle Mercado Pago webhook format
    if (body.type === "payment" && body.data?.id) {
      externalPaymentId = body.data.id.toString();
      
      if (body.action === "payment.updated") {
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

    // Find the payment to get store owner ID for signature verification
    if (externalPaymentId) {
      const { data: boletoPayment } = await supabase
        .from("boleto_payments")
        .select("store_owner_id")
        .eq("external_payment_id", externalPaymentId)
        .maybeSingle();

      if (boletoPayment) {
        storeOwnerId = boletoPayment.store_owner_id;
      }
    }

    // Verify webhook signature if we have a store owner
    if (storeOwnerId) {
      const { data: paymentSettings } = await supabase
        .from("payment_settings")
        .select("mercadopago_webhook_secret, pagbank_webhook_secret")
        .eq("user_id", storeOwnerId)
        .single();

      if (paymentSettings && paymentSettings.mercadopago_webhook_secret) {
        const signatureValid = await verifyMercadoPagoSignature(
          req,
          bodyText,
          paymentSettings.mercadopago_webhook_secret
        );
        
        if (!signatureValid) {
          console.error("Invalid Mercado Pago webhook signature");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // No webhook secret configured - log warning but allow for backwards compatibility
        console.warn("No webhook secret configured for Mercado Pago - signature verification skipped. Configure webhook secrets for better security.");
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
