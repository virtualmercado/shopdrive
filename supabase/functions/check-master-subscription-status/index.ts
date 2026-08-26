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

    // Gateway credentials (used for both flows below)
    const { data: gateway } = await supabase
      .from("master_payment_gateways")
      .select("mercadopago_access_token")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    const mpToken = gateway?.mercadopago_access_token;

    const activateSubscription = async (paymentRowId: string | null, mpPayment: any) => {
      await supabase
        .from("master_subscriptions")
        .update({
          status: "active",
          started_at: subscription.started_at || new Date().toISOString(),
          decline_type: null,
          last_decline_code: null,
          last_decline_message: null,
          requires_card_update: false,
          retry_count: 0,
          next_retry_at: null,
          grace_period_ends_at: null,
        })
        .eq("id", subscription.id);

      await supabase.from("master_subscription_logs").insert({
        subscription_id: subscription.id,
        user_id: userId,
        payment_id: paymentRowId,
        event_type: "subscription_activated",
        event_description: "Assinatura ativada via verificação de status",
        metadata: { mpPaymentId: mpPayment?.id, mpStatus: mpPayment?.status },
      });

      const planLimitsMap: Record<string, number | null> = {
        gratis: 20, free: 20, pro: 150, premium: null,
      };
      const planId = subscription.plan_id;
      if (planId && planId !== "gratis" && planId !== "free") {
        const max = planId in planLimitsMap ? planLimitsMap[planId] : 20;
        const { error: rpcErr } = await supabase.rpc(
          "reactivate_products_after_upgrade",
          { p_user_id: userId, p_max_products: max }
        );
        if (rpcErr) console.error("reactivate rpc error:", rpcErr);
      }

      subscription.status = "active";
    };

    // If there's a pending payment with a gateway id, check its status with the gateway
    const pendingPayment = subscription.master_subscription_payments?.find(
      (p: any) => ["pending", "in_process", "processing"].includes(p.status) && p.gateway_payment_id
    );

    if (pendingPayment && mpToken) {
      try {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${pendingPayment.gateway_payment_id}`,
          { headers: { "Authorization": `Bearer ${mpToken}` } }
        );

        if (mpResponse.ok) {
          const mpPayment = await mpResponse.json();
          console.log("MP payment status:", mpPayment.status);

          if (mpPayment.status === "approved" && pendingPayment.status !== "paid") {
            await supabase
              .from("master_subscription_payments")
              .update({
                status: "paid",
                gateway_status: mpPayment.status,
                paid_at: mpPayment.date_approved || new Date().toISOString(),
              })
              .eq("id", pendingPayment.id);

            await activateSubscription(pendingPayment.id, mpPayment);
            pendingPayment.status = "paid";
          } else if (mpPayment.status === "rejected") {
            await supabase
              .from("master_subscription_payments")
              .update({ status: "failed", gateway_status: mpPayment.status, decline_code: mpPayment.status_detail })
              .eq("id", pendingPayment.id);

            pendingPayment.status = "failed";
            pendingPayment.gateway_status = mpPayment.status;
            pendingPayment.decline_code = mpPayment.status_detail;
          } else {
            await supabase
              .from("master_subscription_payments")
              .update({ gateway_status: mpPayment.status })
              .eq("id", pendingPayment.id);
            pendingPayment.gateway_status = mpPayment.status;
          }
        }
      } catch (error) {
        console.error("Error checking MP payment:", error);
      }
    }

    // Assinatura recorrente (preapproval): o primeiro pagamento é criado pelo gateway de forma assíncrona
    const openCardPayment = subscription.master_subscription_payments?.find(
      (p: any) => ["pending", "in_process", "processing"].includes(p.status) && !p.gateway_payment_id
    );

    if (subscription.gateway_subscription_id && mpToken && openCardPayment && subscription.status !== "active") {
      try {
        const { data: openInvoice } = await supabase
          .from("invoices")
          .select("id, invoice_id")
          .eq("subscription_id", subscription.id)
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const externalRef = openInvoice?.invoice_id;
        if (externalRef) {
          const searchResp = await fetch(
            `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}&sort=date_created&criteria=desc`,
            { headers: { "Authorization": `Bearer ${mpToken}` } }
          );

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const mpPayment = searchData?.results?.[0];
            console.log("Preapproval payment search:", mpPayment?.id, mpPayment?.status);

            if (mpPayment?.id) {
              const isApproved = mpPayment.status === "approved";
              const isRejected = mpPayment.status === "rejected";

              await supabase
                .from("master_subscription_payments")
                .update({
                  gateway_payment_id: mpPayment.id.toString(),
                  gateway_status: mpPayment.status,
                  status: isApproved ? "paid" : isRejected ? "failed" : "pending",
                  decline_code: mpPayment.status_detail || null,
                  paid_at: isApproved ? (mpPayment.date_approved || new Date().toISOString()) : null,
                })
                .eq("id", openCardPayment.id);

              if (openInvoice?.id) {
                await supabase
                  .from("invoices")
                  .update({
                    mp_payment_id: mpPayment.id.toString(),
                    status: isApproved ? "paid" : isRejected ? "rejected" : "pending",
                    paid_at: isApproved ? (mpPayment.date_approved || new Date().toISOString()) : null,
                  })
                  .eq("id", openInvoice.id);
              }

              openCardPayment.status = isApproved ? "paid" : isRejected ? "failed" : "pending";
              openCardPayment.gateway_status = mpPayment.status;
              openCardPayment.decline_code = mpPayment.status_detail || null;

              if (isApproved) {
                await activateSubscription(openCardPayment.id, mpPayment);
              } else if (isRejected) {
                await supabase
                  .from("master_subscriptions")
                  .update({
                    status: "past_due",
                    last_decline_code: mpPayment.status_detail || null,
                    last_decline_message: "Pagamento recusado pelo emissor. Atualize seu cartão para continuar.",
                    decline_type: "hard",
                    requires_card_update: true,
                  })
                  .eq("id", subscription.id);
                subscription.status = "past_due";
              }
            }
          }
        }
      } catch (error) {
        console.error("Error reconciling preapproval payment:", error);
      }
    }

    // Get latest payment
    const latestPayment = subscription.master_subscription_payments?.[0];

    // Estado normalizado para a UI (nunca deixa o cliente preso em "processando")
    const referencePayment = openCardPayment || pendingPayment || latestPayment;
    let normalizedStatus = "pending";
    if (subscription.status === "active") normalizedStatus = "approved";
    else if (subscription.status === "cancelled" || subscription.status === "expired") normalizedStatus = "expired";
    else if (referencePayment?.status === "failed") normalizedStatus = "rejected";
    else if (referencePayment?.status === "paid") normalizedStatus = "approved";
    else if (
      referencePayment?.payment_method === "credit_card" ||
      ["in_process", "in_review"].includes(referencePayment?.gateway_status)
    ) normalizedStatus = "in_review";


    return new Response(
      JSON.stringify({
        found: true,
        normalizedStatus,
        declineCode: referencePayment?.decline_code || subscription.last_decline_code || null,
        declineMessage: subscription.last_decline_message || null,
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
