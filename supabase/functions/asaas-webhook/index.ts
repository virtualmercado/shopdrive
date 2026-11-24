import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { handleAsaasWebhook, type AsaasWebhookDeps } from "./webhook.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ received: false, error: "webhook_unavailable" }, 503);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const deps: AsaasWebhookDeps = {
    findAccountByTokenHash: async (hash) => {
      const { data, error } = await admin.from("store_asaas_accounts")
        .select("store_id,webhook_token_hash")
        .eq("environment", "sandbox").eq("webhook_token_hash", hash).maybeSingle();
      if (error) throw new Error("ASAAS_WEBHOOK_LOOKUP_FAILED");
      if (!data || typeof data.store_id !== "string" || typeof data.webhook_token_hash !== "string") return null;
      return { storeId: data.store_id, webhookTokenHash: data.webhook_token_hash };
    },
    apply: async (input) => {
      const { data, error } = await admin.rpc("apply_asaas_account_webhook", {
        p_store_id: input.storeId,
        p_webhook_token_hash: input.webhookTokenHash,
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_account_id: input.accountId,
        p_payload: input.payload,
        p_commercial_status: input.statuses?.commercialInfo ?? null,
        p_bank_account_status: input.statuses?.bankAccountInfo ?? null,
        p_document_status: input.statuses?.documentation ?? null,
        p_general_approval_status: input.statuses?.general ?? null,
      });
      if (error) throw new Error("ASAAS_WEBHOOK_APPLY_FAILED");
      return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    },
  };

  try {
    const result = await handleAsaasWebhook(req, deps);
    return json(result.body, result.status);
  } catch {
    console.error("[ASAAS_ACCOUNT_WEBHOOK_FAILED]");
    return json({ received: false, error: "processing_unavailable" }, 503);
  }
});
