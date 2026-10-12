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
  idempotencyKey: string;
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

    // Admin role check - only admins may send platform ticket responses
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticketId, to, subject, message, ticketProtocolo, idempotencyKey }: SendEmailRequest = await req.json();




    if (!ticketId || !to || !subject || !message || !idempotencyKey || idempotencyKey.length > 100) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando: ticketId, to, subject, message, idempotencyKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate ticket + recipient
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets_landing_page").select("id, email").eq("id", ticketId).maybeSingle();
    if (ticketErr || !ticket) return json({ success: false, error: "Ticket não encontrado" }, 404);
    if (String(ticket.email).trim().toLowerCase() !== String(to).trim().toLowerCase()) {
      return json({ success: false, error: "Destinatário não corresponde ao ticket" }, 400);
    }

    // Idempotency: return existing operation for same key
    const findExisting = async () => {
      const { data } = await supabase.from("ticket_landing_responses")
        .select("id, status_envio, email_queue_id, erro_envio").eq("idempotency_key", idempotencyKey).maybeSingle();
      return data;
    };
    const existing = await findExisting();
    if (existing) {
      return json({ success: existing.status_envio !== "falha", duplicate: true, responseId: existing.id,
        status: existing.status_envio, error: existing.erro_envio ?? undefined });
    }

    // 1) History first (pendente)
    const { data: created, error: insertError } = await supabase.from("ticket_landing_responses").insert({
      ticket_id: ticketId, tipo: "email_enviado", assunto: subject, mensagem: message,
      enviado_por: userId, email_destinatario: to, status_envio: "pendente", idempotency_key: idempotencyKey,
    }).select("id").single();
    if (insertError || !created) {
      if ((insertError as any)?.code === "23505") {
        const dup = await findExisting();
        if (dup) return json({ success: dup.status_envio !== "falha", duplicate: true, responseId: dup.id, status: dup.status_envio });
      }
      console.error("Error recording response:", insertError);
      return json({ success: false, error: "Não foi possível registrar o histórico. O e-mail não foi enviado." }, 500);
    }

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

    // 2) Enqueue only after history exists
    const { data: queued, error: queueError } = await supabase.from("email_queue").insert({
      to_email: to, subject, html: htmlContent, template: "landing_ticket_response",
      status: "pending", scheduled_at: new Date().toISOString(),
      payload: { landing_ticket_response_id: created.id, ticket_id: ticketId },
    }).select("id").single();
    if (queueError || !queued) {
      console.error("Error enqueuing email:", queueError);
      await supabase.from("ticket_landing_responses")
        .update({ status_envio: "falha", erro_envio: "Falha ao colocar o e-mail na fila de envio" }).eq("id", created.id);
      return json({ success: false, responseId: created.id, status: "falha", error: "Erro ao enfileirar e-mail" }, 500);
    }

    // 3) Link history <-> queue (worker trigger updates status to enviado/falha)
    const { error: linkErr } = await supabase.from("ticket_landing_responses")
      .update({ email_queue_id: queued.id }).eq("id", created.id);
    if (linkErr) console.error("Error linking queue:", linkErr);

    return json({ success: true, responseId: created.id, status: "pendente", message: "E-mail colocado na fila de envio." });
  } catch (error: any) {
    console.error("Error in send-landing-ticket-response:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao enfileirar e-mail", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
