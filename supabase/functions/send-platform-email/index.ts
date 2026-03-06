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
  store_name?: string;
  tenant_id?: string;
}

const HOUR_LIMIT = 100;
const DAY_LIMIT = 1000;
const ERROR_RATE_THRESHOLD = 20;
const BOUNCE_RATE_THRESHOLD = 10;

async function checkReputationShield(
  supabase: any,
  tenantId: string
): Promise<{ allowed: boolean; status: string; reason?: string }> {
  const { data: metrics } = await supabase
    .from("tenant_email_metrics")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!metrics) {
    // Create metrics row for new tenant
    await supabase.from("tenant_email_metrics").insert({ tenant_id: tenantId });
    return { allowed: true, status: "active" };
  }

  if (metrics.status === "blocked") {
    return { allowed: false, status: "blocked", reason: metrics.blocked_reason || "Bloqueado por política de reputação" };
  }

  // Reset hourly counter if >1h elapsed
  const hourElapsed = Date.now() - new Date(metrics.last_hour_reset_at).getTime() > 3600000;
  const dayElapsed = Date.now() - new Date(metrics.last_day_reset_at).getTime() > 86400000;

  let emailsHour = hourElapsed ? 0 : metrics.emails_last_hour;
  let emailsDay = dayElapsed ? 0 : metrics.emails_last_day;

  if (hourElapsed || dayElapsed) {
    const resetUpdates: any = {};
    if (hourElapsed) { resetUpdates.emails_last_hour = 0; resetUpdates.last_hour_reset_at = new Date().toISOString(); }
    if (dayElapsed) { resetUpdates.emails_last_day = 0; resetUpdates.last_day_reset_at = new Date().toISOString(); }
    await supabase.from("tenant_email_metrics").update(resetUpdates).eq("tenant_id", tenantId);
  }

  // Check rates
  if (metrics.error_rate > ERROR_RATE_THRESHOLD) {
    await supabase.from("tenant_email_metrics").update({
      status: "blocked",
      blocked_reason: `Taxa de erro acima de ${ERROR_RATE_THRESHOLD}%`,
    }).eq("tenant_id", tenantId);
    return { allowed: false, status: "blocked", reason: `Taxa de erro: ${metrics.error_rate}%` };
  }

  if (metrics.bounce_rate > BOUNCE_RATE_THRESHOLD) {
    await supabase.from("tenant_email_metrics").update({
      status: "blocked",
      blocked_reason: `Taxa de bounce acima de ${BOUNCE_RATE_THRESHOLD}%`,
    }).eq("tenant_id", tenantId);
    return { allowed: false, status: "blocked", reason: `Taxa de bounce: ${metrics.bounce_rate}%` };
  }

  if (emailsHour >= HOUR_LIMIT) {
    await supabase.from("tenant_email_metrics").update({ status: "limited" }).eq("tenant_id", tenantId);
    return { allowed: false, status: "limited", reason: `Limite horário atingido (${HOUR_LIMIT}/h)` };
  }

  if (emailsDay >= DAY_LIMIT) {
    await supabase.from("tenant_email_metrics").update({ status: "limited" }).eq("tenant_id", tenantId);
    return { allowed: false, status: "limited", reason: `Limite diário atingido (${DAY_LIMIT}/dia)` };
  }

  return { allowed: true, status: metrics.status };
}

async function updateMetricsAfterSend(
  supabase: any,
  tenantId: string,
  success: boolean
) {
  const { data: metrics } = await supabase
    .from("tenant_email_metrics")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!metrics) return;

  const totalSent = metrics.total_sent + 1;
  const totalErrors = metrics.total_errors + (success ? 0 : 1);
  const errorRate = totalSent > 0 ? (totalErrors / totalSent) * 100 : 0;

  await supabase
    .from("tenant_email_metrics")
    .update({
      emails_last_hour: metrics.emails_last_hour + 1,
      emails_last_day: metrics.emails_last_day + 1,
      total_sent: totalSent,
      total_errors: totalErrors,
      error_rate: Math.round(errorRate * 100) / 100,
      last_email_sent_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
}

async function sendViaResend(
  apiKey: string, from: string, replyTo: string,
  to: string, subject: string, html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.message || `Resend error [${res.status}]` };
  return { success: true, id: data.id };
}

async function sendViaSMTP(
  host: string, port: number, user: string, password: string, security: string,
  from: string, replyTo: string, to: string, subject: string, html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = security === "ssl"
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

    await readResponse();
    let ehloResp = await sendCommand("EHLO shopdrive.com.br");

    if (security === "tls" && ehloResp.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      conn.read = tlsConn.read.bind(tlsConn);
      conn.write = tlsConn.write.bind(tlsConn);
      ehloResp = await sendCommand("EHLO shopdrive.com.br");
    }

    if (user && password) {
      await sendCommand("AUTH LOGIN");
      await sendCommand(btoa(user));
      const authResp = await sendCommand(btoa(password));
      if (!authResp.startsWith("235")) { conn.close(); return { success: false, error: `SMTP auth failed: ${authResp.trim()}` }; }
    }

    const mailFromResp = await sendCommand(`MAIL FROM:<${from.replace(/.*</, "").replace(/>.*/, "")}>`);
    if (!mailFromResp.startsWith("250")) { conn.close(); return { success: false, error: `MAIL FROM failed: ${mailFromResp.trim()}` }; }

    const rcptResp = await sendCommand(`RCPT TO:<${to}>`);
    if (!rcptResp.startsWith("250")) { conn.close(); return { success: false, error: `RCPT TO failed: ${rcptResp.trim()}` }; }

    await sendCommand("DATA");
    const emailData = [
      `From: ${from}`, `To: ${to}`, `Reply-To: ${replyTo}`, `Subject: ${subject}`,
      `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`, `Date: ${new Date().toUTCString()}`, "", html, ".",
    ].join("\r\n");

    const dataResp = await sendCommand(emailData);
    if (!dataResp.startsWith("250")) { conn.close(); return { success: false, error: `DATA failed: ${dataResp.trim()}` }; }

    await sendCommand("QUIT");
    conn.close();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown SMTP error" };
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
    const { to, subject, html, template_id, template_name, store_name, tenant_id } = body;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REPUTATION SHIELD CHECK ===
    if (tenant_id) {
      const shield = await checkReputationShield(supabase, tenant_id);
      if (!shield.allowed) {
        // Log blocked attempt
        await supabase.from("email_send_logs").insert({
          template_id: template_id || null,
          template_name: template_name || null,
          recipient_email: to,
          subject,
          status: "blocked",
          error_message: `Reputation Shield: ${shield.reason}`,
        });

        return new Response(
          JSON.stringify({ success: false, error: `Email bloqueado: ${shield.reason}`, shield_status: shield.status }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Load platform email settings
    const { data: settings, error: settingsErr } = await supabase
      .from("platform_email_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings) throw new Error("Configurações de e-mail não encontradas");

    // Check tenant-specific email settings
    let tenantFrom: string | null = null;
    let tenantReplyTo: string | null = null;

    if (tenant_id) {
      const { data: tenantSettings } = await supabase
        .from("tenant_email_settings")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (tenantSettings?.domain_status === "verified" && tenantSettings.sender_email) {
        tenantFrom = `${tenantSettings.sender_name || store_name} <${tenantSettings.sender_email}>`;
        tenantReplyTo = tenantSettings.reply_to || tenantSettings.sender_email;
      }
    }

    const displayName = store_name
      ? (tenantFrom ? store_name : `${store_name} via ${settings.sender_name}`)
      : settings.sender_name;
    const fromHeader = tenantFrom || `${displayName} <${settings.sender_email}>`;
    const replyTo = tenantReplyTo || settings.reply_to || settings.sender_email;

    let result: { success: boolean; id?: string; error?: string };

    if (settings.provider === "smtp") {
      if (!settings.smtp_host || !settings.smtp_port) throw new Error("Configuração SMTP incompleta");
      result = await sendViaSMTP(
        settings.smtp_host, settings.smtp_port, settings.smtp_user || "",
        settings.smtp_password || "", settings.smtp_security || "tls",
        fromHeader, replyTo, to, subject, html
      );
    } else {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
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

    // === UPDATE METRICS ===
    if (tenant_id) {
      await updateMetricsAfterSend(supabase, tenant_id, result.success);
    }

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
