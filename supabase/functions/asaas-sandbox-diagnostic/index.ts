import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { handleAsaasSandboxDiagnostic } from "./diagnostic.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  console.info("[ASAAS_DIAGNOSTIC_STARTED]");
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) {
      console.error("[ASAAS_DIAGNOSTIC_FAILED]");
      return json({ ok: false, error: "auth_configuration_unavailable" }, 503);
    }
    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const result = await handleAsaasSandboxDiagnostic(req, {
      getUserId: async (bearer) => {
        const { data, error } = await userClient.auth.getClaims(bearer);
        return error ? null : data?.claims?.sub ?? null;
      },
      isAdmin: async (userId) => {
        const { data, error } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
        return !error && data === true;
      },
      env: (name) => Deno.env.get(name),
      fetchImpl: fetch,
    });
    console.info(result.body.ok === true ? "[ASAAS_DIAGNOSTIC_SUCCESS]" : "[ASAAS_DIAGNOSTIC_FAILED]");
    return json(result.body, result.status);
  } catch {
    console.error("[ASAAS_DIAGNOSTIC_FAILED]");
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
