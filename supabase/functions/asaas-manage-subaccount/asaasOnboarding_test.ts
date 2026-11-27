import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { encryptSubaccountApiKey } from "../_shared/asaasCrypto.ts";
import { ASAAS_ACCOUNT_STATUS_EVENTS } from "../_shared/asaasSubaccount.ts";
import {
  handleAsaasManageSubaccount,
  runAsaasOnboardingInspection,
  type AsaasProvisioningDeps,
  type OnboardingAccount,
} from "./provisioning.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const STORE = "323c7e89-7d28-492f-b3bc-be9f7f014bf0";
const OTHER_STORE = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "111ce0e7-8dd0-4348-97bd-4b25add64fb0";
const KEY = "$aact_synthetic_subaccount_never_real";
const MASTER = "synthetic-master-key-with-at-least-32-characters";
const WEBHOOK_URL = "https://backend.example.test/functions/v1/asaas-webhook";
const WEBHOOK_TOKEN = "synthetic-webhook-token-that-must-never-leak";
const ONBOARDING_URL = "https://cadastro.example.test/individualized-secret-link";
const APPROVED = { commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" };

function webhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "synthetic-webhook-id",
    url: WEBHOOK_URL,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    sendType: "SEQUENTIALLY",
    authToken: WEBHOOK_TOKEN,
    events: [...ASAAS_ACCOUNT_STATUS_EVENTS],
    ...overrides,
  };
}

async function fixture(options: {
  documents?: unknown;
  statuses?: unknown;
  webhooks?: unknown;
  account?: OnboardingAccount | null;
  admin?: boolean;
  environment?: string;
  fetchImpl?: typeof fetch;
} = {}) {
  const encryptedApiKey = await encryptSubaccountApiKey(KEY, MASTER);
  const providerCalls: Array<{ url: string; init?: RequestInit }> = [];
  let accountReads = 0;
  const defaultFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    providerCalls.push({ url, init });
    const body = url.endsWith("/myAccount/documents") ? options.documents ?? { data: [] }
      : url.endsWith("/myAccount/status") ? options.statuses ?? APPROVED
      : url.endsWith("/webhooks") ? options.webhooks ?? { data: [webhook()] }
      : null;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const deps: AsaasProvisioningDeps = {
    getUserId: async (bearer) => bearer === "valid-jwt" ? ACTOR : null,
    canManageStore: async () => false,
    getInstitutionalEmail: async () => null,
    begin: async () => null,
    isAdmin: async () => options.admin ?? true,
    getOnboardingAccount: async () => {
      accountReads += 1;
      return options.account === undefined
        ? { accountId: ACCOUNT, encryptedApiKey, createdAt: "2026-11-27T20:00:00.000Z" }
        : options.account;
    },
    reconcileEvents: async () => ({ state: "deferred" }),
    capture: async () => false,
    complete: async () => false,
    fail: async () => false,
    env: (name) => ({
      ASAAS_ENVIRONMENT: options.environment ?? "sandbox",
      ASAAS_SUBACCOUNT_ENCRYPTION_KEY: MASTER,
      SUPABASE_URL: "https://backend.example.test",
    } as Record<string, string>)[name],
    fetchImpl: options.fetchImpl ?? defaultFetch,
  };
  return { deps, providerCalls, accountReads: () => accountReads, encryptedApiKey };
}

function input(storeId = STORE) {
  return { action: "inspect_onboarding", storeId, environment: "sandbox" };
}

Deno.test("onboarding: approved account performs exactly three subaccount-key GETs and validates 16 events", async () => {
  const f = await fixture();
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.state, "inspected");
  assertEquals((result.body.officialAccount as Record<string, unknown>).status, "active");
  assertEquals((result.body.webhook as Record<string, unknown>).configurationValid, true);
  assertEquals((result.body.webhook as Record<string, unknown>).eventCount, 16);
  assertEquals(f.providerCalls.map((call) => new URL(call.url).pathname), [
    "/v3/myAccount/documents", "/v3/myAccount/status", "/v3/webhooks",
  ]);
  assert(f.providerCalls.every((call) => call.init?.method === "GET"));
  assert(f.providerCalls.every((call) => new Headers(call.init?.headers).get("access_token") === KEY));
  assert(!JSON.stringify(result).includes(WEBHOOK_TOKEN));
  assert(!JSON.stringify(result).includes(KEY));
});

Deno.test("onboarding: approved documents and absence of pendencies are distinguished", async () => {
  const approved = await fixture({ documents: { data: [{ id: "doc-approved", status: "APPROVED", type: "IDENTIFICATION", documents: [] }] } });
  const approvedResult = await runAsaasOnboardingInspection(ACTOR, input(), approved.deps);
  assertEquals((approvedResult.body.documents as Record<string, unknown>).summary, {
    total: 1, notSent: 0, pending: 0, approved: 1, rejected: 0, ignored: 0, unknown: 0,
  });
  assertEquals(((approvedResult.body.documents as Record<string, unknown>).groups as Array<Record<string, unknown>>)[0].apiSubmissionAllowed, false);
  const empty = await fixture();
  const emptyResult = await runAsaasOnboardingInspection(ACTOR, input(), empty.deps);
  assertEquals((emptyResult.body.documents as Record<string, unknown>).summary, {
    total: 0, notSent: 0, pending: 0, approved: 0, rejected: 0, ignored: 0, unknown: 0,
  });
});

Deno.test("onboarding: pending group returns individualized URL only through Master response and blocks API submission", async () => {
  const f = await fixture({
    documents: {
      rejectReasons: "private rejection details",
      data: [{
        id: "doc-pending", status: "NOT_SENT", type: "IDENTIFICATION_SELFIE", title: "Documento",
        responsible: { name: "Nome Pessoal Sensível", type: ["ASAAS_ACCOUNT_OWNER"] },
        onboardingUrl: ONBOARDING_URL,
        onboardingUrlExpirationDate: "2026-12-01 00:00:00",
        documents: [],
      }],
    },
  });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  const documents = result.body.documents as { groups: Array<Record<string, unknown>>; hasRejectReasons: boolean };
  assertEquals(documents.groups[0].onboardingUrl, ONBOARDING_URL);
  assertEquals(documents.groups[0].apiSubmissionAllowed, false);
  assertEquals(documents.hasRejectReasons, true);
  const serialized = JSON.stringify(result);
  assert(!serialized.includes("Nome Pessoal Sensível"));
  assert(!serialized.includes("private rejection details"));
  assert(!serialized.includes(WEBHOOK_TOKEN));
});

Deno.test("onboarding: rejected group without URL permits the official API channel without changing account status", async () => {
  const f = await fixture({
    documents: { data: [{ id: "doc-rejected", status: "REJECTED", type: "IDENTIFICATION", documents: [{ id: "file-id", status: "REJECTED" }] }] },
    statuses: { ...APPROVED, documentation: "REJECTED", general: "PENDING" },
  });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  const documents = result.body.documents as { summary: Record<string, unknown>; groups: Array<Record<string, unknown>> };
  assertEquals(documents.summary.rejected, 1);
  assertEquals(documents.groups[0].apiSubmissionAllowed, true);
  assertEquals((result.body.officialAccount as Record<string, unknown>).status, "awaiting_documents");
});

Deno.test("onboarding: review in progress remains pending and never derives approval from documents", async () => {
  const f = await fixture({
    documents: { data: [{ id: "doc-review", status: "PENDING", type: "SOCIAL_CONTRACT", documents: [] }] },
    statuses: { ...APPROVED, documentation: "AWAITING_APPROVAL", general: "AWAITING_APPROVAL" },
  });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  assertEquals(((result.body.documents as Record<string, unknown>).summary as Record<string, unknown>).pending, 1);
  assertEquals((result.body.officialAccount as Record<string, unknown>).status, "under_review");
  assertEquals(((result.body.documents as Record<string, unknown>).groups as Array<Record<string, unknown>>)[0].apiSubmissionAllowed, false);
});

Deno.test("onboarding: CUSTOM groups and future fields/statuses are preserved without inventing a known state", async () => {
  const f = await fixture({
    documents: {
      futureRootField: { private: true },
      data: [
        { id: "custom", status: "NOT_SENT", type: "CUSTOM", futureGroupField: "ignored", documents: [] },
        { id: "future", status: "FUTURE_STATUS", type: "FUTURE_TYPE", documents: [] },
      ],
    },
  });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  const documents = result.body.documents as { summary: Record<string, unknown>; groups: Array<Record<string, unknown>> };
  assertEquals(documents.groups[0].type, "CUSTOM");
  assertEquals(documents.groups[0].typeKnown, true);
  assertEquals(documents.groups[1].status, "FUTURE_STATUS");
  assertEquals(documents.groups[1].statusKnown, false);
  assertEquals(documents.groups[1].typeKnown, false);
  assertEquals(documents.summary.unknown, 1);
  assert(!JSON.stringify(result).includes("futureRootField"));
  assert(!JSON.stringify(result).includes("futureGroupField"));
});

Deno.test("onboarding: communication failure is sanitized and stops subsequent reads", async () => {
  const failingFetch: typeof fetch = async () => { throw new Error(`network ${KEY} ${ONBOARDING_URL}`); };
  const f = await fixture({ fetchImpl: failingFetch });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  assertEquals(result.status, 502);
  assertEquals(result.body.error, "ASAAS_NETWORK_ERROR");
  assert(!JSON.stringify(result).includes(KEY));
  assert(!JSON.stringify(result).includes(ONBOARDING_URL));
});

Deno.test("onboarding: non-Master and cross-store access are denied before credential read or network", async () => {
  const nonAdmin = await fixture({ admin: false });
  assertEquals((await runAsaasOnboardingInspection(ACTOR, input(), nonAdmin.deps)).status, 403);
  assertEquals(nonAdmin.accountReads(), 0);
  assertEquals(nonAdmin.providerCalls.length, 0);
  const other = await fixture();
  assertEquals((await runAsaasOnboardingInspection(ACTOR, input(OTHER_STORE), other.deps)).status, 403);
  assertEquals(other.accountReads(), 0);
  assertEquals(other.providerCalls.length, 0);
});

Deno.test("onboarding: Production is blocked before credential read or network", async () => {
  const configured = await fixture({ environment: "production" });
  const environmentResult = await runAsaasOnboardingInspection(ACTOR, input(), configured.deps);
  assertEquals(environmentResult.body.error, "ASAAS_PRODUCTION_BLOCKED");
  assertEquals(configured.accountReads(), 0);
  assertEquals(configured.providerCalls.length, 0);
  const requested = await fixture();
  const bodyResult = await runAsaasOnboardingInspection(ACTOR, { ...input(), environment: "production" }, requested.deps);
  assertEquals(bodyResult.body.error, "ASAAS_PRODUCTION_BLOCKED");
  assertEquals(requested.accountReads(), 0);
  assertEquals(requested.providerCalls.length, 0);
});

Deno.test("onboarding: document read before 15 seconds fails closed without sleeping or calling any endpoint", async () => {
  const encryptedApiKey = await encryptSubaccountApiKey(KEY, MASTER);
  const f = await fixture({ account: { accountId: ACCOUNT, encryptedApiKey, createdAt: new Date().toISOString() } });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  assertEquals(result.status, 409);
  assertEquals(result.body.error, "ASAAS_DOCUMENTS_TOO_EARLY");
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("onboarding: an account bound to another provider ID is rejected before decryption or network", async () => {
  const encryptedApiKey = await encryptSubaccountApiKey(KEY, MASTER);
  const f = await fixture({ account: { accountId: "another-account", encryptedApiKey, createdAt: "2026-11-27T20:00:00.000Z" } });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  assertEquals(result.status, 409);
  assertEquals(result.body.error, "ASAAS_ACCOUNT_BINDING_MISMATCH");
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("onboarding: incomplete or duplicate webhook configuration is reported without exposing tokens", async () => {
  const incomplete = await fixture({ webhooks: { data: [webhook({ events: ASAAS_ACCOUNT_STATUS_EVENTS.slice(1) })] } });
  const incompleteResult = await runAsaasOnboardingInspection(ACTOR, input(), incomplete.deps);
  const inspection = incompleteResult.body.webhook as Record<string, unknown>;
  assertEquals(inspection.configurationValid, false);
  assertEquals(inspection.eventCount, 15);
  assertEquals((inspection.missingEvents as string[]).length, 1);
  const duplicate = await fixture({ webhooks: { data: [webhook(), webhook({ id: "second" })] } });
  const duplicateResult = await runAsaasOnboardingInspection(ACTOR, input(), duplicate.deps);
  assertEquals((duplicateResult.body.webhook as Record<string, unknown>).matched, false);
  assert(!JSON.stringify(incompleteResult).includes(WEBHOOK_TOKEN));
  assert(!JSON.stringify(duplicateResult).includes(WEBHOOK_TOKEN));
});

Deno.test("onboarding: a read response that omits the webhook token remains valid and exposes no token field", async () => {
  const withoutToken = webhook({ authToken: undefined });
  const f = await fixture({ webhooks: { data: [withoutToken] } });
  const result = await runAsaasOnboardingInspection(ACTOR, input(), f.deps);
  const inspection = result.body.webhook as Record<string, unknown>;
  assertEquals(inspection.configurationValid, true);
  assert(!("hasAuthToken" in inspection));
  assert(!JSON.stringify(result).includes(WEBHOOK_TOKEN));
});

Deno.test("onboarding HTTP boundary: valid Master JWT reaches inspection and anonymous stays rejected", async () => {
  const f = await fixture();
  const request = () => new Request("https://backend.example.test", {
    method: "POST", headers: { Authorization: "Bearer valid-jwt" }, body: JSON.stringify(input()),
  });
  const result = await handleAsaasManageSubaccount(request(), f.deps);
  assertEquals(result.status, 200);
  assertStringIncludes(String(f.providerCalls[0].url), "/myAccount/documents");
  const anonymous = await handleAsaasManageSubaccount(new Request("https://backend.example.test", { method: "POST", body: JSON.stringify(input()) }), f.deps);
  assertEquals(anonymous.status, 401);
});
