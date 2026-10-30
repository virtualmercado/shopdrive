import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isValidJobTokenFormat } from "../_shared/authorization.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- JWT Authentication ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- End Auth ---

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorization: only Master/admin or an internal job may send as the platform.
    // A regular merchant JWT is never enough.
    const callerId = claimsData.claims.sub as string | undefined;
    const jobToken = req.headers.get("x-internal-job-token") ?? "";
    let authorized = false;
    if (isValidJobTokenFormat(jobToken)) {
      const { data: ok, error: jobErr } = await supabase.rpc("verify_internal_job_token", {
        p_job: "send-platform-email",
        p_token: jobToken,
      });
      authorized = !jobErr && ok === true;
    }
    if (!authorized && callerId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      authorized = isAdmin === true;
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SendEmailRequest = await req.json();
    const { to, subject, html, template_id, template_name, store_name, tenant_id } = body;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enqueue instead of sending directly
    const { error: insertErr } = await supabase.from("email_queue").insert({
      tenant_id: tenant_id || null,
      template: template_name || null,
      template_id: template_id || null,
      template_name: template_name || null,
      to_email: to,
      subject,
      html,
      payload: { template_id, template_name },
      status: "pending",
      scheduled_at: new Date().toISOString(),
      store_name: store_name || null,
    });

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ success: true, queued: true, message: "Email adicionado à fila de envio" }),
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
