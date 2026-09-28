// Server-side acceptance of a plan contract (Plano MARCA).
// NOT wired to any screen yet. All validation (flag, published version, owner,
// price from master_plans, hashes, idempotency) happens in the database function
// record_plan_contract_acceptance, which only service_role can execute.
// Acceptance never activates a plan, creates a subscription or an invoice.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await authClient.auth.getUser(authHeader.slice(7));
  if (userErr || !userData?.user) return json({ error: "Não autenticado." }, 401);

  let body: { brand_account_id?: string; plan_id?: string; billing_cycle?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  const { brand_account_id, plan_id, billing_cycle } = body;
  if (!brand_account_id || !plan_id || !billing_cycle) {
    return json({ error: "Dados obrigatórios ausentes." }, 400);
  }

  // Network metadata from infrastructure headers only (never from JSON body).
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");
  const requestId = req.headers.get("x-request-id");

  const admin = createClient(url, service);
  const { data, error } = await admin.rpc("record_plan_contract_acceptance", {
    p_user_id: userData.user.id,
    p_brand_account_id: brand_account_id,
    p_plan_id: plan_id,
    p_billing_cycle: billing_cycle,
    p_ip_address: ip,
    p_user_agent: userAgent,
    p_request_id: requestId,
  });

  if (error) {
    console.error("[accept-plan-contract]", error.code, error.message);
    const status = error.code === "42501" ? 403 : error.code === "P0001" ? 422 : 500;
    const message = status === 500 ? "Não foi possível registrar o aceite." : error.message;
    return json({ error: message }, status);
  }
  return json(data);
});
