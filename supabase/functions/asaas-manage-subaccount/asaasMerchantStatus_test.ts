import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  handleAsaasManageSubaccount,
  runAsaasMerchantAccountStatus,
  type AsaasProvisioningDeps,
  type MerchantAccountRecord,
} from "./provisioning.ts";

const STORE = "323c7e89-7d28-492f-b3bc-be9f7f014bf0";
const ACCOUNT = "111ce0e7-8dd0-4348-97bd-4b25add64fb0";
const OTHER = "22222222-2222-4222-8222-222222222222";
const APPROVED = {
  commercialStatus: "APPROVED",
  bankAccountStatus: "APPROVED",
  documentStatus: "APPROVED",
  generalApprovalStatus: "APPROVED",
};

function approvedAccount(overrides: Partial<MerchantAccountRecord> = {}): MerchantAccountRecord {
  return {
    accountId: ACCOUNT,
    status: "active",
    ...APPROVED,
    lastSyncAt: "2026-11-27T21:25:31.331Z",
    lastErrorCode: null,
    ...overrides,
  };
}

function fixture(options: {
  account?: MerchantAccountRecord | null;
  actor?: string;
  environment?: string;
  databaseError?: boolean;
} = {}) {
  let accountReads = 0;
  const providerCalls: unknown[] = [];
  const deps: AsaasProvisioningDeps = {
    getUserId: async (bearer) => bearer === "valid-jwt" ? options.actor ?? STORE : null,
    canManageStore: async () => false,
    getInstitutionalEmail: async () => null,
    begin: async () => null,
    isAdmin: async () => false,
    getOnboardingAccount: async () => null,
    getMerchantAccount: async () => {
      accountReads += 1;
      if (options.databaseError) throw new Error("private database details");
      return options.account === undefined ? approvedAccount() : options.account;
    },
    reconcileEvents: async () => ({ state: "deferred" }),
    capture: async () => false,
    complete: async () => false,
    fail: async () => false,
    env: (name) => name === "ASAAS_ENVIRONMENT" ? options.environment ?? "sandbox" : undefined,
    fetchImpl: async (input, init) => {
      providerCalls.push({ input, init });
      throw new Error("provider must not be called");
    },
  };
  return { deps, providerCalls, accountReads: () => accountReads };
}

function input(storeId = STORE) {
  return { action: "get_my_account_status", storeId, environment: "sandbox" };
}

Deno.test("merchant status: approved persisted state is sanitized and performs no provider call", async () => {
  const f = fixture();
  const result = await runAsaasMerchantAccountStatus(STORE, input(), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.state, "active");
  const account = result.body.account as Record<string, unknown>;
  assertEquals(account.status, "active");
  assertEquals(account.generalApprovalStatus, "APPROVED");
  assertEquals(account.lastSyncAt, "2026-11-27T21:25:31.331Z");
  const serialized = JSON.stringify(result);
  for (const forbidden of [ACCOUNT, "accountId", "wallet", "encrypted", "fingerprint", "token", "payload", "lastErrorCode"]) {
    assert(!serialized.includes(forbidden));
  }
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("merchant status: absence of account is explicit and does not authorize creation", async () => {
  const f = fixture({ account: null });
  const result = await runAsaasMerchantAccountStatus(STORE, input(), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.state, "no_account");
  assertEquals(result.body.account, undefined);
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("merchant status: document pending, rejected and review reuse the existing mapping", async () => {
  const cases = [
    { status: "awaiting_documents", statuses: { ...APPROVED, documentStatus: "PENDING", generalApprovalStatus: "PENDING" } },
    { status: "awaiting_documents", statuses: { ...APPROVED, documentStatus: "REJECTED", generalApprovalStatus: "PENDING" } },
    { status: "under_review", statuses: { ...APPROVED, generalApprovalStatus: "AWAITING_APPROVAL" } },
    { status: "rejected", statuses: { ...APPROVED, generalApprovalStatus: "REJECTED" } },
  ] as const;
  for (const item of cases) {
    const f = fixture({ account: approvedAccount({ status: item.status, ...item.statuses }) });
    const result = await runAsaasMerchantAccountStatus(STORE, input(), f.deps);
    assertEquals(result.body.state, item.status);
    assertEquals(f.providerCalls.length, 0);
  }
});

Deno.test("merchant status: document approval alone and inconsistent active state never appear approved", async () => {
  const documentsOnly = fixture({
    account: approvedAccount({ status: "under_review", generalApprovalStatus: "PENDING" }),
  });
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(), documentsOnly.deps)).body.state, "under_review");
  const inconsistent = fixture({
    account: approvedAccount({ status: "active", documentStatus: "PENDING" }),
  });
  const result = await runAsaasMerchantAccountStatus(STORE, input(), inconsistent.deps);
  assertEquals(result.body.state, "reconciliation_required");
  assertNotActive(result);
});

function assertNotActive(result: { body: Record<string, unknown> }) {
  assert(result.body.state !== "active");
}

Deno.test("merchant status: persisted communication failure and reconciliation are distinct fail-closed states", async () => {
  const communication = fixture({ account: approvedAccount({ lastErrorCode: "ASAAS_STATUS_SYNC_FAILED" }) });
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(), communication.deps)).body.state, "communication_failed");
  const reconciliation = fixture({ account: approvedAccount({ lastErrorCode: "ASAAS_RECONCILIATION_REQUIRED" }) });
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(), reconciliation.deps)).body.state, "reconciliation_required");
  assertEquals(communication.providerCalls.length + reconciliation.providerCalls.length, 0);
});

Deno.test("merchant status: unknown state, bad binding and database failure stay unavailable or reconcilable", async () => {
  const unknown = fixture({ account: approvedAccount({ commercialStatus: "FUTURE_STATE" }) });
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(), unknown.deps)).body.state, "unavailable");
  const binding = fixture({ account: approvedAccount({ accountId: "another-account" }) });
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(), binding.deps)).body.state, "reconciliation_required");
  const database = fixture({ databaseError: true });
  const result = await runAsaasMerchantAccountStatus(STORE, input(), database.deps);
  assertEquals(result.body.state, "unavailable");
  assert(!JSON.stringify(result).includes("private database details"));
});

Deno.test("merchant status: non-owner, cross-store and Production are denied before account read", async () => {
  const nonOwner = fixture({ actor: OTHER });
  assertEquals((await runAsaasMerchantAccountStatus(OTHER, input(), nonOwner.deps)).status, 403);
  assertEquals(nonOwner.accountReads(), 0);
  const crossStore = fixture();
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(OTHER), crossStore.deps)).status, 403);
  assertEquals(crossStore.accountReads(), 0);
  const requestedProduction = fixture();
  const denied = await runAsaasMerchantAccountStatus(STORE, { ...input(), environment: "production" }, requestedProduction.deps);
  assertEquals(denied.status, 403);
  assertEquals(denied.body.error, "ASAAS_PRODUCTION_BLOCKED");
  assertEquals(requestedProduction.accountReads(), 0);
  const configuredProduction = fixture({ environment: "production" });
  assertEquals((await runAsaasMerchantAccountStatus(STORE, input(), configuredProduction.deps)).status, 403);
  assertEquals(configuredProduction.accountReads(), 0);
});

Deno.test("merchant status HTTP boundary: anonymous is rejected and valid owner JWT reaches only local state", async () => {
  const f = fixture();
  const request = () => new Request("https://backend.example.test", {
    method: "POST", headers: { Authorization: "Bearer valid-jwt" }, body: JSON.stringify(input()),
  });
  const result = await handleAsaasManageSubaccount(request(), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.state, "active");
  const anonymous = await handleAsaasManageSubaccount(new Request("https://backend.example.test", {
    method: "POST", body: JSON.stringify(input()),
  }), f.deps);
  assertEquals(anonymous.status, 401);
  assertEquals(f.providerCalls.length, 0);
});
