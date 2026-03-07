import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_EMAIL = "suporte@shopdrive.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let targetTemplateId: string | null = null;
    let reportType: string = "monthly";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.template_id) targetTemplateId = body.template_id;
        if (body.report_type === "manual_test") reportType = "manual_test";
      } catch {
        // No body — cron mode
      }
    }

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

    const results: { template: string; status: string; detail?: string; used_fallback?: boolean }[] = [];

    for (const tpl of templates) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, store_name")
          .eq("id", tpl.source_profile_id)
          .maybeSingle();

        const brandEmail = profile?.email;
        const email = brandEmail || FALLBACK_EMAIL;
        const usedFallback = !brandEmail;

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

        const clicks = tpl.link_clicks || 0;
        const accounts = tpl.stores_created || 0;
        const conversion = clicks > 0 ? Math.round((accounts / clicks) * 100) : 0;

        const maxBar = Math.max(clicks, accounts, 1);
        const clicksBar = "\u2588".repeat(Math.max(1, Math.round((clicks / maxBar) * 20)));
        const accountsBar = "\u2588".repeat(Math.max(1, Math.round((accounts / maxBar) * 20)));

        const subjectPrefix = reportType === "manual_test" ? "[TESTE] " : "";
        const subject = `${subjectPrefix}Relat\u00f3rio mensal da marca ${tpl.name} \u2014 ${monthKey}`;

        // Validate inputs before building email
        if (!subject || typeof subject !== "string") {
          throw new Error("Subject inv\u00e1lido para o email");
        }

        const emailHtml = [
          '<!DOCTYPE html>',
          '<html>',
          '<head><meta charset="utf-8"></head>',
          '<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">',
          '  <div style="text-align: center; margin-bottom: 30px;">',
          `    <h1 style="color: #111; font-size: 24px; margin-bottom: 4px;">Relat\u00f3rio mensal \u2014 ${tpl.name}</h1>`,
          `    <p style="color: #666; font-size: 14px;">Per\u00edodo: ${monthKey}</p>`,
          reportType === "manual_test" ? '    <p style="color: #e67e22; font-size: 13px; font-weight: bold;">\u26a0\ufe0f Este \u00e9 um envio de teste</p>' : '',
          usedFallback ? '    <p style="color: #e67e22; font-size: 13px;">\ud83d\udce7 Enviado para email administrativo (marca sem email configurado)</p>' : '',
          '  </div>',
          '  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">',
          '    <table style="width: 100%; border-collapse: collapse;">',
          '      <tr>',
          '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">',
          '          <span style="color: #666; font-size: 14px;">Cliques no link de ativa\u00e7\u00e3o</span>',
          '        </td>',
          '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">',
          `          <strong style="font-size: 24px; color: #111;">${clicks}</strong>`,
          '        </td>',
          '      </tr>',
          '      <tr>',
          '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">',
          '          <span style="color: #666; font-size: 14px;">Contas criadas</span>',
          '        </td>',
          '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">',
          `          <strong style="font-size: 24px; color: #111;">${accounts}</strong>`,
          '        </td>',
          '      </tr>',
          '      <tr>',
          '        <td style="padding: 12px 0;">',
          `          <span style="color: #666; font-size: 14px;">Taxa de convers\u00e3o</span>`,
          '        </td>',
          '        <td style="padding: 12px 0; text-align: right;">',
          `          <strong style="font-size: 24px; color: #111;">${conversion}%</strong>`,
          '        </td>',
          '      </tr>',
          '    </table>',
          '  </div>',
          '  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">',
          `    <p style="color: #666; font-size: 13px; margin: 0 0 8px 0;">Cliques &nbsp; <span style="font-family: monospace; color: #5B9BD5;">${clicksBar}</span> &nbsp; ${clicks}</p>`,
          `    <p style="color: #666; font-size: 13px; margin: 0;">Contas &nbsp;&nbsp; <span style="font-family: monospace; color: #70AD47;">${accountsBar}</span> &nbsp; ${accounts}</p>`,
          '  </div>',
          '  <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">',
          '    <p style="color: #999; font-size: 12px;">',
          '      Este relat\u00f3rio \u00e9 gerado automaticamente pela ShopDrive.',
          '    </p>',
          '  </div>',
          '</body>',
          '</html>',
        ].join('\n');

        // Validate HTML body is a proper string
        if (!emailHtml || typeof emailHtml !== "string" || emailHtml.length < 10) {
          throw new Error("Corpo do email inv\u00e1lido ou vazio");
        }

        // Enqueue via email_queue table (processed by process-email-queue worker)
        const { error: queueErr } = await supabase.from("email_queue").insert({
          tenant_id: null,
          template: "brand_report",
          template_name: "brand_report",
          to_email: email,
          subject,
          html: emailHtml,
          payload: { template_id: tpl.id, report_type: reportType },
          status: "pending",
          scheduled_at: new Date().toISOString(),
          store_name: profile?.store_name || tpl.name,
        });

        if (queueErr) {
          throw new Error(`Erro ao enfileirar email: ${queueErr.message}`);
        }

        // Log the report
        await supabase.from("brand_report_logs").insert({
          template_id: tpl.id,
          report_month: monthKey,
          email_sent_to: email,
          clicks_snapshot: clicks,
          accounts_snapshot: accounts,
          conversion_snapshot: conversion,
          report_type: reportType,
        });

        results.push({ template: tpl.name, status: "sent", used_fallback: usedFallback });
      } catch (innerErr) {
        const msg = innerErr instanceof Error ? innerErr.message : "unknown";
        results.push({ template: tpl.name, status: "error", detail: msg });

        await supabase.from("email_logs").insert({
          template: "brand_report",
          destinatario: FALLBACK_EMAIL,
          status: "error",
          erro: msg,
        });
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
