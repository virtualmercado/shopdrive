import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  template_id?: string;
  template_name?: string;
  store_name?: string; // For multi-tenant: "Loja XYZ via ShopDrive"
}

async function sendViaResend(
  apiKey: string,
  from: string,
  replyTo: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      reply_to: replyTo,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.message || `Resend error [${res.status}]` };
  }
  return { success: true, id: data.id };
}

async function sendViaSMTP(
  host: string,
  port: number,
  user: string,
  password: string,
  security: string,
  from: string,
  replyTo: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  // Build SMTP request using Deno's native TCP + STARTTLS
  // We use a lightweight approach via an SMTP relay call
  try {
    const useTLS = security === "ssl" || security === "tls";
    const conn = useTLS && security === "ssl"
      ? await Deno.connectTls({ hostname: host, port })
      : await Deno.connect({ hostname: host, port });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : "";
    }

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await readResponse();
    }

    // Read greeting
    await readResponse();

    // EHLO
    let ehloResp = await sendCommand(`EHLO shopdrive.com.br`);

    // STARTTLS for TLS (not SSL)
    if (security === "tls" && ehloResp.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      // Replace conn reference - use tlsConn for remaining commands
      const origRead = conn.read.bind(conn);
      const origWrite = conn.write.bind(conn);
      conn.read = tlsConn.read.bind(tlsConn);
      conn.write = tlsConn.write.bind(tlsConn);
      ehloResp = await sendCommand(`EHLO shopdrive.com.br`);
    }

    // AUTH LOGIN
    if (user && password) {
      await sendCommand("AUTH LOGIN");
      await sendCommand(btoa(user));
      const authResp = await sendCommand(btoa(password));
      if (!authResp.startsWith("235")) {
        conn.close();
        return { success: false, error: `SMTP auth failed: ${authResp.trim()}` };
      }
    }

    // MAIL FROM
    const mailFromResp = await sendCommand(`MAIL FROM:<${from.replace(/.*</, "").replace(/>.*/, "")}>`);
    if (!mailFromResp.startsWith("250")) {
      conn.close();
      return { success: false, error: `MAIL FROM failed: ${mailFromResp.trim()}` };
    }

    // RCPT TO
    const rcptResp = await sendCommand(`RCPT TO:<${to}>`);
    if (!rcptResp.startsWith("250")) {
      conn.close();
      return { success: false, error: `RCPT TO failed: ${rcptResp.trim()}` };
    }

    // DATA
    await sendCommand("DATA");

    const boundary = `----=_Part_${Date.now()}`;
    const emailData = [
      `From: ${from}`,
      `To: ${to}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      `Date: ${new Date().toUTCString()}`,
      ``,
      html,
      `.`,
    ].join("\r\n");

    const dataResp = await sendCommand(emailData);
    if (!dataResp.startsWith("250")) {
      conn.close();
      return { success: false, error: `DATA failed: ${dataResp.trim()}` };
    }

    await sendCommand("QUIT");
    conn.close();

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown SMTP error";
    return { success: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: SendEmailRequest = await req.json();
    const { to, subject, html, template_id, template_name, store_name } = body;
    const tenant_id = (body as any).tenant_id;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load platform email settings
    const { data: settings, error: settingsErr } = await supabase
      .from("platform_email_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings) {
      throw new Error("Configurações de e-mail não encontradas");
    }

    // Check tenant-specific email settings
    let tenantFrom: string | null = null;
    let tenantReplyTo: string | null = null;

    if (tenant_id) {
      const { data: tenantSettings } = await supabase
        .from("tenant_email_settings")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (tenantSettings && tenantSettings.domain_status === "verified" && tenantSettings.sender_email) {
        tenantFrom = `${tenantSettings.sender_name || store_name} <${tenantSettings.sender_email}>`;
        tenantReplyTo = tenantSettings.reply_to || tenantSettings.sender_email;
      }
    }

    // Build From header (tenant verified → use tenant, otherwise fallback)
    const displayName = store_name
      ? (tenantFrom ? store_name : `${store_name} via ${settings.sender_name}`)
      : settings.sender_name;
    const fromHeader = tenantFrom || `${displayName} <${settings.sender_email}>`;
    const replyTo = tenantReplyTo || settings.reply_to || settings.sender_email;

    let result: { success: boolean; id?: string; error?: string };

    if (settings.provider === "smtp") {
      if (!settings.smtp_host || !settings.smtp_port) {
        throw new Error("Configuração SMTP incompleta");
      }
      result = await sendViaSMTP(
        settings.smtp_host,
        settings.smtp_port,
        settings.smtp_user || "",
        settings.smtp_password || "",
        settings.smtp_security || "tls",
        fromHeader,
        replyTo,
        to,
        subject,
        html
      );
    } else {
      // Resend provider
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY não configurada");
      }
      result = await sendViaResend(RESEND_API_KEY, fromHeader, replyTo, to, subject, html);
    }

    // Log the send attempt
    await supabase.from("email_send_logs").insert({
      template_id: template_id || null,
      template_name: template_name || null,
      recipient_email: to,
      subject,
      status: result.success ? "sent" : "error",
      error_message: result.error || null,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("send-platform-email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
