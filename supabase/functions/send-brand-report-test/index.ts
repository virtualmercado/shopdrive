// Envio de TESTE do relatório legado (Painel Master).
// Autoridade: JWT de admin. Destino: SOMENTE o e-mail do próprio admin (auth.users).
// Nunca usa a chave interna do scheduler, nunca grava brand_report_logs, nunca altera métricas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildReportHtml } from "../_shared/legacyBrandReportEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEST_BANNER =
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto 12px; padding: 10px 14px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; color: #9a3412; font-size: 13px;">Este é um envio de teste do Painel Master. Nenhum relatório real foi disparado.</div>';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // --- Auth: JWT válido + has_role admin ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleErr || isAdmin !== true) return json({ error: "forbidden" }, 403);

  // --- Body: somente template_id. Qualquer campo de destinatário é rejeitado. ---
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "invalid_body" }, 400);
  for (const k of ["to", "email", "recipient", "destination", "to_email", "html", "subject"]) {
    if (k in body) return json({ error: "field_not_allowed" }, 400);
  }
  const templateId = body.template_id;
  if (typeof templateId !== "string" || !UUID.test(templateId)) return json({ error: "invalid_template_id" }, 400);

  const adminEmail = (user.email ?? "").trim();
  if (!EMAIL.test(adminEmail)) return json({ error: "admin_email_missing" }, 422);

  const { data: tpl, error: tplErr } = await admin
    .from("brand_templates")
    .select("id, name, template_slug, link_clicks, stores_created, status, products_count, is_link_active, updated_at")
    .eq("id", templateId)
    .maybeSingle();
  if (tplErr) return json({ error: "internal_error" }, 500);
  if (!tpl) return json({ error: "template_not_found" }, 404);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const subject = `[TESTE] Relatório mensal da marca ${tpl.name} — ${monthKey}`;
  const html = buildReportHtml(tpl, "manual_test", monthKey, false)
    .replace(/<body([^>]*)>/, `<body$1>\n${TEST_BANNER}`);

  const { error: qErr } = await admin.from("email_queue").insert({
    tenant_id: null,
    template: "brand_report_test",
    template_name: "brand_report_test",
    to_email: adminEmail,
    subject,
    html,
    payload: { template_id: tpl.id, report_type: "admin_test" },
    status: "pending",
    scheduled_at: now.toISOString(),
    store_name: tpl.name,
  });

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "BRAND_REPORT_TEST_SENT",
    entity_type: "brand_template",
    entity_id: tpl.id,
    metadata: { result: qErr ? "failed" : "queued" },
  });

  if (qErr) {
    console.error("send-brand-report-test: queue insert failed");
    return json({ error: "send_failed" }, 500);
  }
  return json({ status: "queued", sent_to: adminEmail });
});
