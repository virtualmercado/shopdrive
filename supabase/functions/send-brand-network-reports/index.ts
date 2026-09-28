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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = { eligible: 0, generated: 0, queued: 0, sent: 0, failed: 0, skipped: 0, existing: 0, errors: 0 };

  // Disparo exclusivamente interno (scheduler). Fail closed: sem token válido, nada roda.
  const token = req.headers.get("x-internal-job-token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "unauthorized" }, 401);
  const { data: ok, error: authErr } = await db.rpc("verify_internal_job_token",
    { p_job: "send-brand-network-reports", p_token: token });
  if (authErr || ok !== true) return json({ error: "unauthorized" }, 401);

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
        if (g?.outcome === "existing") summary.existing++; else summary.generated++;
        summary.eligible++;

        const { data: run } = await db.from("brand_network_report_runs").select("*").eq("id", g.runId).single();
        if (!run || !["generated", "failed"].includes(run.status)) continue;          // sent/queued/sending/unknown: nunca reenviar
        const html = renderBrandNetworkReportHtml(run.brand_display_name_snapshot, run.metrics_snapshot, run.templates_snapshot);
        const { data: q, error: qErr } = await db.rpc("enqueue_brand_network_report",
          { p_run_id: run.id, p_html: html, p_max_attempts: MAX_SEND_ATTEMPTS });
        if (qErr) throw qErr;
        if (q?.outcome !== "queued") continue;
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
