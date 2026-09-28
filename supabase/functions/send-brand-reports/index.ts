import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildReportHtml } from "../_shared/legacyBrandReportEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_EMAIL = "suporte@shopdrive.com.br";

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Autorização interna (Prompt 10.2): mesmo padrão do relatório MARCA. ---
    // JWT de usuário (inclusive admin) NÃO autoriza. Fail closed.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const jobToken = req.headers.get("x-internal-job-token") ?? "";
    let authorized = false;
    if (/^[0-9a-f]{64}$/.test(jobToken)) {
      const { data: ok, error: authErr } = await supabase.rpc("verify_internal_job_token",
        { p_job: "send-brand-reports", p_token: jobToken });
      authorized = !authErr && ok === true;
    }
    if (!authorized) {
      console.warn("send-brand-reports: internal authorization failed");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- End Auth ---

    let targetTemplateId: string | null = null;
    let reportType: string = "monthly";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.template_id) {
          if (!isValidUUID(body.template_id)) {
            console.error(`template_id inválido: "${body.template_id}"`);
            return new Response(JSON.stringify({ error: `template_id inválido: ${body.template_id}` }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          targetTemplateId = body.template_id;
        }
        if (body.report_type === "manual_test") reportType = "manual_test";
      } catch {
        // No body — cron mode
      }
    }

    // Fetch templates directly — no dependency on external resource IDs
    let query = supabase
      .from("brand_templates")
      .select("id, name, template_slug, link_clicks, stores_created, source_profile_id, status, products_count, is_link_active, updated_at");

    if (targetTemplateId) {
      query = query.eq("id", targetTemplateId);
    } else {
      query = query.eq("status", "active").not("source_profile_id", "is", null);
    }

    const { data: templates, error: tplError } = await query;
    if (tplError) {
      console.error("Erro ao buscar templates:", tplError.message);
      throw tplError;
    }
    if (!templates || templates.length === 0) {
      const detail = targetTemplateId
        ? `Template não encontrado: ${targetTemplateId}`
        : "Nenhum template ativo encontrado";
      console.error(detail);
      return new Response(JSON.stringify({ message: detail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { template: string; status: string; detail?: string; used_fallback?: boolean }[] = [];

    for (const tpl of templates) {
      try {
        // Resolve brand email — optional, uses fallback if missing
        let brandEmail: string | null = null;
        if (tpl.source_profile_id) {
          if (!isValidUUID(tpl.source_profile_id)) {
            console.error(`source_profile_id inválido para template "${tpl.name}": "${tpl.source_profile_id}"`);
          } else {
            const { data: profile, error: profileErr } = await supabase
              .from("profiles")
              .select("email, store_name")
              .eq("id", tpl.source_profile_id)
              .maybeSingle();

            if (profileErr) {
              console.error(`Erro ao buscar perfil para template "${tpl.name}" (profile_id: ${tpl.source_profile_id}): ${profileErr.message}`);
            } else {
              brandEmail = profile?.email || null;
            }
          }
        } else {
          console.warn(`Template "${tpl.name}" (${tpl.id}) não possui source_profile_id — usando fallback`);
        }

        const email = brandEmail || FALLBACK_EMAIL;
        const usedFallback = !brandEmail;

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        // Skip duplicate monthly reports (but not manual tests)
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

        // Build subject and HTML directly from template data — no external resource dependencies
        const subjectPrefix = reportType === "manual_test" ? "[TESTE] " : "";
        const subject = `${subjectPrefix}Relatório mensal da marca ${tpl.name} — ${monthKey}`;
        const emailHtml = buildReportHtml(tpl, reportType, monthKey, usedFallback);

        // Enqueue via email_queue (processed by process-email-queue worker)
        // tenant_id is explicitly null — this is a platform-level report, not tenant-scoped
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
          store_name: tpl.name,
        });

        if (queueErr) {
          console.error(`Erro ao enfileirar email para template "${tpl.name}" (${tpl.id}): ${queueErr.message}`);
          throw new Error(`Erro ao enfileirar email: ${queueErr.message}`);
        }

        // Log the report
        const clicks = (tpl.link_clicks as number) || 0;
        const accounts = (tpl.stores_created as number) || 0;
        const conversion = clicks > 0 ? Math.round((accounts / clicks) * 100) : 0;

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
        console.error(`Erro no envio para template "${tpl.name}" (${tpl.id}): ${msg}`);
        results.push({ template: tpl.name, status: "error", detail: msg });

        await supabase.from("email_logs").insert({
          template: "brand_report",
          destinatario: FALLBACK_EMAIL,
          status: "error",
          erro: `Template: ${tpl.name} (${tpl.id}) — ${msg}`,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-brand-reports:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
