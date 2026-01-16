import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateCardRequest {
  cardToken: string;
  paymentMethodId: string;
  holderName: string;
  expirationMonth: string;
  expirationYear: string;
  lastFourDigits: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authentication
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
    console.log("Validating card for user:", userId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: ValidateCardRequest = await req.json();
    const { cardToken, paymentMethodId, holderName, expirationMonth, expirationYear, lastFourDigits } = requestData;

    if (!cardToken || !paymentMethodId) {
      return new Response(
        JSON.stringify({ error: "Token do cartão é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabase
      .from("master_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "pending", "payment_failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (subError && subError.code !== "PGRST116") {
      console.error("Subscription fetch error:", subError);
    }

    // Get gateway credentials
    const { data: gateway, error: gatewayError } = await supabase
      .from("master_payment_gateways")
      .select("*")
      .eq("is_active", true)
      .eq("is_default", true)
      .single();

    if (gatewayError || !gateway?.mercadopago_access_token) {
      console.error("Gateway error:", gatewayError);
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a R$1 validation payment (will be refunded)
    const validationPayload = {
      transaction_amount: 1.00,
      token: cardToken,
      description: "Validação de cartão - Virtual Mercado",
      payment_method_id: paymentMethodId,
      installments: 1,
      capture: false, // Don't capture, just authorize
      payer: {
        email: claimsData.claims.email || "usuario@virtualmercado.com.br",
      },
      statement_descriptor: "VIRTUALMERCADO",
    };

    console.log("Sending validation to Mercado Pago...");

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `validate-${userId}-${Date.now()}`,
      },
      body: JSON.stringify(validationPayload),
    });

    const mpData = await mpResponse.json();
    console.log("Mercado Pago validation response:", mpData.status, mpData.status_detail);

    // Cancel the authorization if it was approved
    if (mpData.status === "authorized" || mpData.status === "approved") {
      try {
        await fetch(`https://api.mercadopago.com/v1/payments/${mpData.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        });
        console.log("Validation payment cancelled successfully");
      } catch (cancelError) {
        console.error("Error cancelling validation payment:", cancelError);
      }
    }

    // Check validation result
    if (mpData.status === "rejected") {
      let errorMessage = "Cartão recusado pelo emissor";
      
      switch (mpData.status_detail) {
        case "cc_rejected_insufficient_amount":
          errorMessage = "Saldo insuficiente no cartão";
          break;
        case "cc_rejected_bad_filled_card_number":
          errorMessage = "Número do cartão inválido";
          break;
        case "cc_rejected_bad_filled_date":
          errorMessage = "Data de validade inválida";
          break;
        case "cc_rejected_bad_filled_security_code":
          errorMessage = "Código de segurança inválido";
          break;
        case "cc_rejected_card_disabled":
          errorMessage = "Cartão desabilitado";
          break;
        case "cc_rejected_high_risk":
          errorMessage = "Pagamento recusado por segurança";
          break;
        default:
          errorMessage = "O banco emissor não autorizou. Tente outro cartão.";
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          status: "rejected",
          error: errorMessage 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mpData.status !== "authorized" && mpData.status !== "approved") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: "error",
          error: "Não foi possível validar o cartão. Verifique os dados." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Card is valid - update subscription if exists
    if (subscription) {
      const { error: updateError } = await supabase
        .from("master_subscriptions")
        .update({
          card_token: cardToken,
          card_last_four: lastFourDigits,
          card_brand: paymentMethodId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (updateError) {
        console.error("Error updating subscription:", updateError);
      } else {
        // Log the card update
        await supabase.from("master_subscription_logs").insert({
          subscription_id: subscription.id,
          user_id: userId,
          event_type: "card_updated",
          event_data: {
            card_brand: paymentMethodId,
            card_last_four: lastFourDigits,
            holder_name: holderName,
          },
        });
      }
    }

    // Store card info in profiles or a dedicated table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        payment_card_last_four: lastFourDigits,
        payment_card_brand: paymentMethodId,
        payment_card_holder: holderName,
        payment_card_expiry: `${expirationMonth}/${expirationYear}`,
        payment_card_validated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.log("Profile update skipped (columns may not exist):", profileError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "success",
        message: "Cartão validado com sucesso",
        cardInfo: {
          lastFourDigits,
          brand: paymentMethodId,
          holderName,
          expiry: `${expirationMonth}/${expirationYear}`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error validating card:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        status: "error",
        error: error.message || "Erro ao validar cartão" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
