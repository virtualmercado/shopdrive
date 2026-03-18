import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendEmailRequest {
  ticketId: string;
  to: string;
  subject: string;
  message: string;
  ticketProtocolo: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // JWT Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { ticketId, to, subject, message, ticketProtocolo }: SendEmailRequest = await req.json();

    if (!ticketId || !to || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando: ticketId, to, subject, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
          .message-body { white-space: pre-wrap; background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
          .protocolo { background: #f0f0f0; padding: 5px 10px; border-radius: 4px; font-family: monospace; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">ShopDrive</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Sua loja no digital</p>
        </div>
        <div class="content">
          <p style="color: #666; font-size: 14px;">Referência: <span class="protocolo">${ticketProtocolo}</span></p>
          <div class="message-body">${message.replace(/\n/g, '<br>')}</div>
          <div class="footer">
            <p>Este é um e-mail automático enviado pela ShopDrive.</p>
            <p>Se você não solicitou este contato, por favor desconsidere esta mensagem.</p>
          </div>
        </div>
      </body>
      </html>`;

    // Enqueue email instead of sending directly via Resend
    const { error: queueError } = await supabase.from("email_queue").insert({
      to_email: to,
      subject: subject,
      html: htmlContent,
      template: "landing_ticket_response",
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });

    if (queueError) {
      console.error("Error enqueuing email:", queueError);
      throw new Error("Erro ao enfileirar e-mail");
    }

    // Record response in database
    const { error: insertError } = await supabase.from("ticket_landing_responses").insert({
      ticket_id: ticketId,
      tipo: "email_enviado",
      assunto: subject,
      mensagem: message,
      enviado_por: userId,
      email_destinatario: to,
      status_envio: "enfileirado",
    });

    if (insertError) {
      console.error("Error recording response:", insertError);
    }

    // Update ticket status
    await supabase
      .from("tickets_landing_page")
      .update({ status: "aguardando_cliente", updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    return new Response(
      JSON.stringify({ success: true, message: "E-mail enfileirado com sucesso!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-landing-ticket-response:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao enfileirar e-mail", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
