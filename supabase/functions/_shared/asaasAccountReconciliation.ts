// A webhook is evidence of an event, not authority for the current account state.
import { asaasRequest, assertAsaasPhase2Environment } from "./asaasClient.ts";
import { decryptSubaccountApiKey } from "./asaasCrypto.ts";
import { parseAsaasAccountStatuses } from "./asaasSubaccount.ts";

export interface AccountObservation {
  accountId: string;
  webhookTokenHash: string;
  encryptedApiKey: string;
  revision: number;
  through: string;
}

export interface AccountReconciliationDeps {
  snapshot: (storeId: string) => Promise<AccountObservation | null>;
  finish: (storeId: string, observation: AccountObservation, statuses: NonNullable<ReturnType<typeof parseAsaasAccountStatuses>>) => Promise<Record<string, unknown> | null>;
  env: (name: string) => string | undefined;
  fetchImpl: typeof fetch;
}

export async function reconcileAsaasAccountEvents(storeId: string, deps: AccountReconciliationDeps): Promise<Record<string, unknown>> {
  let key = "";
  try {
    assertAsaasPhase2Environment(deps.env("ASAAS_ENVIRONMENT")?.trim());
    const observation = await deps.snapshot(storeId);
    if (!observation) return { state: "deferred" };
    key = await decryptSubaccountApiKey(observation.encryptedApiKey, deps.env("ASAAS_SUBACCOUNT_ENCRYPTION_KEY") ?? "");
    const raw = await asaasRequest({ environment: "sandbox", apiKey: key, path: "/myAccount/status", method: "GET", fetchImpl: deps.fetchImpl });
    const statuses = parseAsaasAccountStatuses(raw);
    if (!statuses) return { state: "deferred" };
    return await deps.finish(storeId, observation, statuses) ?? { state: "deferred" };
  } catch {
    // The accepted event stays pending; retries are reads only, never account creation.
    return { state: "deferred" };
  } finally {
    key = "";
  }
}

// Both existing entrypoints use the same adapter; no scheduled provider calls.
export function createAsaasEventReconciler(client: {
  from: (table: string) => any;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
}, env: AccountReconciliationDeps["env"], fetchImpl: typeof fetch) {
  return (storeId: string) => reconcileAsaasAccountEvents(storeId, {
    env, fetchImpl,
    snapshot: async (store) => {
      const { data: account, error } = await client.from("store_asaas_accounts")
        .select("asaas_account_id,webhook_token_hash,encrypted_api_key,status_revision,creation_attempt_token,creation_lease_expires_at")
        .eq("store_id", store).eq("environment", "sandbox").maybeSingle();
      if (error || !account || (account.creation_attempt_token && (!account.creation_lease_expires_at || Date.parse(account.creation_lease_expires_at) > Date.now())) || !account.asaas_account_id || !account.encrypted_api_key || !account.webhook_token_hash) return null;
      const { data: events, error: eventError } = await client.from("asaas_webhook_events")
        .select("received_at").eq("store_id", store).in("processing_status", ["received", "error"])
        .order("received_at", { ascending: false }).limit(1);
      const through = events?.[0]?.received_at;
      if (eventError || typeof through !== "string") return null;
      return { accountId: account.asaas_account_id, webhookTokenHash: account.webhook_token_hash,
        encryptedApiKey: account.encrypted_api_key, revision: account.status_revision, through };
    },
    finish: async (store, observation, statuses) => {
      const { data, error } = await client.rpc("reconcile_asaas_account_events", {
        p_store_id: store, p_account_id: observation.accountId, p_webhook_token_hash: observation.webhookTokenHash,
        p_expected_revision: observation.revision, p_through: observation.through,
        p_commercial_status: statuses.commercialInfo, p_bank_account_status: statuses.bankAccountInfo,
        p_document_status: statuses.documentation, p_general_approval_status: statuses.general,
      });
      if (error) return null;
      return data;
    },
  });
}