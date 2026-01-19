import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  userId: string;
  planId: "pro" | "premium";
  billingCycle: "monthly" | "annual";
  paymentMethod: "credit_card" | "pix" | "boleto";
  cardToken?: string;
  paymentMethodId?: string;
  cardBrand?: string;
  cardLastFour?: string;
  installments?: number;
  recurringConsent: boolean;
  origin?: string;
}

interface MercadoPagoPreapproval {
  id: string;
  status: string;
  payer_id: string;
  collector_id: string;
  application_id: string;
  reason: string;
  external_reference: string;
  init_point: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
}

function getUserFriendlyMessage(statusDetail: string | null): string {
  switch (statusDetail) {
    case "cc_rejected_card_disabled":
      return "Cartão bloqueado ou desativado. Verifique os dados do cartão.";
    case "cc_rejected_insufficient_amount":
      return "Saldo insuficiente. Tente novamente ou use outro cartão.";
    case "cc_rejected_bad_filled_card_number":
      return "Número do cartão incorreto. Verifique os dados.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta. Verifique os dados.";
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança incorreto. Tente novamente.";
    case "cc_rejected_high_risk":
      return "Pagamento recusado por segurança. Contate seu banco.";
    case "cc_rejected_call_for_authorize":
      return "Autorização necessária. Contate seu banco.";
    case "expired_token":
      return "Sessão expirada. Tente novamente.";
    default:
      return "Pagamento recusado pelo emissor. Verifique os dados do cartão.";
  }
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
      console.log("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the JWT token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log("Invalid token:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = claimsData.claims.sub as string;
    console.log("Authenticated user:", authenticatedUserId);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: CreateSubscriptionRequest = await req.json();
    console.log("Create subscription request:", {
      ...requestData,
      cardToken: requestData.cardToken ? "***TOKEN***" : "NONE"
    });

    const {
      userId,
      planId,
      billingCycle,
      paymentMethod,
      cardToken,
      paymentMethodId,
      cardBrand,
      cardLastFour,
      installments,
      recurringConsent,
      origin
    } = requestData;

    // Validate user matches authenticated user
    if (userId !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: "Usuário não autorizado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!planId || !billingCycle || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos para criação da assinatura" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check recurring consent for monthly subscriptions
    if (billingCycle === "monthly" && !recurringConsent) {
      return new Response(
        JSON.stringify({ error: "Consentimento para cobrança recorrente é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For monthly, only credit card is allowed
    if (billingCycle === "monthly" && paymentMethod !== "credit_card") {
      return new Response(
        JSON.stringify({ error: "Plano mensal aceita apenas cartão de crédito" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("master_plans")
      .select("*")
      .eq("plan_id", planId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError || !plan) {
      console.error("Plan error:", planError);
      return new Response(
        JSON.stringify({ error: "Plano não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate prices
    const monthlyPrice = Number(plan.monthly_price);
    const annualDiscount = plan.annual_discount_percent || 30;
    const annualMonthlyPrice = monthlyPrice * (1 - annualDiscount / 100);
    const totalAmount = billingCycle === "monthly" 
      ? monthlyPrice 
      : annualMonthlyPrice * 12;

    console.log("Calculated prices:", { monthlyPrice, annualMonthlyPrice, totalAmount, billingCycle });

    // Check for existing active subscription
    const { data: existingSubscription } = await supabase
      .from("master_subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["active", "pending", "inadimplent"])
      .maybeSingle();

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ 
          error: "Você já possui uma assinatura ativa. Cancele-a primeiro para criar uma nova.",
          existingSubscriptionId: existingSubscription.id
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get master gateway credentials
    const { data: gateway, error: gatewayError } = await supabase
      .from("master_payment_gateways")
      .select("*")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (gatewayError || !gateway) {
      console.error("Gateway error:", gatewayError);
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!gateway.mercadopago_access_token) {
      return new Response(
        JSON.stringify({ error: "Credenciais do Mercado Pago não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for email
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("email, full_name, cpf_cnpj")
      .eq("id", userId)
      .maybeSingle();

    const userEmail = userProfile?.email || "customer@email.com";
    const userName = userProfile?.full_name || "Cliente";
    const userCpf = userProfile?.cpf_cnpj?.replace(/\D/g, "") || "";

    // Calculate period dates
    const now = new Date();
    const periodStart = now.toISOString();
    const periodEnd = billingCycle === "monthly"
      ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

    // Create subscription record
    const idempotencyKey = `sub-${userId}-${planId}-${billingCycle}-${Date.now()}`;
    
    const subscriptionData = {
      user_id: userId,
      plan_id: planId,
      billing_cycle: billingCycle,
      monthly_price: monthlyPrice,
      total_amount: totalAmount,
      discount_percent: billingCycle === "annual" ? annualDiscount : 0,
      status: "pending",
      gateway: "mercadopago",
      origin: origin || "checkout",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      recurring_consent_accepted: recurringConsent,
      recurring_consent_accepted_at: recurringConsent ? now.toISOString() : null,
      recurring_consent_ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      card_brand: cardBrand || null,
      card_last_four: cardLastFour || null,
    };

    const { data: subscription, error: subscriptionError } = await supabase
      .from("master_subscriptions")
      .insert(subscriptionData)
      .select()
      .single();

    if (subscriptionError) {
      console.error("Subscription insert error:", subscriptionError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar assinatura" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Subscription created:", subscription.id);

    // Log subscription creation
    await supabase.from("master_subscription_logs").insert({
      subscription_id: subscription.id,
      user_id: userId,
      event_type: "subscription_created",
      event_description: `Assinatura ${planId.toUpperCase()} ${billingCycle} criada`,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      metadata: { planId, billingCycle, paymentMethod, origin }
    });

    // Process payment based on method and cycle
    let paymentResult: any = null;

    if (billingCycle === "monthly" && paymentMethod === "credit_card") {
      // Create recurring subscription with Mercado Pago Preapproval
      if (!cardToken) {
        return new Response(
          JSON.stringify({ error: "Token do cartão é obrigatório para plano mensal" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create first payment to validate card
      const paymentPayload = {
        transaction_amount: monthlyPrice,
        token: cardToken,
        description: `Assinatura ${plan.display_name} - Virtual Mercado`,
        payment_method_id: paymentMethodId || "visa",
        installments: 1,
        payer: {
          email: userEmail,
          first_name: userName.split(' ')[0],
          last_name: userName.split(' ').slice(1).join(' ') || userName.split(' ')[0],
          identification: {
            type: "CPF",
            number: userCpf || "00000000000"
          }
        },
        statement_descriptor: "VIRTUALMERCADO",
        external_reference: subscription.id,
        capture: true,
      };

      console.log("Processing monthly card payment...");
      
      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(paymentPayload),
      });

      const mpData = await mpResponse.json();
      console.log("Mercado Pago payment response:", mpData.status, mpData.status_detail);

      if (!mpResponse.ok || mpData.status === "rejected") {
        const statusDetail = mpData.status_detail || "unknown_error";
        const isHardDecline = [
          "cc_rejected_card_disabled",
          "cc_rejected_bad_filled_card_number",
          "cc_rejected_bad_filled_date",
          "cc_rejected_bad_filled_security_code",
          "expired_token",
        ].includes(statusDetail);
        
        const userMessage = getUserFriendlyMessage(statusDetail);
        
        // For first-time subscription, cancel on rejection (no retry logic yet)
        await supabase
          .from("master_subscriptions")
          .update({ 
            status: "cancelled",
            decline_type: isHardDecline ? "hard" : "soft",
            last_decline_code: statusDetail,
            last_decline_message: userMessage,
          })
          .eq("id", subscription.id);

        await supabase.from("master_subscription_logs").insert({
          subscription_id: subscription.id,
          user_id: userId,
          event_type: "payment_failed",
          event_description: `Pagamento rejeitado: ${statusDetail}`,
          metadata: { 
            mpData, 
            declineType: isHardDecline ? "hard" : "soft",
            userMessage 
          }
        });

        return new Response(
          JSON.stringify({ 
            error: userMessage, 
            statusDetail: statusDetail,
            declineType: isHardDecline ? "hard" : "soft",
            details: mpData
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save payment record
      const { data: payment, error: paymentError } = await supabase
        .from("master_subscription_payments")
        .insert({
          subscription_id: subscription.id,
          user_id: userId,
          amount: monthlyPrice,
          payment_method: "credit_card",
          gateway: "mercadopago",
          status: mpData.status === "approved" ? "paid" : "pending",
          gateway_payment_id: mpData.id?.toString(),
          gateway_status: mpData.status,
          gateway_response: mpData,
          paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Payment insert error:", paymentError);
      }

      // Update subscription with card token for future charges
      if (mpData.status === "approved") {
        await supabase
          .from("master_subscriptions")
          .update({ 
            status: "active",
            started_at: new Date().toISOString(),
            gateway_customer_id: mpData.payer?.id?.toString(),
          })
          .eq("id", subscription.id);

        await supabase.from("master_subscription_logs").insert({
          subscription_id: subscription.id,
          user_id: userId,
          payment_id: payment?.id,
          event_type: "subscription_activated",
          event_description: "Assinatura ativada com sucesso",
          metadata: { paymentId: mpData.id }
        });
      }

      paymentResult = {
        success: mpData.status === "approved",
        status: mpData.status,
        statusDetail: mpData.status_detail,
        paymentId: mpData.id,
        subscriptionId: subscription.id,
      };

    } else if (billingCycle === "annual" && paymentMethod === "credit_card") {
      // Single annual payment with credit card
      if (!cardToken) {
        return new Response(
          JSON.stringify({ error: "Token do cartão é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentPayload = {
        transaction_amount: totalAmount,
        token: cardToken,
        description: `Assinatura Anual ${plan.display_name} - Virtual Mercado`,
        payment_method_id: paymentMethodId || "visa",
        installments: installments || 1,
        payer: {
          email: userEmail,
          first_name: userName.split(' ')[0],
          last_name: userName.split(' ').slice(1).join(' ') || userName.split(' ')[0],
          identification: {
            type: "CPF",
            number: userCpf || "00000000000"
          }
        },
        statement_descriptor: "VIRTUALMERCADO",
        external_reference: subscription.id,
        capture: true,
      };

      console.log("Processing annual card payment...");
      
      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(paymentPayload),
      });

      const mpData = await mpResponse.json();
      console.log("Mercado Pago payment response:", mpData.status);

      if (!mpResponse.ok || mpData.status === "rejected") {
        await supabase
          .from("master_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", subscription.id);

        await supabase.from("master_subscription_logs").insert({
          subscription_id: subscription.id,
          user_id: userId,
          event_type: "payment_failed",
          event_description: `Pagamento rejeitado: ${mpData.status_detail}`,
          metadata: { mpData }
        });

        return new Response(
          JSON.stringify({ 
            error: "Pagamento rejeitado", 
            statusDetail: mpData.status_detail 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save payment record
      const { data: payment } = await supabase
        .from("master_subscription_payments")
        .insert({
          subscription_id: subscription.id,
          user_id: userId,
          amount: totalAmount,
          payment_method: "credit_card",
          gateway: "mercadopago",
          status: mpData.status === "approved" ? "paid" : "pending",
          gateway_payment_id: mpData.id?.toString(),
          gateway_status: mpData.status,
          gateway_response: mpData,
          paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (mpData.status === "approved") {
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
          payment_id: payment?.id,
          event_type: "subscription_activated",
          event_description: "Assinatura anual ativada com sucesso",
          metadata: { paymentId: mpData.id }
        });
      }

      paymentResult = {
        success: mpData.status === "approved",
        status: mpData.status,
        statusDetail: mpData.status_detail,
        paymentId: mpData.id,
        subscriptionId: subscription.id,
      };

    } else if (billingCycle === "annual" && paymentMethod === "pix") {
      // Generate PIX for annual payment
      const pixExpiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      const pixPayload = {
        transaction_amount: totalAmount,
        description: `Assinatura Anual ${plan.display_name} - Virtual Mercado`,
        payment_method_id: "pix",
        payer: {
          email: userEmail,
          first_name: userName.split(' ')[0],
          last_name: userName.split(' ').slice(1).join(' ') || userName.split(' ')[0],
          identification: {
            type: "CPF",
            number: userCpf || "00000000000"
          }
        },
        date_of_expiration: pixExpiration.toISOString(),
        external_reference: subscription.id,
      };

      console.log("Generating PIX for annual payment...");

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(pixPayload),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("PIX generation error:", mpData);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar PIX", details: mpData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save payment record with PIX data
      const { data: payment } = await supabase
        .from("master_subscription_payments")
        .insert({
          subscription_id: subscription.id,
          user_id: userId,
          amount: totalAmount,
          payment_method: "pix",
          gateway: "mercadopago",
          status: "pending",
          gateway_payment_id: mpData.id?.toString(),
          gateway_status: mpData.status,
          gateway_response: mpData,
          pix_qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
          pix_qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
          pix_expires_at: pixExpiration.toISOString(),
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      await supabase.from("master_subscription_logs").insert({
        subscription_id: subscription.id,
        user_id: userId,
        payment_id: payment?.id,
        event_type: "pix_generated",
        event_description: "PIX gerado, aguardando pagamento",
        metadata: { paymentId: mpData.id, expiresAt: pixExpiration.toISOString() }
      });

      paymentResult = {
        success: true,
        status: "pending",
        paymentMethod: "pix",
        subscriptionId: subscription.id,
        paymentId: mpData.id,
        pixQrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
        pixQrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        pixExpiresAt: pixExpiration.toISOString(),
        amount: totalAmount,
      };

    } else if (billingCycle === "annual" && paymentMethod === "boleto") {
      // Generate Boleto for annual payment
      const boletoExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

      const boletoPayload = {
        transaction_amount: totalAmount,
        description: `Assinatura Anual ${plan.display_name} - Virtual Mercado`,
        payment_method_id: "bolbradesco",
        payer: {
          email: userEmail,
          first_name: userName.split(' ')[0],
          last_name: userName.split(' ').slice(1).join(' ') || userName.split(' ')[0],
          identification: {
            type: "CPF",
            number: userCpf || "00000000000"
          },
          address: {
            zip_code: "01310100",
            street_name: "Avenida Paulista",
            street_number: "1000",
            neighborhood: "Bela Vista",
            city: "São Paulo",
            federal_unit: "SP"
          }
        },
        date_of_expiration: boletoExpiration.toISOString(),
        external_reference: subscription.id,
      };

      console.log("Generating Boleto for annual payment...");

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gateway.mercadopago_access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(boletoPayload),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("Boleto generation error:", mpData);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar boleto", details: mpData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save payment record with Boleto data
      const { data: payment } = await supabase
        .from("master_subscription_payments")
        .insert({
          subscription_id: subscription.id,
          user_id: userId,
          amount: totalAmount,
          payment_method: "boleto",
          gateway: "mercadopago",
          status: "pending",
          gateway_payment_id: mpData.id?.toString(),
          gateway_status: mpData.status,
          gateway_response: mpData,
          boleto_url: mpData.transaction_details?.external_resource_url,
          boleto_barcode: mpData.barcode?.content,
          boleto_digitable_line: mpData.transaction_details?.digitable_line,
          boleto_expires_at: boletoExpiration.toISOString(),
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      await supabase.from("master_subscription_logs").insert({
        subscription_id: subscription.id,
        user_id: userId,
        payment_id: payment?.id,
        event_type: "boleto_generated",
        event_description: "Boleto gerado, aguardando pagamento",
        metadata: { paymentId: mpData.id, expiresAt: boletoExpiration.toISOString() }
      });

      paymentResult = {
        success: true,
        status: "pending",
        paymentMethod: "boleto",
        subscriptionId: subscription.id,
        paymentId: mpData.id,
        boletoUrl: mpData.transaction_details?.external_resource_url,
        boletoBarcode: mpData.barcode?.content,
        boletoDigitableLine: mpData.transaction_details?.digitable_line,
        boletoExpiresAt: boletoExpiration.toISOString(),
        amount: totalAmount,
      };
    }

    console.log("Subscription process completed:", paymentResult);

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: subscription.id,
          planId,
          billingCycle,
          status: subscription.status,
          totalAmount,
        },
        payment: paymentResult,
        message: paymentResult?.status === "approved" 
          ? "Assinatura ativada com sucesso!" 
          : paymentResult?.paymentMethod === "pix"
            ? "PIX gerado! Escaneie o QR Code para pagar."
            : paymentResult?.paymentMethod === "boleto"
              ? "Boleto gerado! Pague até a data de vencimento."
              : "Processando pagamento..."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Create subscription error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao criar assinatura" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
