import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreditCardRequest {
  orderId?: string; // Order created BEFORE the charge; payment only confirms it
  amount?: number; // ignored: amount is taken from the persisted order
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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  // Handle CORS
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
      console.log("Missing or invalid authorization header");
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    // Verify the JWT token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.log("Invalid authentication token");
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    console.log("Authenticated user:", claimsData.claims.sub);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: CreditCardRequest = await req.json();
    console.log("Processing credit card payment");

    const {
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
    const orderId = requestData.orderId;

    // The charge is always tied to a persisted order; the amount comes from the
    // database, never from the request body.
    if (!orderId || typeof orderId !== "string") {
      return jsonResponse({ error: "Pedido obrigatório para pagamento com cartão" }, 400);
    }
    let amount = 0;
    {
      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .select("store_owner_id, payment_status, card_payment_id, total_amount")
        .eq("id", orderId)
        .maybeSingle();
      if (orderErr || !orderRow || orderRow.store_owner_id !== storeOwnerId) {
        return jsonResponse({ error: "Pedido não pertence à loja informada" }, 403);
      }

      // Idempotent short-circuit: this order already has an approved card payment.
      // A retry of the same logical purchase must NOT charge again.
      if (orderRow.payment_status === "approved" && orderRow.card_payment_id) {
        console.log("Order already has an approved payment; returning existing result");
        return jsonResponse({
          success: true,
          status: "approved",
          paymentId: orderRow.card_payment_id,
          orderId,
          orderConfirmed: true,
          duplicate: true,
          message: "Pagamento aprovado com sucesso!",
        });
      }
      amount = Math.round(Number(orderRow.total_amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResponse({ error: "Valor do pedido inválido" }, 400);
        }
    }

    // Validate required fields
    if (!amount || !storeOwnerId || !customerName || !customerEmail || !cardToken) {
      return jsonResponse({ error: "Dados incompletos para processamento do cartão" }, 400);
    }

    // Validate card token
    if (!cardToken || !paymentMethodId) {
      return jsonResponse({ error: "Token do cartão ou método de pagamento não fornecido" }, 400);
    }

    // Get store's Mercado Pago credentials
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("payment_settings")
      .select("mercadopago_access_token, mercadopago_public_key, credit_card_enabled, credit_card_provider, mercadopago_enabled, mercadopago_accepts_credit")
      .eq("user_id", storeOwnerId)
      .single();

    if (settingsError || !paymentSettings) {
      console.error("Error fetching payment settings");
      return jsonResponse({ error: "Configurações de pagamento não encontradas" }, 400);
    }

    // Check if credit card is enabled
    const isCreditCardEnabled = paymentSettings.credit_card_enabled ||
      (paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_accepts_credit);

    if (!isCreditCardEnabled) {
      return jsonResponse({ error: "Pagamento por cartão de crédito não está habilitado" }, 400);
    }

    if (!paymentSettings.mercadopago_access_token) {
      console.error("Mercado Pago access token not configured");
      return jsonResponse({ error: "Token de acesso do Mercado Pago não configurado" }, 400);
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

    // Link the charge to the internal order for reconciliation
    if (orderId) {
      paymentData.external_reference = orderId;
    }

    // Add issuer_id if provided
    if (issuerId) {
      paymentData.issuer_id = issuerId;
    }

    // Stable idempotency key: the same logical order always reuses the same key,
    // so retries/double-clicks never create a second charge at Mercado Pago.
    const idempotencyKey = orderId
      ? `order-${orderId}`
      : `${storeOwnerId}-${crypto.randomUUID()}`;

    console.log("Sending payment to Mercado Pago");

    // Call Mercado Pago API
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentData),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("Mercado Pago API error");

      return jsonResponse({
        error: "Erro ao processar pagamento. Tente novamente.",
        status: "error",
        ...(orderId ? { orderId } : {}),
      }, 400);
    }

    // Process the response based on payment status
    const paymentStatus = mpData.status;
    const paymentStatusDetail = mpData.status_detail;
    const mpPaymentId = mpData.id?.toString() || null;

    // Handle different payment statuses
    if (paymentStatus === "rejected") {
      // Mark the order's payment as rejected exactly once; the stock-restore
      // trigger is idempotent and returns the reserved items a single time.
      if (orderId) {
        const { error: rejectErr } = await supabase
          .from("orders")
          .update({ payment_status: "rejected", card_payment_id: mpPaymentId })
          .eq("id", orderId)
          .neq("payment_status", "approved");
        if (rejectErr) {
          console.error("Failed to mark order payment as rejected");
        }
      }

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

      return jsonResponse({
        success: false,
        status: "rejected",
        statusDetail: paymentStatusDetail,
        error: rejectionMessage,
        paymentId: mpPaymentId,
        ...(orderId ? { orderId } : {}),
      });
    }

    // Payment approved or pending
    const result = {
      success: paymentStatus === "approved",
      status: paymentStatus,
      statusDetail: paymentStatusDetail,
      paymentId: mpPaymentId,
      authorizationCode: mpData.authorization_code,
      lastFourDigits: mpData.card?.last_four_digits,
      cardBrand: mpData.payment_method_id,
      installments: mpData.installments,
      transactionAmount: mpData.transaction_amount,
      netReceivedAmount: mpData.net_received_amount,
      dateApproved: mpData.date_approved,
      externalReference: mpData.external_reference,
      ...(orderId ? { orderId } : {}),
    };

    if (paymentStatus === "pending") {
      // Keep the order pending and link the payment id for later reconciliation.
      if (orderId && mpPaymentId) {
        const { error: pendErr } = await supabase
          .from("orders")
          .update({ card_payment_id: mpPaymentId })
          .eq("id", orderId)
          .eq("payment_status", "pending");
        if (pendErr) {
          console.error("Failed to link pending payment to order");
        }
      }

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

      return jsonResponse({
        ...result,
        orderConfirmed: false,
        message: pendingMessage,
      });
    }

    // Payment approved: confirm the SAME pre-created order exactly once.
    console.log("Payment approved");

    let orderConfirmed = false;
    if (orderId) {
      const { error: confirmErr } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          payment_status: "approved",
          card_payment_id: mpPaymentId,
        })
        .eq("id", orderId)
        .neq("payment_status", "approved");
      if (confirmErr) {
        // The charge IS approved at the gateway. Never report a generic failure:
        // the pending order keeps the payment reference for reconciliation.
        console.error("Failed to confirm order after approved payment");
        orderConfirmed = false;
      } else {
        orderConfirmed = true;
      }
    }

    return jsonResponse({
      ...result,
      orderConfirmed,
      message: orderConfirmed || !orderId
        ? "Pagamento aprovado com sucesso!"
        : "Pagamento aprovado. Estamos confirmando seu pedido.",
    });

  } catch {
    console.error("Error processing credit card payment");
    return jsonResponse({
      error: "Erro interno ao processar pagamento",
      status: "error"
    }, 500);
  }
});
