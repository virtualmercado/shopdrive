import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for optional body params (manual send)
    let targetTemplateId: string | null = null;
    let reportType: string = "monthly";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.template_id) {
          targetTemplateId = body.template_id;
        }
        if (body.report_type === "manual_test") {
          reportType = "manual_test";
        }
      } catch {
        // No body or invalid JSON — treat as cron (all templates)
      }
    }

    // Build query for templates
    let query = supabase
      .from("brand_templates")
      .select("id, name, template_slug, link_clicks, stores_created, source_profile_id")
      .not("source_profile_id", "is", null);

    if (targetTemplateId) {
      query = query.eq("id", targetTemplateId);
    } else {
      query = query.eq("status", "active");
    }

    const { data: templates, error: tplError } = await query;

    if (tplError) throw tplError;
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ message: "No templates found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { template: string; status: string; detail?: string }[] = [];

    for (const tpl of templates) {
      try {
        // Get email from the source profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, store_name")
          .eq("id", tpl.source_profile_id)
          .maybeSingle();

        const brandEmail = profile?.email;
        const FALLBACK_EMAIL = "no-reply@shopdrive.com.br";
        const email = brandEmail || FALLBACK_EMAIL;
        const usedFallback = !brandEmail;

        // For monthly (cron) sends, check if report was already sent this month
        // For manual_test sends, skip this check so admins can always re-send
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        if (reportType === "monthly") {
          const { data: existingLog } = await supabase
            .from("brand_report_logs")
            .select("id")
            .eq("template_id", tpl.id)
            .eq("report_month", monthKey)
            .eq("report_type", "monthly")
            .maybeSingle();

          if (existingLog) {
            results.push({ template: tpl.name, status: "skipped", detail: "already sent" });
            continue;
          }
        }

        // Calculate conversion rate
        const clicks = tpl.link_clicks || 0;
        const accounts = tpl.stores_created || 0;
        const conversion = clicks > 0 ? Math.round((accounts / clicks) * 100) : 0;

        // Build visual bar chart
        const maxBar = Math.max(clicks, accounts, 1);
        const clicksBar = "█".repeat(Math.max(1, Math.round((clicks / maxBar) * 20)));
        const accountsBar = "█".repeat(Math.max(1, Math.round((accounts / maxBar) * 20)));

        // Subject line differs for manual test
        const subjectPrefix = reportType === "manual_test" ? "[TESTE] " : "";
        const subject = `${subjectPrefix}Relatório mensal da marca ${tpl.name} — ${monthKey}`;

        // Send email via Resend
        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #111; font-size: 24px; margin-bottom: 4px;">Relatório mensal — ${tpl.name}</h1>
    <p style="color: #666; font-size: 14px;">Período: ${monthKey}</p>
    ${reportType === "manual_test" ? '<p style="color: #e67e22; font-size: 13px; font-weight: bold;">⚠️ Este é um envio de teste</p>' : ""}
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #666; font-size: 14px;">Cliques no link de ativação</span>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
          <strong style="font-size: 24px; color: #111;">${clicks}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #666; font-size: 14px;">Contas criadas</span>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
          <strong style="font-size: 24px; color: #111;">${accounts}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <span style="color: #666; font-size: 14px;">Taxa de conversão</span>
        </td>
        <td style="padding: 12px 0; text-align: right;">
          <strong style="font-size: 24px; color: #111;">${conversion}%</strong>
        </td>
      </tr>
    </table>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <p style="color: #666; font-size: 13px; margin: 0 0 8px 0;">Cliques &nbsp; <span style="font-family: monospace; color: #5B9BD5;">${clicksBar}</span> &nbsp; ${clicks}</p>
    <p style="color: #666; font-size: 13px; margin: 0;">Contas &nbsp;&nbsp; <span style="font-family: monospace; color: #70AD47;">${accountsBar}</span> &nbsp; ${accounts}</p>
  </div>

  <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
    <p style="color: #999; font-size: 12px;">
      Este relatório é gerado automaticamente pela ShopDrive.
    </p>
  </div>
</body>
</html>`;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ShopDrive <noreply@shopdrive.com.br>",
            to: [email],
            subject,
            html: emailHtml,
          }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          throw new Error(`Resend error [${resendRes.status}]: ${errBody}`);
        }

        // Log successful send
        await supabase.from("brand_report_logs").insert({
          template_id: tpl.id,
          report_month: monthKey,
          email_sent_to: email,
          clicks_snapshot: clicks,
          accounts_snapshot: accounts,
          conversion_snapshot: conversion,
          report_type: reportType,
        });

        results.push({ template: tpl.name, status: "sent" });
      } catch (innerErr) {
        const msg = innerErr instanceof Error ? innerErr.message : "unknown";
        results.push({ template: tpl.name, status: "error", detail: msg });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-brand-reports:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
