import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PixRequest {
  orderId: string;
  amount: number;
  storeOwnerId: string;
  gateway: "mercadopago" | "pagbank";
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId, amount, storeOwnerId, gateway, description } = await req.json() as PixRequest;

    if (!orderId || !amount || !storeOwnerId || !gateway) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios não informados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch merchant payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("user_id", storeOwnerId)
      .single();

    if (settingsError || !paymentSettings) {
      console.error("Payment settings error:", settingsError);
      return new Response(
        JSON.stringify({ error: "Configurações de pagamento não encontradas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let pixData: any = null;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiration

    if (gateway === "mercadopago") {
      if (!paymentSettings.mercadopago_access_token || !paymentSettings.mercadopago_enabled) {
        return new Response(
          JSON.stringify({ error: "Mercado Pago não está configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create PIX payment with Mercado Pago
      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": orderId,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description: description || `Pedido ${orderId.substring(0, 8)}`,
          payment_method_id: "pix",
          payer: {
            email: "customer@email.com" // Required by MP but we use generic
          },
          date_of_expiration: expiresAt.toISOString(),
        }),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("Mercado Pago error:", mpData);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar PIX no Mercado Pago", details: mpData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      pixData = {
        externalPaymentId: mpData.id?.toString(),
        qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        expiresAt: expiresAt.toISOString(),
      };
    } else if (gateway === "pagbank") {
      if (!paymentSettings.pagbank_token || !paymentSettings.pagbank_enabled) {
        return new Response(
          JSON.stringify({ error: "PagBank não está configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create PIX payment with PagBank
      // Using PagBank API v4
      const pbResponse = await fetch("https://api.pagseguro.com/orders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paymentSettings.pagbank_token}`,
          "Content-Type": "application/json",
          "x-idempotency-key": orderId,
        },
        body: JSON.stringify({
          reference_id: orderId,
          customer: {
            name: "Cliente",
            email: paymentSettings.pagbank_email || "cliente@email.com",
            tax_id: "00000000000",
          },
          items: [
            {
              name: description || `Pedido ${orderId.substring(0, 8)}`,
              quantity: 1,
              unit_amount: Math.round(amount * 100), // PagBank uses cents
            },
          ],
          qr_codes: [
            {
              amount: {
                value: Math.round(amount * 100),
              },
              expiration_date: expiresAt.toISOString(),
            },
          ],
        }),
      });

      const pbData = await pbResponse.json();

      if (!pbResponse.ok) {
        console.error("PagBank error:", pbData);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar PIX no PagBank", details: pbData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const qrCode = pbData.qr_codes?.[0];
      pixData = {
        externalPaymentId: pbData.id,
        qrCode: qrCode?.text,
        qrCodeBase64: qrCode?.links?.find((l: any) => l.rel === "QRCODE.PNG")?.href,
        expiresAt: expiresAt.toISOString(),
      };
    }

    if (!pixData || !pixData.qrCode) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar QR Code PIX" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save PIX payment record
    const { data: pixPayment, error: pixError } = await supabase
      .from("pix_payments")
      .insert({
        order_id: orderId,
        store_owner_id: storeOwnerId,
        gateway,
        external_payment_id: pixData.externalPaymentId,
        amount,
        status: "pending",
        qr_code: pixData.qrCode,
        qr_code_base64: pixData.qrCodeBase64,
        expires_at: pixData.expiresAt,
      })
      .select()
      .single();

    if (pixError) {
      console.error("PIX payment insert error:", pixError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar pagamento PIX" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order with PIX info
    await supabase
      .from("orders")
      .update({
        pix_payment_id: pixPayment.id,
        pix_payment_status: "pending",
        pix_qr_code: pixData.qrCode,
        pix_qr_code_base64: pixData.qrCodeBase64,
        pix_expires_at: pixData.expiresAt,
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        pixPaymentId: pixPayment.id,
        qrCode: pixData.qrCode,
        qrCodeBase64: pixData.qrCodeBase64,
        expiresAt: pixData.expiresAt,
        amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate PIX error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar pagamento PIX" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
