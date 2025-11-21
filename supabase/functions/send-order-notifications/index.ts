import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderNotificationRequest {
  orderId: string;
  customerEmail: string;
  customerName: string;
  storeOwnerId: string;
  totalAmount: number;
  orderItems: Array<{
    product_name: string;
    quantity: number;
    product_price: number;
    subtotal: number;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      orderId, 
      customerEmail, 
      customerName, 
      storeOwnerId, 
      totalAmount,
      orderItems 
    }: OrderNotificationRequest = await req.json();

    // Buscar informações do lojista
    const { data: storeOwner, error: storeOwnerError } = await supabase
      .from("profiles")
      .select("full_name, store_name")
      .eq("id", storeOwnerId)
      .single();

    if (storeOwnerError) {
      throw new Error("Failed to fetch store owner information");
    }

    // Buscar email do lojista
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(storeOwnerId);
    
    if (userError || !user) {
      throw new Error("Failed to fetch store owner email");
    }

    const storeOwnerEmail = user.email!;
    const storeName = storeOwner.store_name || storeOwner.full_name;

    // Formatar lista de itens para o email
    const itemsList = orderItems.map(item => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${item.product_price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${item.subtotal.toFixed(2)}</td>
      </tr>`
    ).join('');

    // Email para o cliente
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Pedido Confirmado!</h1>
        <p>Olá ${customerName},</p>
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
            Total: R$ ${totalAmount.toFixed(2)}
          </div>
        </div>
        
        <p>Você receberá atualizações sobre o status do seu pedido.</p>
        <p>Obrigado por comprar na ${storeName}!</p>
      </div>
    `;

    // Email para o lojista
    const storeOwnerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Novo Pedido Recebido! 🎉</h1>
        <p>Olá ${storeOwner.full_name},</p>
        <p>Você recebeu um novo pedido em sua loja!</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">Pedido #${orderId.substring(0, 8)}</h2>
          
          <div style="margin-bottom: 20px;">
            <strong>Cliente:</strong> ${customerName}<br>
            <strong>Email:</strong> ${customerEmail}
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
            Total: R$ ${totalAmount.toFixed(2)}
          </div>
        </div>
        
        <p>Acesse seu dashboard para gerenciar este pedido.</p>
      </div>
    `;

    // Enviar email para o cliente
    const customerEmailResult = await resend.emails.send({
      from: "Confirmação de Pedido <onboarding@resend.dev>",
      to: [customerEmail],
      subject: `Pedido Confirmado - ${storeName}`,
      html: customerEmailHtml,
    });

    // Enviar email para o lojista
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
