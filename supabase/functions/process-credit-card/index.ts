import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreditCardRequest {
  orderId?: string; // Optional - order may be created after payment confirmation
  amount: number;
  storeOwnerId: string;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  customerPhone: string;
  customerAddress: {
    zipCode: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  cardToken: string; // Card token from MercadoPago.js SDK
  paymentMethodId: string; // e.g., "visa", "master", "amex"
  issuerId?: string; // Card issuer ID
  installments: number;
  description: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: CreditCardRequest = await req.json();
    console.log("Processing credit card payment:", {
      ...requestData,
      cardToken: requestData.cardToken ? "***TOKEN***" : "MISSING"
    });

    const {
      amount,
      storeOwnerId,
      customerName,
      customerEmail,
      customerCpf,
      customerPhone,
      customerAddress,
      cardToken,
      paymentMethodId,
      issuerId,
      installments,
      description,
    } = requestData;

    // Validate required fields
    if (!amount || !storeOwnerId || !customerName || !customerEmail || !cardToken) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos para processamento do cartão" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate card token
    if (!cardToken || !paymentMethodId) {
      return new Response(
        JSON.stringify({ error: "Token do cartão ou método de pagamento não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get store's Mercado Pago credentials
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("payment_settings")
      .select("mercadopago_access_token, mercadopago_public_key, credit_card_enabled, credit_card_provider, mercadopago_enabled, mercadopago_accepts_credit")
      .eq("user_id", storeOwnerId)
      .single();

    if (settingsError || !paymentSettings) {
      console.error("Error fetching payment settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Configurações de pagamento não encontradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if credit card is enabled
    const isCreditCardEnabled = paymentSettings.credit_card_enabled || 
      (paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_accepts_credit);

    if (!isCreditCardEnabled) {
      return new Response(
        JSON.stringify({ error: "Pagamento por cartão de crédito não está habilitado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!paymentSettings.mercadopago_access_token) {
      console.error("Mercado Pago access token not configured");
      return new Response(
        JSON.stringify({ error: "Token de acesso do Mercado Pago não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare payment data for Mercado Pago using token
    const paymentData: Record<string, any> = {
      transaction_amount: amount,
      token: cardToken, // Use the card token from frontend SDK
      description: description || "Pagamento de pedido",
      payment_method_id: paymentMethodId,
      installments: installments || 1,
      payer: {
        email: customerEmail,
        first_name: customerName.split(' ')[0],
        last_name: customerName.split(' ').slice(1).join(' ') || customerName.split(' ')[0],
        identification: {
          type: "CPF",
          number: customerCpf?.replace(/\D/g, '') || "00000000000",
        },
        phone: {
          area_code: customerPhone?.replace(/\D/g, '').substring(0, 2) || "11",
          number: customerPhone?.replace(/\D/g, '').substring(2) || "999999999",
        },
        address: {
          zip_code: customerAddress?.zipCode?.replace(/\D/g, '') || "01310100",
          street_name: customerAddress?.street || "Não informado",
          street_number: customerAddress?.number || "S/N",
          neighborhood: customerAddress?.neighborhood || "Centro",
          city: customerAddress?.city || "São Paulo",
          federal_unit: customerAddress?.state || "SP",
        },
      },
      statement_descriptor: "LOJA VIRTUAL",
      capture: true, // Capture immediately
    };

    // Add issuer_id if provided
    if (issuerId) {
      paymentData.issuer_id = issuerId;
    }

    console.log("Sending payment to Mercado Pago:", {
      ...paymentData,
      token: "***TOKEN***"
    });

    // Call Mercado Pago API
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${storeOwnerId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentData),
    });

    const mpData = await mpResponse.json();
    console.log("Mercado Pago response:", JSON.stringify(mpData));

    if (!mpResponse.ok) {
      console.error("Mercado Pago API error:", mpData);
      
      let errorMessage = "Erro ao processar pagamento";
      
      if (mpData.cause) {
        const causes = Array.isArray(mpData.cause) ? mpData.cause : [mpData.cause];
        const errorCodes = causes.map((c: any) => c.code || c.description).join(', ');
        errorMessage = `Erro no gateway: ${errorCodes}`;
      } else if (mpData.message) {
        errorMessage = mpData.message;
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage, 
          details: mpData,
          status: "error"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the response based on payment status
    const paymentStatus = mpData.status;
    const paymentStatusDetail = mpData.status_detail;

    console.log("Payment status:", paymentStatus, "Detail:", paymentStatusDetail);

    // Handle different payment statuses
    if (paymentStatus === "rejected") {
      let rejectionMessage = "Pagamento recusado. ";
      
      switch (paymentStatusDetail) {
        case "cc_rejected_insufficient_amount":
          rejectionMessage += "Saldo insuficiente no cartão.";
          break;
        case "cc_rejected_bad_filled_card_number":
          rejectionMessage += "Número do cartão inválido.";
          break;
        case "cc_rejected_bad_filled_date":
          rejectionMessage += "Data de validade inválida.";
          break;
        case "cc_rejected_bad_filled_security_code":
          rejectionMessage += "Código de segurança inválido.";
          break;
        case "cc_rejected_bad_filled_other":
          rejectionMessage += "Verifique os dados do cartão.";
          break;
        case "cc_rejected_call_for_authorize":
          rejectionMessage += "Necessário autorizar o pagamento junto ao banco emissor.";
          break;
        case "cc_rejected_card_disabled":
          rejectionMessage += "Cartão desabilitado. Entre em contato com o banco.";
          break;
        case "cc_rejected_duplicated_payment":
          rejectionMessage += "Pagamento duplicado detectado.";
          break;
        case "cc_rejected_high_risk":
          rejectionMessage += "Pagamento recusado por segurança.";
          break;
        case "cc_rejected_max_attempts":
          rejectionMessage += "Número máximo de tentativas excedido.";
          break;
        case "cc_rejected_other_reason":
        default:
          rejectionMessage += "Tente outro cartão ou entre em contato com o banco.";
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          status: "rejected",
          statusDetail: paymentStatusDetail,
          error: rejectionMessage,
          paymentId: mpData.id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payment approved or pending
    const result = {
      success: paymentStatus === "approved",
      status: paymentStatus,
      statusDetail: paymentStatusDetail,
      paymentId: mpData.id?.toString(),
      authorizationCode: mpData.authorization_code,
      lastFourDigits: mpData.card?.last_four_digits,
      cardBrand: mpData.payment_method_id,
      installments: mpData.installments,
      transactionAmount: mpData.transaction_amount,
      netReceivedAmount: mpData.net_received_amount,
      dateApproved: mpData.date_approved,
      externalReference: mpData.external_reference,
    };

    if (paymentStatus === "pending") {
      // Payment is pending - may require 3DS authentication or other verification
      let pendingMessage = "Pagamento pendente de confirmação. ";
      
      switch (paymentStatusDetail) {
        case "pending_contingency":
          pendingMessage += "Aguardando processamento do banco.";
          break;
        case "pending_review_manual":
          pendingMessage += "Em análise manual.";
          break;
        case "pending_waiting_payment":
          pendingMessage += "Aguardando confirmação do pagamento.";
          break;
        case "pending_challenge":
          pendingMessage += "Autenticação adicional necessária.";
          break;
        default:
          pendingMessage += "Aguarde a confirmação.";
      }
      
      return new Response(
        JSON.stringify({ 
          ...result,
          message: pendingMessage
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payment approved
    console.log("Payment approved:", result);
    
    return new Response(
      JSON.stringify({
        ...result,
        message: "Pagamento aprovado com sucesso!"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error processing credit card payment:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro interno ao processar pagamento",
        status: "error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});