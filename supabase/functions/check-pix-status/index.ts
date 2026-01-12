import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Request {
  pixPaymentId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { pixPaymentId } = await req.json() as Request;

    if (!pixPaymentId) {
      return new Response(
        JSON.stringify({ error: "pixPaymentId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking PIX payment status for: ${pixPaymentId}`);

    // Get the PIX payment record
    const { data: pixPayment, error: pixError } = await supabase
      .from('pix_payments')
      .select('*')
      .eq('id', pixPaymentId)
      .single();

    if (pixError || !pixPayment) {
      console.error("PIX payment not found:", pixError);
      return new Response(
        JSON.stringify({ error: "Pagamento PIX não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already approved or expired, return current status
    if (pixPayment.status === 'approved' || pixPayment.status === 'expired') {
      console.log(`Payment already in final state: ${pixPayment.status}`);
      return new Response(
        JSON.stringify({ status: pixPayment.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get merchant payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('user_id', pixPayment.store_owner_id)
      .single();

    if (settingsError || !paymentSettings) {
      console.error("Payment settings not found:", settingsError);
      return new Response(
        JSON.stringify({ error: "Configurações de pagamento não encontradas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let paymentStatus = 'pending';
    const externalPaymentId = pixPayment.external_payment_id;

    if (!externalPaymentId) {
      console.log("No external payment ID found");
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status based on gateway
    if (pixPayment.gateway === 'mercadopago') {
      console.log(`Checking Mercado Pago payment: ${externalPaymentId}`);
      
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${externalPaymentId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paymentSettings.mercadopago_access_token}`,
        },
      });

      if (mpResponse.ok) {
        const mpData = await mpResponse.json();
        console.log(`Mercado Pago status: ${mpData.status}`);
        
        if (mpData.status === 'approved') {
          paymentStatus = 'approved';
        } else if (mpData.status === 'cancelled' || mpData.status === 'rejected') {
          paymentStatus = 'cancelled';
        } else if (mpData.status === 'expired') {
          paymentStatus = 'expired';
        }
      } else {
        console.error("Error checking Mercado Pago status:", await mpResponse.text());
      }
    } else if (pixPayment.gateway === 'pagbank') {
      console.log(`Checking PagBank payment: ${externalPaymentId}`);
      
      const pbResponse = await fetch(`https://api.pagseguro.com/orders/${externalPaymentId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paymentSettings.pagbank_token}`,
        },
      });

      if (pbResponse.ok) {
        const pbData = await pbResponse.json();
        console.log(`PagBank status:`, pbData.charges?.[0]?.status);
        
        const chargeStatus = pbData.charges?.[0]?.status;
        if (chargeStatus === 'PAID') {
          paymentStatus = 'approved';
        } else if (chargeStatus === 'CANCELED' || chargeStatus === 'DECLINED') {
          paymentStatus = 'cancelled';
        }
      } else {
        console.error("Error checking PagBank status:", await pbResponse.text());
      }
    }

    // Update database if status changed
    if (paymentStatus !== 'pending' && paymentStatus !== pixPayment.status) {
      console.log(`Updating payment status to: ${paymentStatus}`);
      
      const updateData: Record<string, unknown> = {
        status: paymentStatus,
        updated_at: new Date().toISOString(),
      };

      if (paymentStatus === 'approved') {
        updateData.paid_at = new Date().toISOString();
      }

      // Update pix_payments table
      const { error: updatePixError } = await supabase
        .from('pix_payments')
        .update(updateData)
        .eq('id', pixPaymentId);

      if (updatePixError) {
        console.error("Error updating pix_payments:", updatePixError);
      }

      // Update orders table
      const orderUpdateData: Record<string, unknown> = {
        pix_payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      };

      if (paymentStatus === 'approved') {
        orderUpdateData.status = 'confirmed';
      }

      const { error: updateOrderError } = await supabase
        .from('orders')
        .update(orderUpdateData)
        .eq('id', pixPayment.order_id);

      if (updateOrderError) {
        console.error("Error updating order:", updateOrderError);
      }

      console.log(`Payment and order updated successfully`);
    }

    return new Response(
      JSON.stringify({ status: paymentStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Unexpected error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
