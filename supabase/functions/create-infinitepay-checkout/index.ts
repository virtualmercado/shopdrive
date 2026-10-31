// InfinitePay Checkout - public link generator
// Docs: https://www.infinitepay.io/checkout-documentacao
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCheckoutItemsFromOrder } from "../_shared/authorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CheckoutItem {
  name: string;
  quantity: number;
  // value in cents (InfinitePay convention) — we accept BRL number and convert
  price: number;
}

interface RequestBody {
  store_owner_id: string;
  order_id: string;
  order_number?: string | null;
  items: CheckoutItem[];
  customer?: {
    name?: string;
    email?: string;
    phone_number?: string;
  };
  redirect_url?: string;
}

function sanitizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").replace(/^\$/, "").toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    // Only the order id is accepted from the caller (guest-checkout compatible;
    // order ids are unguessable UUIDs). Store, items, quantities and prices are
    // ALWAYS loaded from the database — client-supplied values are ignored.
    if (!body?.order_id) {
      return new Response(
        JSON.stringify({ error: "order_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, store_owner_id, status, order_number, customer_name, customer_email, customer_phone")
      .eq("id", body.order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (order.status === "paid" || order.status === "confirmed") {
      return new Response(
        JSON.stringify({ error: "Pedido já está pago" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name, quantity, product_price")
      .eq("order_id", order.id);

    if (itemsError) throw itemsError;

    if (!orderItems || orderItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "Pedido sem itens" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("payment_settings")
      .select("infinitepay_enabled, infinitepay_handle")
      .eq("user_id", order.store_owner_id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings?.infinitepay_enabled || !settings?.infinitepay_handle) {
      return new Response(
        JSON.stringify({ error: "InfinitePay não está configurada para esta loja" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const handle = sanitizeHandle(settings.infinitepay_handle);

    // Items come exclusively from the persisted order (prices in cents).
    const items = buildCheckoutItemsFromOrder(orderItems);

    // Post-payment redirect: only HTTPS URLs on platform hosts or the store's
    // own active custom domain are forwarded; anything else is dropped.
    let safeRedirect: string | null = null;
    if (typeof body.redirect_url === "string" && body.redirect_url.length <= 2048) {
      try {
        const u = new URL(body.redirect_url);
        const h = u.hostname.toLowerCase();
        let allowed = u.protocol === "https:" && (
          h === "shopdrive.com.br" || h === "www.shopdrive.com.br" || h === "virtualmercado.lovable.app" ||
          /^id-preview--[0-9a-f-]{36}\.lovable\.app$/.test(h));
        if (!allowed && u.protocol === "https:") {
          const { data: prof } = await supabase.from("profiles").select("store_slug").eq("id", order.store_owner_id).maybeSingle();
          if (prof?.store_slug) {
            const { data: preferred } = await supabase.rpc("resolve_store_preferred_hostname", { p_store_slug: prof.store_slug });
            allowed = typeof preferred === "string" && preferred.length > 0 && preferred.toLowerCase() === h;
          }
        }
        if (allowed && !u.username && !u.password) safeRedirect = u.toString();
      } catch { safeRedirect = null; }
    }

    const payload: Record<string, unknown> = {
      handle,
      items,
      order_nsu: order.id,
      redirect_url: safeRedirect,
      customer: {
        name: order.customer_name ?? undefined,
        email: order.customer_email ?? undefined,
        phone_number: order.customer_phone ?? undefined,
      },
    };

    const resp = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar checkout InfinitePay", status: resp.status, details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const checkoutUrl: string | undefined = data?.url ?? data?.link ?? data?.checkout_url;

    if (!checkoutUrl) {
      return new Response(
        JSON.stringify({ error: "Resposta InfinitePay sem URL de checkout", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persist gateway reference on the SAME order loaded from the database
    await supabase
      .from("orders")
      .update({
        payment_method: "infinitepay",
        status: "pending",
        notes: `InfinitePay checkout: ${checkoutUrl}`,
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        handle,
        order_id: order.id,
        order_number: order.order_number ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-infinitepay-checkout error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
