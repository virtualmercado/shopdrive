import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") || "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderNotificationRequest {
  orderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId }: OrderNotificationRequest = await req.json();

    if (!orderId || typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid order ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Use service role to fetch order details
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order with items - only process recent orders (last 10 minutes)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          product_name,
          quantity,
          product_price,
          subtotal
        )
      `)
      .eq("id", orderId)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found or too old" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch store owner information
    const { data: storeOwner, error: storeOwnerError } = await supabase
      .from("profiles")
      .select("full_name, store_name")
      .eq("id", order.store_owner_id)
      .single();

    if (storeOwnerError || !storeOwner) {
      throw new Error("Failed to fetch store owner information");
    }

    // Fetch store owner email
    const { data: { user: storeUser }, error: userError } = await supabase.auth.admin.getUserById(order.store_owner_id);
    
    if (userError || !storeUser || !storeUser.email) {
      throw new Error("Failed to fetch store owner email");
    }

    const storeOwnerEmail = storeUser.email;
    const storeName = storeOwner.store_name || storeOwner.full_name;

    // Format order items list
    const itemsList = order.order_items.map((item: any) => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${Number(item.product_price).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${Number(item.subtotal).toFixed(2)}</td>
      </tr>`
    ).join('');

    // Customer confirmation email
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Pedido Confirmado!</h1>
        <p>Olá ${order.customer_name},</p>
        <p>Recebemos seu pedido com sucesso! Aqui estão os detalhes:</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">Pedido #${orderId.substring(0, 8)}</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #e5e7eb;">
                <th style="padding: 8px; text-align: left;">Produto</th>
                <th style="padding: 8px; text-align: center;">Qtd</th>
                <th style="padding: 8px; text-align: right;">Preço</th>
                <th style="padding: 8px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>
          
          <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
            Total: R$ ${Number(order.total_amount).toFixed(2)}
          </div>
        </div>
        
        <p>Você receberá atualizações sobre o status do seu pedido.</p>
        <p>Obrigado por comprar na ${storeName}!</p>
      </div>
    `;

    // Store owner notification email
    const storeOwnerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Novo Pedido Recebido! 🎉</h1>
        <p>Olá ${storeOwner.full_name},</p>
        <p>Você recebeu um novo pedido em sua loja!</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">Pedido #${orderId.substring(0, 8)}</h2>
          
          <div style="margin-bottom: 20px;">
            <strong>Cliente:</strong> ${order.customer_name}<br>
            <strong>Email:</strong> ${order.customer_email}
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #e5e7eb;">
                <th style="padding: 8px; text-align: left;">Produto</th>
                <th style="padding: 8px; text-align: center;">Qtd</th>
                <th style="padding: 8px; text-align: right;">Preço</th>
                <th style="padding: 8px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>
          
          <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
            Total: R$ ${Number(order.total_amount).toFixed(2)}
          </div>
        </div>
        
        <p>Acesse seu dashboard para gerenciar este pedido.</p>
      </div>
    `;

    // Send customer confirmation email
    const customerEmailResult = await resend.emails.send({
      from: "Confirmação de Pedido <onboarding@resend.dev>",
      to: [order.customer_email],
      subject: `Pedido Confirmado - ${storeName}`,
      html: customerEmailHtml,
    });

    // Send store owner notification email
    const storeOwnerEmailResult = await resend.emails.send({
      from: "Novo Pedido <onboarding@resend.dev>",
      to: [storeOwnerEmail],
      subject: `Novo Pedido Recebido - ${storeName}`,
      html: storeOwnerEmailHtml,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        customerEmailId: customerEmailResult.data?.id,
        storeOwnerEmailId: storeOwnerEmailResult.data?.id
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Email notification error:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to send notifications" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);