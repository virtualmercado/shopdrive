import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { handleDiagnostic } from "./diagnostic.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status: number) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) return json({ error: "auth_configuration_unavailable" }, 503);
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const r = await handleDiagnostic(req, {
      getUserId: async (t) => { const { data, error } = await client.auth.getUser(t); return error ? null : data.user?.id ?? null; },
      isAdmin: async (id) => { const { data, error } = await client.rpc("has_role", { _user_id: id, _role: "admin" }); return !error && data === true; },
      env: (n) => Deno.env.get(n),
      fetchImpl: fetch,
    });
    return json(r.body, r.status);
  } catch {
    console.error("cloudflare-read-diagnostic: internal_error");
    return json({ error: "internal_error" }, 500);
  }
});