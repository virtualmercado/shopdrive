import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderBrandNetworkReportHtml } from "../_shared/brandNetworkReportEmail.ts";

// Relatório mensal MARCA (Prompt 10). Separado do legado send-brand-reports (AROMA).
// Sem parâmetros aceitos do request: sempre o MÊS CALENDÁRIO ANTERIOR em UTC.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_SEND_ATTEMPTS = 3;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

export function previousMonthStartUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = { eligible: 0, generated: 0, queued: 0, sent: 0, failed: 0, skipped: 0, existing: 0, errors: 0 };

  try {
    const { data: flag } = await db.rpc("is_plan_marca_enabled");
    if (flag !== true) return json({ outcome: "flag_off", ...summary });

    const sync = await db.rpc("sync_brand_network_report_status");
    if (!sync.error && sync.data) { summary.sent += sync.data.sent ?? 0; summary.failed += sync.data.failed ?? 0; }

    const periodStart = previousMonthStartUtc();
    const { data: accounts, error: accErr } = await db.from("brand_accounts").select("id").order("created_at");
    if (accErr) throw accErr;

    for (const acc of accounts ?? []) {
      try {
        const { data: g, error } = await db.rpc("generate_brand_network_monthly_report",
          { p_brand_account_id: acc.id, p_period_start: periodStart });
        if (error) throw error;
        if (g?.outcome === "skipped") { summary.skipped++; continue; }
        if (g?.outcome === "flag_off") break;
        if (g?.outcome === "existing") summary.existing++; else { summary.generated++; summary.eligible++; }

        const { data: run } = await db.from("brand_network_report_runs").select("*").eq("id", g.runId).single();
        if (!run || !["generated", "failed"].includes(run.status)) continue;          // sent/queued: nunca reenviar
        if (run.status === "failed" && run.send_attempts >= MAX_SEND_ATTEMPTS) continue; // retry limitado

        const html = renderBrandNetworkReportHtml(run.brand_display_name_snapshot, run.metrics_snapshot, run.templates_snapshot);
        const { data: q, error: qErr } = await db.from("email_queue").insert({
          tenant_id: null, template: "brand_network_monthly_report", template_name: "brand_network_monthly_report",
          to_email: run.recipient_email_snapshot, subject: run.subject_snapshot, html,
          payload: { brand_network_report_run_id: run.id }, status: "pending", scheduled_at: new Date().toISOString(),
        }).select("id").single();
        if (qErr) throw qErr;
        const { error: mErr } = await db.rpc("mark_brand_network_report_queued", { p_run_id: run.id, p_email_queue_id: q.id });
        if (mErr) throw mErr;
        summary.queued++;
      } catch (e) {
        summary.errors++;
        console.error("brand-network-report account error", acc.id, (e as { code?: string })?.code ?? "unknown");
      }
    }
    console.log("brand-network-report summary", JSON.stringify(summary));
    return json({ outcome: "ok", periodStart, ...summary });
  } catch (e) {
    console.error("brand-network-report fatal", (e as { code?: string })?.code ?? "unknown");
    return json({ outcome: "error", ...summary }, 500);
  }
});
