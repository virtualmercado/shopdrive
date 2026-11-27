import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { handleAsaasManageSubaccount, type AsaasProvisioningDeps } from "./provisioning.ts";
import { createAsaasEventReconciler } from "../_shared/asaasAccountReconciliation.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return json({ ok: false, error: "auth_configuration_unavailable" }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw new Error("ASAAS_DATABASE_ERROR");
    return data;
  };

  const deps: AsaasProvisioningDeps = {
    getUserId: async (bearer) => {
      const { data, error } = await userClient.auth.getClaims(bearer);
      return error ? null : data?.claims?.sub ?? null;
    },
    canManageStore: async (actor, storeId) => {
      const allowed = await rpc("can_actor_manage_marca_store", { p_actor: actor, p_store_id: storeId });
      return allowed === true;
    },
    getInstitutionalEmail: async () => {
      const { data, error } = await admin.from("platform_settings")
        .select("setting_value").eq("setting_key", "institutional_email").maybeSingle();
      if (error) throw new Error("ASAAS_DATABASE_ERROR");
      return typeof data?.setting_value === "string" ? data.setting_value : null;
    },
    isAdmin: async (actor) => await rpc("has_role", { _user_id: actor, _role: "admin" }) === true,
    getOnboardingAccount: async (storeId) => {
      const { data, error } = await admin.from("store_asaas_accounts")
        .select("asaas_account_id,encrypted_api_key,created_at")
        .eq("store_id", storeId).eq("environment", "sandbox").maybeSingle();
      if (error) throw new Error("ASAAS_DATABASE_ERROR");
      if (!data?.asaas_account_id || !data.encrypted_api_key || !data.created_at) return null;
      return { accountId: data.asaas_account_id, encryptedApiKey: data.encrypted_api_key, createdAt: data.created_at };
    },
    reconcileEvents: createAsaasEventReconciler(admin, (name) => Deno.env.get(name), fetch),
    begin: async (actor, storeId, webhookTokenHash, authorizationId) =>
      await rpc("begin_asaas_subaccount_creation", {
        p_actor: actor, p_store_id: storeId, p_webhook_token_hash: webhookTokenHash, p_authorization_id: authorizationId,
      }) as Awaited<ReturnType<AsaasProvisioningDeps["begin"]>>,
    capture: async (input) => await rpc("capture_asaas_subaccount_credentials", {
      p_attempt_token: input.attemptToken,
      p_asaas_account_id: input.accountId,
      p_wallet_id: input.walletId,
      p_account_number: input.accountNumber,
      p_encrypted_api_key: input.encryptedApiKey,
      p_api_key_fingerprint: input.apiKeyFingerprint,
    }) === true,
    complete: async (input) => await rpc("complete_asaas_subaccount_creation", {
      p_attempt_token: input.attemptToken,
      p_commercial_status: input.statuses?.commercialInfo ?? null,
      p_bank_account_status: input.statuses?.bankAccountInfo ?? null,
      p_document_status: input.statuses?.documentation ?? null,
      p_general_approval_status: input.statuses?.general ?? null,
      p_status: input.status,
      p_last_error_code: input.errorCode,
    }) === true,
    fail: async (input) => await rpc("fail_asaas_subaccount_creation", {
      p_attempt_token: input.attemptToken,
      p_error_code: input.errorCode,
      p_asaas_account_id: input.accountId ?? null,
      p_wallet_id: input.walletId ?? null,
      p_account_number: input.accountNumber ?? null,
    }) === true,
    env: (name) => Deno.env.get(name),
    fetchImpl: fetch,
  };

  try {
    const result = await handleAsaasManageSubaccount(req, deps);
    if (!result.body.ok) console.error("[ASAAS_SUBACCOUNT_REQUEST_FAILED]", { code: result.body.error ?? "request_rejected" });
    return json(result.body, result.status);
  } catch {
    console.error("[ASAAS_SUBACCOUNT_REQUEST_FAILED]", { code: "internal_error" });
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
