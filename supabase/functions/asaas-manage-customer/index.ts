import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CUSTOMER_STORE, handleAsaasManageCustomer, type CustomerDeps } from "./customer.ts";

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !key) return json({ ok: false, error: "auth_configuration_unavailable" }, 503);
  const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await server.rpc(name, args);
    if (error) throw new Error("ASAAS_DATABASE_ERROR");
    return data;
  };
  const deps: CustomerDeps = {
    getUserId: async (jwt) => {
      const { data, error } = await user.auth.getClaims(jwt);
      return error ? null : data?.claims?.sub ?? null;
    },
    isAdmin: async (actor) => await rpc("has_role", { _user_id: actor, _role: "admin" }) === true,
    accountId: async () => {
      const { data, error } = await server.from("store_asaas_accounts").select("id")
        .eq("store_id", CUSTOMER_STORE).eq("environment", "sandbox").maybeSingle();
      if (error) throw new Error("ASAAS_DATABASE_ERROR");
      return data?.id ?? null;
    },
    assertScope: async (actor, account) => { await rpc("_lock_asaas_customer_scope", {
      p_actor: actor, p_store_id: CUSTOMER_STORE, p_environment: "sandbox", p_account_id: account,
    }); },
    hasCommercialLink: async (profile) => {
      const { data, error } = await server.from("store_customers").select("customer_id")
        .eq("store_owner_id", CUSTOMER_STORE).eq("customer_id", profile).maybeSingle();
      if (error) throw new Error("ASAAS_DATABASE_ERROR");
      return !!data;
    },
    findLocal: async (document, profile) => {
      let query = server.from("store_asaas_customers")
        .select("id,cpf_cnpj_normalized,customer_profile_id,store_asaas_account_id,reservation_state,asaas_customer_id,external_reference,send_started_at")
        .eq("store_id", CUSTOMER_STORE).eq("environment", "sandbox");
      query = profile ? query.or(`cpf_cnpj_normalized.eq.${document},customer_profile_id.eq.${profile}`) : query.eq("cpf_cnpj_normalized", document);
      const { data, error } = await query;
      if (error) throw new Error("ASAAS_DATABASE_ERROR");
      return (data ?? []).map((row) => ({ id: row.id, document: row.cpf_cnpj_normalized, profileId: row.customer_profile_id,
        accountId: row.store_asaas_account_id, state: row.reservation_state, providerId: row.asaas_customer_id,
        externalReference: row.external_reference, sent: row.send_started_at !== null }));
    },
  };
  try {
    const result = await handleAsaasManageCustomer(req, deps);
    return json(result.body, result.status);
  } catch { return json({ ok: false, error: "internal_error" }, 500); }
});