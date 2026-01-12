import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoletoRequest {
  orderId: string;
  amount: number;
  storeOwnerId: string;
  customerName: string;
  customerEmail: string;
  customerCpf?: string;
  customerAddress?: {
    zipCode: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  customerPhone?: string;
  description?: string;
}

// Helper function to calculate next business day
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  
  return result;
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

    console.log("Authenticated user:", claimsData.claims.sub);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      orderId, 
      amount, 
      storeOwnerId, 
      customerName, 
      customerEmail,
      customerCpf,
      customerPhone,
      customerAddress,
      description 
    } = await req.json() as BoletoRequest;

    console.log("Boleto request received:", { orderId, amount, storeOwnerId, customerName, customerEmail });

    // Validate required fields
    if (!orderId || !storeOwnerId) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios não informados (orderId, storeOwnerId)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customerName || !customerEmail) {
      return new Response(
        JSON.stringify({ error: "Nome e e-mail do cliente são obrigatórios para gerar boleto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and format the amount
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const validAmount = Math.round((parsedAmount || 0) * 100) / 100;
    
    console.log("Amount validation:", { original: amount, parsed: parsedAmount, valid: validAmount });

    if (!validAmount || validAmount <= 0 || isNaN(validAmount)) {
      return new Response(
        JSON.stringify({ error: "Valor do pagamento inválido. O valor deve ser maior que zero." }),
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

    // Check if Mercado Pago is enabled and has access token
    if (!paymentSettings.mercadopago_access_token || !paymentSettings.mercadopago_enabled) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago não está configurado para este lojista" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if boleto is enabled
    if (!paymentSettings.boleto_enabled) {
      return new Response(
        JSON.stringify({ error: "Boleto não está habilitado nas configurações de pagamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate expiration date (2 business days from now)
    const expiresAt = addBusinessDays(new Date(), 2);
    expiresAt.setHours(23, 59, 59, 999);

    // Generate identification number (use CPF if available, or generate a placeholder)
    // For Mercado Pago, CPF is required for boleto
    const identificationType = "CPF";
    const identificationNumber = customerCpf?.replace(/\D/g, "") || "00000000000";

    // Create boleto payment with Mercado Pago
    const idempotencyKey = `boleto-${orderId}-${Date.now()}-${crypto.randomUUID()}`;
    
    // Build payer address object (required for boleto)
    const payerAddress = customerAddress ? {
      zip_code: customerAddress.zipCode?.replace(/\D/g, "") || "00000000",
      street_name: customerAddress.street || "Rua não informada",
      street_number: customerAddress.number || "S/N",
      neighborhood: customerAddress.neighborhood || "Bairro não informado",
      city: customerAddress.city || "Cidade não informada",
      federal_unit: customerAddress.state?.toUpperCase() || "SP",
    } : {
      zip_code: "00000000",
      street_name: "Endereço não informado",
      street_number: "S/N",
      neighborhood: "Bairro não informado",
      city: "Cidade não informada",
      federal_unit: "SP",
    };

    const mpPayload = {
      transaction_amount: validAmount,
      description: description || `Pedido ${orderId.substring(0, 8)}`,
      payment_method_id: "bolbradesco", // Boleto Bradesco (most common)
      payer: {
        email: customerEmail,
        first_name: customerName.split(" ")[0],
        last_name: customerName.split(" ").slice(1).join(" ") || customerName.split(" ")[0],
        identification: {
          type: identificationType,
          number: identificationNumber,
        },
        address: payerAddress,
      },
      date_of_expiration: expiresAt.toISOString(),
    };
    
    console.log("Mercado Pago boleto payload:", JSON.stringify(mpPayload));
    
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      
      // Handle specific error messages
      let errorMessage = "Erro ao gerar boleto no Mercado Pago";
      if (mpData.message) {
        errorMessage = mpData.message;
      }
      if (mpData.cause && mpData.cause.length > 0) {
        const causes = mpData.cause.map((c: any) => c.description || c.code).join(", ");
        errorMessage += `: ${causes}`;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: mpData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Mercado Pago boleto response:", JSON.stringify(mpData));

    // Check if payment was rejected
    if (mpData.status === "rejected") {
      console.error("Boleto was rejected by Mercado Pago:", mpData.status_detail);
      
      let errorMessage = "Boleto rejeitado pelo banco. ";
      
      switch (mpData.status_detail) {
        case "rejected_by_bank":
          errorMessage += "Verifique se sua conta Mercado Pago está habilitada para emitir boletos ou se há pendências cadastrais.";
          break;
        case "cc_rejected_insufficient_amount":
          errorMessage += "Valor insuficiente.";
          break;
        case "cc_rejected_high_risk":
          errorMessage += "Pagamento recusado por segurança.";
          break;
        default:
          errorMessage += `Motivo: ${mpData.status_detail || "não especificado"}`;
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage, 
          status: mpData.status,
          statusDetail: mpData.status_detail,
          details: mpData 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract boleto data from response
    const boletoData = {
      externalPaymentId: mpData.id?.toString(),
      barcode: mpData.barcode?.content || mpData.transaction_details?.barcode?.content,
      digitableLine: mpData.transaction_details?.digitable_line || mpData.barcode?.content,
      boletoUrl: mpData.transaction_details?.external_resource_url,
      expiresAt: expiresAt.toISOString(),
    };

    console.log("Extracted boleto data:", boletoData);

    if (!boletoData.boletoUrl) {
      console.error("No boleto URL in response:", mpData);
      return new Response(
        JSON.stringify({ 
          error: "Falha ao gerar boleto - URL não retornada pelo gateway. Verifique as configurações da conta Mercado Pago.",
          paymentStatus: mpData.status,
          details: mpData
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save boleto payment record
    const { data: boletoPayment, error: boletoError } = await supabase
      .from("boleto_payments")
      .insert({
        order_id: orderId,
        store_owner_id: storeOwnerId,
        gateway: "mercadopago",
        external_payment_id: boletoData.externalPaymentId,
        amount: validAmount,
        status: "pending",
        barcode: boletoData.barcode,
        digitable_line: boletoData.digitableLine,
        boleto_url: boletoData.boletoUrl,
        expires_at: boletoData.expiresAt,
      })
      .select()
      .single();

    if (boletoError) {
      console.error("Boleto payment insert error:", boletoError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar pagamento do boleto" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order with boleto info
    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        boleto_payment_id: boletoPayment.id,
        boleto_payment_status: "pending",
        boleto_barcode: boletoData.barcode,
        boleto_digitable_line: boletoData.digitableLine,
        boleto_url: boletoData.boletoUrl,
        boleto_expires_at: boletoData.expiresAt,
      })
      .eq("id", orderId);

    if (updateOrderError) {
      console.error("Order update error:", updateOrderError);
    }

    console.log("Boleto generated successfully:", {
      boletoPaymentId: boletoPayment.id,
      orderId,
      amount: validAmount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        boletoPaymentId: boletoPayment.id,
        barcode: boletoData.barcode,
        digitableLine: boletoData.digitableLine,
        boletoUrl: boletoData.boletoUrl,
        expiresAt: boletoData.expiresAt,
        amount: validAmount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate boleto error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar pagamento por boleto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
