import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderNotificationRequest {
  orderId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authentication check
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
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

    const { orderId }: OrderNotificationRequest = await req.json();

    if (!orderId || typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid order ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`*, order_items (product_name, quantity, product_price, subtotal)`)
      .eq("id", orderId)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found or too old" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch store owner info
    const { data: storeOwner } = await supabase
      .from("profiles")
      .select("full_name, store_name")
      .eq("id", order.store_owner_id)
      .single();

    if (!storeOwner) throw new Error("Failed to fetch store owner information");

    const { data: { user: storeUser } } = await supabase.auth.admin.getUserById(order.store_owner_id);
    if (!storeUser?.email) throw new Error("Failed to fetch store owner email");

    const storeOwnerEmail = storeUser.email;
    const storeName = storeOwner.store_name || storeOwner.full_name;

    // Format items list
    const itemsList = order.order_items.map((item: any) =>
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${Number(item.product_price).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">R$ ${Number(item.subtotal).toFixed(2)}</td>
      </tr>`
    ).join('');

    // Customer email HTML
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Pedido Confirmado!</h1>
        <p>Olá ${order.customer_name},</p>
        <p>Recebemos seu pedido com sucesso!</p>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">Pedido #${orderId.substring(0, 8)}</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead><tr style="background-color: #e5e7eb;">
              <th style="padding: 8px; text-align: left;">Produto</th>
              <th style="padding: 8px; text-align: center;">Qtd</th>
              <th style="padding: 8px; text-align: right;">Preço</th>
              <th style="padding: 8px; text-align: right;">Subtotal</th>
            </tr></thead>
            <tbody>${itemsList}</tbody>
          </table>
          <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
            Total: R$ ${Number(order.total_amount).toFixed(2)}
          </div>
        </div>
        <p>Obrigado por comprar na ${storeName}!</p>
      </div>`;

    // Store owner email HTML
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
            <thead><tr style="background-color: #e5e7eb;">
              <th style="padding: 8px; text-align: left;">Produto</th>
              <th style="padding: 8px; text-align: center;">Qtd</th>
              <th style="padding: 8px; text-align: right;">Preço</th>
              <th style="padding: 8px; text-align: right;">Subtotal</th>
            </tr></thead>
            <tbody>${itemsList}</tbody>
          </table>
          <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
            Total: R$ ${Number(order.total_amount).toFixed(2)}
          </div>
        </div>
        <p>Acesse seu dashboard para gerenciar este pedido.</p>
      </div>`;

    // Enqueue customer email
    await supabase.from("email_queue").insert({
      to_email: order.customer_email,
      subject: `Pedido Confirmado - ${storeName}`,
      html: customerEmailHtml,
      template: "order_confirmation_customer",
      tenant_id: order.store_owner_id,
      store_name: storeName,
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });

    // Enqueue store owner email
    await supabase.from("email_queue").insert({
      to_email: storeOwnerEmail,
      subject: `Novo Pedido Recebido - ${storeName}`,
      html: storeOwnerEmailHtml,
      template: "order_notification_owner",
      tenant_id: order.store_owner_id,
      store_name: storeName,
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, message: "Notificações enfileiradas com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email notification error:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to enqueue notifications" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
