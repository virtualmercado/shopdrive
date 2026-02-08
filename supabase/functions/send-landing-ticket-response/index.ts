import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  ticketId: string;
  to: string;
  subject: string;
  message: string;
  ticketProtocolo: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-landing-ticket-response: Request received");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      throw new Error("Server configuration error");
    }

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        console.log("Authenticated user:", userId);
      }
    }

    const { ticketId, to, subject, message, ticketProtocolo }: SendEmailRequest = await req.json();

    console.log("Sending email to:", to);
    console.log("Subject:", subject);
    console.log("Ticket ID:", ticketId);
    console.log("Ticket Protocolo:", ticketProtocolo);

    // Validate required fields
    if (!ticketId || !to || !subject || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando: ticketId, to, subject, message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Format the HTML email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .message-body {
            white-space: pre-wrap;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #888;
            font-size: 12px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .protocolo {
            background: #f0f0f0;
            padding: 5px 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">ShopDrive</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Suporte ao Cliente</p>
        </div>
        <div class="content">
          <p style="color: #666; font-size: 14px;">
            Referência: <span class="protocolo">${ticketProtocolo}</span>
          </p>
          <div class="message-body">${message.replace(/\n/g, '<br>')}</div>
          <div class="footer">
            <p>Este é um e-mail automático enviado pelo sistema ShopDrive.</p>
            <p>Se você não solicitou este contato, por favor desconsidere esta mensagem.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend using fetch (direct API call)
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ShopDrive <suporte@shopdrive.com.br>",
        to: [to],
        subject: subject,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();
    console.log("Resend response:", JSON.stringify(resendData));

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      
      // Record failed attempt in database
      await supabase.from("ticket_landing_responses").insert({
        ticket_id: ticketId,
        tipo: "email_enviado",
        assunto: subject,
        mensagem: message,
        enviado_por: userId,
        email_destinatario: to,
        status_envio: "falha",
      });

      throw new Error(resendData.message || "Erro ao enviar e-mail via Resend");
    }

    console.log("Email sent successfully:", resendData.id);

    // Record successful response in database
    const { error: insertError } = await supabase.from("ticket_landing_responses").insert({
      ticket_id: ticketId,
      tipo: "email_enviado",
      assunto: subject,
      mensagem: message,
      enviado_por: userId,
      email_destinatario: to,
      status_envio: "enviado",
    });

    if (insertError) {
      console.error("Error recording response:", insertError);
      // Don't throw - email was sent successfully
    }

    // Update ticket status to "aguardando_cliente"
    const { error: updateError } = await supabase
      .from("tickets_landing_page")
      .update({ 
        status: "aguardando_cliente",
        updated_at: new Date().toISOString()
      })
      .eq("id", ticketId);

    if (updateError) {
      console.error("Error updating ticket status:", updateError);
      // Don't throw - email was sent successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: resendData.id,
        message: "E-mail enviado com sucesso!" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-landing-ticket-response:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro interno ao enviar e-mail",
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
