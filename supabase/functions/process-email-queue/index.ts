import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 200; // 5 emails per second
const BCC_EMAIL = "suporte@shopdrive.com.br";

async function sendViaResend(
  apiKey: string, from: string, replyTo: string,
  to: string, subject: string, html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], bcc: [BCC_EMAIL], subject, html, reply_to: replyTo }),
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

    // Add BCC recipient
    const bccResp = await sendCommand(`RCPT TO:<${BCC_EMAIL}>`);
    if (!bccResp.startsWith("250")) {
      console.error(`BCC RCPT TO failed (non-blocking): ${bccResp.trim()}`);
    }

    await sendCommand("DATA");
    const emailData = [
      `From: ${from}`, `To: ${to}`, `Reply-To: ${replyTo}`, `Subject: ${subject}`,
      `Bcc: ${BCC_EMAIL}`,
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending + retry emails ready for processing
    const { data: emails, error: fetchErr } = await supabase
      .from("email_queue")
      .select("*")
      .in("status", ["pending", "retry"])
      .lte("scheduled_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Queue empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load platform email settings
    const { data: settings } = await supabase
      .from("platform_email_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!settings) throw new Error("Platform email settings not found");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    let sent = 0, failed = 0, blocked = 0, retried = 0;

    for (const email of emails) {
      // Mark as processing
      await supabase.from("email_queue").update({ status: "processing" }).eq("id", email.id);

      // Check reputation shield
      if (email.tenant_id) {
        const { data: metrics } = await supabase
          .from("tenant_email_metrics")
          .select("status")
          .eq("tenant_id", email.tenant_id)
          .maybeSingle();

        if (metrics?.status === "blocked") {
          await supabase.from("email_queue").update({
            status: "failed",
            last_error: "Tenant blocked by Reputation Shield",
          }).eq("id", email.id);

          await supabase.from("email_logs").insert({
            tenant_id: email.tenant_id,
            template: email.template,
            destinatario: email.to_email,
            status: "blocked",
            erro: "Reputation Shield: tenant blocked",
          });

          blocked++;
          continue;
        }
      }

      // Resolve sender identity
      let fromHeader = `${settings.sender_name} <${settings.sender_email}>`;
      let replyTo = settings.reply_to || settings.sender_email;

      if (email.tenant_id) {
        const { data: tenantSettings } = await supabase
          .from("tenant_email_settings")
          .select("*")
          .eq("tenant_id", email.tenant_id)
          .maybeSingle();

        if (tenantSettings?.domain_status === "verified" && tenantSettings.sender_email) {
          fromHeader = `${tenantSettings.sender_name || email.store_name || settings.sender_name} <${tenantSettings.sender_email}>`;
          replyTo = tenantSettings.reply_to || tenantSettings.sender_email;
        } else if (email.store_name) {
          fromHeader = `${email.store_name} via ${settings.sender_name} <${settings.sender_email}>`;
        }
      }

      // Send the email
      let result: { success: boolean; id?: string; error?: string };

      if (settings.provider === "smtp") {
        result = await sendViaSMTP(
          settings.smtp_host, settings.smtp_port, settings.smtp_user || "",
          settings.smtp_password || "", settings.smtp_security || "tls",
          fromHeader, replyTo, email.to_email, email.subject, email.html || ""
        );
      } else {
        if (!RESEND_API_KEY) {
          result = { success: false, error: "RESEND_API_KEY not configured" };
        } else {
          result = await sendViaResend(RESEND_API_KEY, fromHeader, replyTo, email.to_email, email.subject, email.html || "");
        }
      }

      if (result.success) {
        await supabase.from("email_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", email.id);

        await supabase.from("email_logs").insert({
          tenant_id: email.tenant_id,
          template: email.template,
          destinatario: email.to_email,
          email_remetente: fromHeader,
          status: "sent",
        });

        // Update tenant metrics
        if (email.tenant_id) {
          await supabase.rpc("increment_email_metric_counters", { p_tenant_id: email.tenant_id });
        }

        sent++;
      } else {
        const newAttempts = (email.attempts || 0) + 1;

        if (newAttempts >= 3) {
          await supabase.from("email_queue").update({
            status: "failed",
            attempts: newAttempts,
            last_error: result.error,
          }).eq("id", email.id);
          failed++;
        } else {
          const retryAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
          await supabase.from("email_queue").update({
            status: "retry",
            attempts: newAttempts,
            last_error: result.error,
            scheduled_at: retryAt,
          }).eq("id", email.id);
          retried++;
        }

        await supabase.from("email_logs").insert({
          tenant_id: email.tenant_id,
          template: email.template,
          destinatario: email.to_email,
          email_remetente: fromHeader,
          status: "error",
          erro: result.error,
        });
      }

      // Rate limiting: 5 emails/sec = 200ms delay
      await delay(RATE_LIMIT_DELAY_MS);
    }

    return new Response(
      JSON.stringify({ processed: emails.length, sent, failed, blocked, retried }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("process-email-queue error:", error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
