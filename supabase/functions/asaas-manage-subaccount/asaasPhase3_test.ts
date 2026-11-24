import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { AsaasError } from "../_shared/asaasClient.ts";
import { decryptSubaccountApiKey } from "../_shared/asaasCrypto.ts";
import { ASAAS_ACCOUNT_STATUS_EVENTS, deriveAsaasAccountStatus, normalizeAndValidateSubaccount } from "../_shared/asaasSubaccount.ts";
import {
  handleAsaasManageSubaccount,
  runAsaasSubaccountCreate,
  type AsaasProvisioningDeps,
  type CaptureInput,
  type CompleteInput,
  type FailInput,
} from "./provisioning.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const STORE = "22222222-2222-4222-8222-222222222222";
const STORE_B = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";
const PARENT_KEY = "$aact_synthetic_parent_never_real";
const SUBACCOUNT_KEY = "$aact_synthetic_subaccount_never_real";
const MASTER = "synthetic-master-key-with-at-least-32-characters";
const ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";
const WALLET_ID = "66666666-6666-4666-8666-666666666666";
const PF = {
  name: "Pessoa Fictícia Sandbox",
  email: "PESSOA.SANDBOX@EXAMPLE.TEST",
  cpfCnpj: "529.982.247-25",
  mobilePhone: "+55 (11) 98765-4321",
  incomeValue: 2500,
  address: "Rua Fictícia",
  addressNumber: "100",
  province: "Bairro Teste",
  postalCode: "01310-100",
  birthDate: "1990-01-02",
};
const PJ = {
  name: "Empresa Fictícia Sandbox",
  email: "empresa.sandbox@example.test",
  cpfCnpj: "11.222.333/0001-81",
  mobilePhone: "11987654321",
  incomeValue: 25000,
  address: "Avenida Fictícia",
  addressNumber: "200",
  province: "Centro Teste",
  postalCode: "01310100",
  companyType: "LIMITED",
  taxRegime: "NATIONAL_SIMPLE",
};
const APPROVED = { commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" };

function input(data: Record<string, unknown> = PF, storeId = STORE) {
  return { action: "create", storeId, data };
}

function fixture(overrides: Partial<AsaasProvisioningDeps> = {}) {
  const providerCalls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];
  const captures: CaptureInput[] = [];
  const completions: CompleteInput[] = [];
  const failures: FailInput[] = [];
  const managed = new Set([STORE, STORE_B]);
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    providerCalls.push({ url, init, body });
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ id: ACCOUNT_ID, walletId: WALLET_ID, apiKey: SUBACCOUNT_KEY, accountNumber: { accountNumber: "000123" } }), { status: 200 });
    }
    return new Response(JSON.stringify(APPROVED), { status: 200 });
  };
  const deps: AsaasProvisioningDeps = {
    getUserId: async (bearer) => bearer === "valid-jwt" ? ACTOR : null,
    canManageStore: async (actor, storeId) => actor === ACTOR && managed.has(storeId),
    getInstitutionalEmail: async () => "institucional@shopdrive.example.test",
    begin: async () => ({ state: "claimed", attemptToken: ATTEMPT }),
    capture: async (value) => { captures.push(value); return true; },
    complete: async (value) => { completions.push(value); return true; },
    fail: async (value) => { failures.push(value); return true; },
    env: (name) => ({
      ASAAS_ENVIRONMENT: "sandbox",
      ASAAS_SANDBOX_API_KEY: PARENT_KEY,
      ASAAS_SUBACCOUNT_ENCRYPTION_KEY: MASTER,
      SUPABASE_URL: "https://backend.example.test",
    } as Record<string, string>)[name],
    fetchImpl,
    ...overrides,
  };
  return { deps, providerCalls, captures, completions, failures };
}

Deno.test("validation: PF normalizes contacts and requires a real birth date", () => {
  const result = normalizeAndValidateSubaccount(PF);
  assert(result.ok);
  assertEquals(result.data.email, "pessoa.sandbox@example.test");
  assertEquals(result.data.cpfCnpj, "52998224725");
  assertEquals(result.data.mobilePhone, "11987654321");
  assertEquals(result.data.postalCode, "01310100");
  assert(!normalizeAndValidateSubaccount({ ...PF, birthDate: undefined }).ok);
  assert(!normalizeAndValidateSubaccount({ ...PF, cpfCnpj: "11111111111" }).ok);
});

Deno.test("validation: PJ requires official companyType and accepts optional taxRegime", () => {
  const result = normalizeAndValidateSubaccount(PJ);
  assert(result.ok);
  assertEquals(result.data.companyType, "LIMITED");
  assertEquals(result.data.taxRegime, "NATIONAL_SIMPLE");
  assert(!normalizeAndValidateSubaccount({ ...PJ, companyType: undefined }).ok);
  assert(!normalizeAndValidateSubaccount({ ...PJ, companyType: "OTHER" }).ok);
  assert(!normalizeAndValidateSubaccount({ ...PJ, taxRegime: "INVALID" }).ok);
});

Deno.test("authorization: another store is denied before reservation or provider network", async () => {
  const other = "99999999-9999-4999-8999-999999999999";
  let reservations = 0;
  const f = fixture({ begin: async () => { reservations += 1; return { state: "claimed", attemptToken: ATTEMPT }; } });
  const result = await runAsaasSubaccountCreate(ACTOR, input(PF, other), f.deps);
  assertEquals(result.status, 403);
  assertEquals(reservations, 0);
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("multistore: two independently authorized stores have independent reservations", async () => {
  const stores: string[] = [];
  const f = fixture({ begin: async (_actor, storeId) => { stores.push(storeId); return { state: "creation_in_progress" }; } });
  assertEquals((await runAsaasSubaccountCreate(ACTOR, input(PF, STORE), f.deps)).status, 202);
  assertEquals((await runAsaasSubaccountCreate(ACTOR, input(PJ, STORE_B), f.deps)).status, 202);
  assertEquals(stores, [STORE, STORE_B]);
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("concurrency: double click produces one POST and one creation_in_progress", async () => {
  let reservations = 0;
  const f = fixture({
    begin: async () => {
      reservations += 1;
      const reservation = reservations;
      await new Promise((resolve) => setTimeout(resolve, 2));
      return reservation === 1 ? { state: "claimed", attemptToken: ATTEMPT } : { state: "creation_in_progress" };
    },
  });
  const results = await Promise.all([
    runAsaasSubaccountCreate(ACTOR, input(), f.deps),
    runAsaasSubaccountCreate(ACTOR, input(), f.deps),
  ]);
  assertEquals(results.map((item) => item.status).sort(), [201, 202]);
  assertEquals(f.providerCalls.filter((call) => call.init?.method === "POST").length, 1);
});

Deno.test("existing account: sanitized record returns without another POST or secret fields", async () => {
  const f = fixture({
    begin: async () => ({
      state: "existing",
      account: {
        ...localAccountForTest(), walletId: WALLET_ID, encryptedApiKey: "encrypted-secret",
        apiKeyFingerprint: "fingerprint", webhookTokenHash: "hash",
      },
    }),
  });
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(result.status, 200);
  assertEquals(result.body.state, "existing");
  assert(!JSON.stringify(result).includes("encrypted"));
  assert(!JSON.stringify(result).includes("hash"));
  assert(!JSON.stringify(result).includes(WALLET_ID));
  assertEquals(f.providerCalls.length, 0);
});

function localAccountForTest() {
  return { storeId: STORE, environment: "sandbox", status: "active", accountId: ACCOUNT_ID };
}

Deno.test("creation: official Sandbox POST, 16 account events and subaccount-key status sync", async () => {
  const f = fixture();
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(result.status, 201);
  assertEquals(f.providerCalls.length, 2);
  const post = f.providerCalls[0];
  assertEquals(post.url, "https://api-sandbox.asaas.com/v3/accounts");
  assertEquals(new Headers(post.init?.headers).get("access_token"), PARENT_KEY);
  assertEquals(post.body?.cpfCnpj, "52998224725");
  const webhooks = post.body?.webhooks as Array<Record<string, unknown>>;
  assertEquals(webhooks.length, 1);
  assertEquals(webhooks[0].apiVersion, 3);
  assertEquals(webhooks[0].sendType, "SEQUENTIALLY");
  assertEquals(webhooks[0].events, ASAAS_ACCOUNT_STATUS_EVENTS);
  assertEquals((webhooks[0].events as string[]).length, 16);
  assert(!(webhooks[0].events as string[]).some((event) => event.startsWith("PAYMENT_")));
  assertEquals(f.providerCalls[1].url, "https://api-sandbox.asaas.com/v3/myAccount/status");
  assertEquals(new Headers(f.providerCalls[1].init?.headers).get("access_token"), SUBACCOUNT_KEY);
});

Deno.test("credential capture: encrypted before persistence and raw keys/tokens never returned", async () => {
  const f = fixture();
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(f.captures.length, 1);
  assert(!f.captures[0].encryptedApiKey.includes(SUBACCOUNT_KEY));
  assertEquals(await decryptSubaccountApiKey(f.captures[0].encryptedApiKey, MASTER), SUBACCOUNT_KEY);
  assertStringIncludes(f.captures[0].apiKeyFingerprint, "sha256:");
  const serialized = JSON.stringify(result);
  assert(!serialized.includes(SUBACCOUNT_KEY));
  assert(!serialized.includes(PARENT_KEY));
  const webhookToken = (f.providerCalls[0].body?.webhooks as Array<Record<string, unknown>>)[0].authToken;
  assert(typeof webhookToken === "string" && webhookToken.length >= 32);
  assert(!serialized.includes(webhookToken));
});

Deno.test("status mapping: approved, rejected, pending documents and review", () => {
  assertEquals(deriveAsaasAccountStatus(APPROVED), "active");
  assertEquals(deriveAsaasAccountStatus({ ...APPROVED, general: "REJECTED" }), "rejected");
  assertEquals(deriveAsaasAccountStatus({ ...APPROVED, general: "PENDING", documentation: "PENDING" }), "awaiting_documents");
  assertEquals(deriveAsaasAccountStatus({ ...APPROVED, general: "AWAITING_APPROVAL" }), "under_review");
});

Deno.test("timeout reconciliation: exactly one remote match records lost API key without another POST", async () => {
  let calls = 0;
  const f = fixture({
    fetchImpl: async (input, init) => {
      calls += 1;
      if (init?.method === "POST") throw new AsaasError("ASAAS_TIMEOUT");
      assertStringIncludes(String(input), "/accounts?cpfCnpj=52998224725");
      return new Response(JSON.stringify({ data: [{ id: ACCOUNT_ID, walletId: WALLET_ID, cpfCnpj: PF.cpfCnpj, email: PF.email, name: PF.name }] }), { status: 200 });
    },
  });
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(calls, 2);
  assertEquals(f.failures[0].errorCode, "ASAAS_SUBACCOUNT_CREATED_API_KEY_NOT_CAPTURED");
  assertEquals(f.failures[0].accountId, ACCOUNT_ID);
  assertEquals(result.body.state, "error");
  assert(!JSON.stringify(result).includes(SUBACCOUNT_KEY));
});

Deno.test("timeout reconciliation: zero matches is recoverable and multiple matches fail closed", async () => {
  for (const [matches, code] of [
    [[], "ASAAS_SUBACCOUNT_NOT_FOUND"],
    [[{ id: ACCOUNT_ID, cpfCnpj: PF.cpfCnpj }, { id: "other", cpfCnpj: PF.cpfCnpj }], "ASAAS_SUBACCOUNT_RECONCILIATION_AMBIGUOUS"],
  ] as const) {
    let posts = 0;
    const f = fixture({
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") { posts += 1; throw new AsaasError("ASAAS_NETWORK_ERROR"); }
        return new Response(JSON.stringify({ data: matches }), { status: 200 });
      },
    });
    await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
    assertEquals(posts, 1);
    assertEquals(f.failures[0].errorCode, code);
    assertEquals(f.failures[0].accountId ?? null, null);
  }
});

Deno.test("timeout with unavailable reconciliation never repeats POST", async () => {
  let posts = 0;
  const f = fixture({
    fetchImpl: async (_input, init) => {
      if (init?.method === "POST") posts += 1;
      throw new AsaasError("ASAAS_NETWORK_ERROR");
    },
  });
  await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(posts, 1);
  assertEquals(f.failures[0].errorCode, "ASAAS_RECONCILIATION_REQUIRED");
});

Deno.test("definitive provider rejection has no reconciliation or retry", async () => {
  let calls = 0;
  const f = fixture({ fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ errors: [{ description: SUBACCOUNT_KEY }] }), { status: 400 }); } });
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(calls, 1);
  assertEquals(f.failures[0].errorCode, "ASAAS_CREATE_REJECTED");
  assert(!JSON.stringify(result).includes(SUBACCOUNT_KEY));
});

Deno.test("status sync failure retains encrypted credentials and never exposes keys", async () => {
  const f = fixture({
    fetchImpl: async (_input, init) => init?.method === "POST"
      ? new Response(JSON.stringify({ id: ACCOUNT_ID, walletId: WALLET_ID, apiKey: SUBACCOUNT_KEY }), { status: 200 })
      : new Response("{}", { status: 500 }),
  });
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(result.status, 201);
  assertEquals(f.captures.length, 1);
  assertEquals(f.completions[0].errorCode, "ASAAS_STATUS_SYNC_FAILED");
  assert(!JSON.stringify(result).includes(SUBACCOUNT_KEY));
});

Deno.test("missing trusted institutional email stops before reservation and provider POST", async () => {
  let reservations = 0;
  const f = fixture({
    getInstitutionalEmail: async () => null,
    begin: async () => { reservations += 1; return { state: "claimed", attemptToken: ATTEMPT }; },
  });
  const result = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  assertEquals(result.body.error, "ASAAS_INSTITUTIONAL_EMAIL_NOT_CONFIGURED");
  assertEquals(reservations, 0);
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("Production is blocked before reservation or network even with a Production secret present", async () => {
  let reservations = 0;
  const f = fixture({
    env: (name) => name === "ASAAS_ENVIRONMENT" ? "production" : name === "ASAAS_PRODUCTION_API_KEY" ? "forbidden" :
      name === "ASAAS_SANDBOX_API_KEY" ? PARENT_KEY : name === "ASAAS_SUBACCOUNT_ENCRYPTION_KEY" ? MASTER : "https://backend.example.test",
    begin: async () => { reservations += 1; return { state: "claimed", attemptToken: ATTEMPT }; },
  });
  const environmentResult = await runAsaasSubaccountCreate(ACTOR, input(), f.deps);
  const bodyResult = await runAsaasSubaccountCreate(ACTOR, { ...input(), environment: "production" }, f.deps);
  assertEquals(environmentResult.body.error, "ASAAS_PRODUCTION_BLOCKED");
  assertEquals(bodyResult.body.error, "ASAAS_PRODUCTION_BLOCKED");
  assertEquals(reservations, 0);
  assertEquals(f.providerCalls.length, 0);
});

Deno.test("HTTP boundary: anonymous and malformed requests cannot start provisioning", async () => {
  const f = fixture();
  const anonymous = await handleAsaasManageSubaccount(new Request("https://backend.example.test", { method: "POST", body: JSON.stringify(input()) }), f.deps);
  assertEquals(anonymous.status, 401);
  const malformed = await handleAsaasManageSubaccount(new Request("https://backend.example.test", {
    method: "POST", headers: { Authorization: "Bearer valid-jwt" }, body: "not-json",
  }), f.deps);
  assertEquals(malformed.status, 400);
  assertEquals(f.providerCalls.length, 0);
});
