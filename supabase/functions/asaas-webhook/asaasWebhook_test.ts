import { assert, assertEquals } from "jsr:@std/assert@1";
import { hashWebhookAuthToken } from "../_shared/asaasCrypto.ts";
import { handleAsaasWebhook, parseAccountWebhook, type ApplyWebhookInput, type AsaasWebhookDeps } from "./webhook.ts";

const TOKEN = "synthetic-webhook-token-with-32-plus-characters";
const OTHER_TOKEN = "another-synthetic-token-with-32-plus-characters";
const STORE = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const STATES = { commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" };

async function fixture(result: Record<string, unknown> = { state: "processed", status: "active" }) {
  const tokenHash = await hashWebhookAuthToken(TOKEN);
  const applied: ApplyWebhookInput[] = [];
  const deps: AsaasWebhookDeps = {
    reconcileEvents: async () => ({ state: "processed" }),
    findAccountByTokenHash: async (hash) => hash === tokenHash ? { storeId: STORE, webhookTokenHash: tokenHash } : null,
    apply: async (input) => { applied.push(input); return result; },
  };
  return { deps, applied };
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_synthetic_001&123",
    event: "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    dateCreated: "2026-11-24 20:00:00",
    account: { id: ACCOUNT, ownerId: null },
    accountStatus: { id: "status-id-not-retained", ...STATES },
    apiKey: "must-not-be-stored",
    cpfCnpj: "00000000000",
    address: "must-not-be-stored",
    ...overrides,
  };
}

function request(body: unknown, token = TOKEN) {
  return new Request("https://backend.example.test/functions/v1/asaas-webhook", {
    method: "POST", headers: { "asaas-access-token": token, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

Deno.test("webhook: invalid token is rejected before parsing or persistence", async () => {
  const f = await fixture();
  const result = await handleAsaasWebhook(request(event(), OTHER_TOKEN), f.deps);
  assertEquals(result.status, 401);
  assertEquals(f.applied.length, 0);
});

Deno.test("webhook: duplicate event returns 200 without a second application", async () => {
  const f = await fixture({ state: "duplicate" });
  const result = await handleAsaasWebhook(request(event()), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.duplicate, true);
  assertEquals(f.applied.length, 1);
});

Deno.test("webhook: early event during pending_creation is persisted and deferred", async () => {
  const f = await fixture({ state: "deferred" });
  const result = await handleAsaasWebhook(request(event({ accountStatus: { ...STATES, general: "PENDING" } })), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.deferred, true);
  assertEquals(f.applied[0].statuses?.general, "PENDING");
});

Deno.test("webhook: APPROVED and REJECTED statuses reach the atomic application", async () => {
  for (const general of ["APPROVED", "REJECTED"]) {
    const f = await fixture({ state: "processed", status: general === "APPROVED" ? "active" : "rejected" });
    const result = await handleAsaasWebhook(request(event({ event: `ACCOUNT_STATUS_GENERAL_APPROVAL_${general}`, accountStatus: { ...STATES, general } })), f.deps);
    assertEquals(result.status, 200);
    assertEquals(f.applied[0].statuses?.general, general);
  }
});

Deno.test("webhook: sanitized payload excludes keys, documents, addresses and unknown fields", async () => {
  const f = await fixture();
  const result = await handleAsaasWebhook(request(event()), f.deps);
  assertEquals(result.status, 200);
  const payload = f.applied[0].payload;
  assertEquals(payload.accountId, ACCOUNT);
  assert(!JSON.stringify(payload).includes("must-not-be-stored"));
  assert(!JSON.stringify(payload).includes("00000000000"));
  assert(!JSON.stringify(payload).includes("status-id-not-retained"));
  assert(!JSON.stringify(payload).includes(TOKEN));
});

Deno.test("webhook: future fields and future account event names do not break parsing", async () => {
  const parsed = parseAccountWebhook(event({
    event: "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED",
    futureObject: { arbitrary: [1, 2, 3] },
    accountStatus: { ...STATES, commercialInfo: "FUTURE_STATE", futureField: true },
  }));
  assert(parsed);
  assertEquals(parsed.statuses?.commercialInfo, "FUTURE_STATE");
  const f = await fixture({ state: "ignored" });
  const result = await handleAsaasWebhook(request(event({ event: "PAYMENT_CREATED", accountStatus: undefined })), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.ignored, true);
});

Deno.test("webhook: account-status event requires accountStatus and account.id", async () => {
  const f = await fixture();
  for (const body of [event({ accountStatus: undefined }), event({ account: {} })]) {
    const result = await handleAsaasWebhook(request(body), f.deps);
    assertEquals(result.status, 400);
  }
  assertEquals(f.applied.length, 0);
});

Deno.test("webhook: only POST is accepted", async () => {
  const f = await fixture();
  const result = await handleAsaasWebhook(new Request("https://backend.example.test", { method: "GET" }), f.deps);
  assertEquals(result.status, 405);
  assertEquals(f.applied.length, 0);
});

Deno.test("Webhook persistence failure: never acknowledge or query provider", async () => {
  const f = await fixture(); let reads = 0;
  f.deps.apply = async () => { throw new Error("synthetic database failure"); };
  f.deps.reconcileEvents = async () => { reads++; return { state: "processed" }; };
  assertEquals((await handleAsaasWebhook(request(event()), f.deps)).status, 503);
  assertEquals(reads, 0);
});
Deno.test("Unfinished duplicate: persistence is retried and status is reconciled", async () => {
  const f = await fixture({ state: "reconciliation_required" }); let reads = 0;
  f.deps.reconcileEvents = async () => { reads++; return { state: "processed" }; };
  const result = await handleAsaasWebhook(request(event()), f.deps);
  assertEquals(result.status, 200); assertEquals(result.body.processed, true); assertEquals(reads, 1);
});
Deno.test("Provider outage after persistence: safely deferred and recoverable", async () => {
  const f = await fixture({ state: "reconciliation_required" });
  f.deps.reconcileEvents = async () => { throw new Error("synthetic provider outage"); };
  const result = await handleAsaasWebhook(request(event()), f.deps);
  assertEquals(result.status, 200); assertEquals(result.body.deferred, true); assertEquals(result.body.processed, false);
});
