import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShippingProduct {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
}

interface ShippingRequest {
  store_user_id: string;
  from_postal_code: string;
  to_postal_code: string;
  products: ShippingProduct[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_user_id, from_postal_code, to_postal_code, products } = await req.json() as ShippingRequest;

    console.log("Calculating shipping for store:", store_user_id);
    console.log("From:", from_postal_code, "To:", to_postal_code);
    console.log("Products:", JSON.stringify(products));

    // Fetch Melhor Envio settings for this store
    const { data: settings, error: settingsError } = await supabase
      .from("melhor_envio_settings")
      .select("*")
      .eq("user_id", store_user_id)
      .eq("is_active", true)
      .single();

    if (settingsError || !settings) {
      console.error("Melhor Envio not configured or not active:", settingsError);
      return new Response(
        JSON.stringify({ 
          error: "Melhor Envio não configurado para esta loja",
          quotes: [] 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Melhor Envio settings found, environment:", settings.environment);

    // Determine API URL based on environment
    const apiUrl = settings.environment === "production"
      ? "https://melhorenvio.com.br/api/v2/me/shipment/calculate"
      : "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate";

    // Prepare the request body for Melhor Envio API
    const requestBody = {
      from: {
        postal_code: from_postal_code.replace(/\D/g, ""),
      },
      to: {
        postal_code: to_postal_code.replace(/\D/g, ""),
      },
      products: products.map(p => ({
        id: p.id,
        width: p.width || 11,
        height: p.height || 2,
        length: p.length || 16,
        weight: p.weight || 0.3,
        insurance_value: p.insurance_value || 0,
        quantity: p.quantity || 1,
      })),
      services: "1,2,17", // SEDEX (1), PAC (2), Mini Envios (17)
    };

    console.log("Calling Melhor Envio API:", apiUrl);
    console.log("Request body:", JSON.stringify(requestBody));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.api_key}`,
        "User-Agent": "VirtualMercado (contato@virtualmercado.com.br)",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log("Melhor Envio response status:", response.status);
    console.log("Melhor Envio response:", responseText);

    if (!response.ok) {
      console.error("Melhor Envio API error:", responseText);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao calcular frete", 
          details: responseText,
          quotes: [] 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const data = JSON.parse(responseText);
    
    // Map the response to our format
    const quotes = data
      .filter((quote: any) => !quote.error)
      .map((quote: any) => ({
        id: quote.id,
        name: quote.name,
        company: quote.company?.name || quote.name,
        price: parseFloat(quote.price) || 0,
        custom_price: parseFloat(quote.custom_price) || parseFloat(quote.price) || 0,
        discount: parseFloat(quote.discount) || 0,
        delivery_time: quote.delivery_time || 0,
        delivery_range: quote.delivery_range || { min: quote.delivery_time, max: quote.delivery_time },
        currency: quote.currency || "R$",
        error: quote.error || null,
      }));

    console.log("Processed quotes:", JSON.stringify(quotes));

    return new Response(
      JSON.stringify({ quotes }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in calculate-melhor-envio:", errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        quotes: [] 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
