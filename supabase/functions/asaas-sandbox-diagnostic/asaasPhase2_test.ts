import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import {
  AsaasError,
  asaasRequest,
  assertAsaasPhase2Environment,
  assertAsaasUrlMatchesEnvironment,
  buildAsaasUrl,
  redactAsaasText,
  resolveAsaasBaseUrl,
} from "../_shared/asaasClient.ts";
import {
  decryptSubaccountApiKey,
  encryptSubaccountApiKey,
  fingerprintSubaccountApiKey,
  generateWebhookAuthToken,
  hashWebhookAuthToken,
  verifyWebhookAuthToken,
} from "../_shared/asaasCrypto.ts";
import { handleAsaasSandboxDiagnostic, runAsaasSandboxDiagnostic, type AsaasDiagnosticDeps } from "./diagnostic.ts";

const MASTER = "synthetic-master-key-with-at-least-32-random-characters";
const OTHER_MASTER = "different-master-key-with-at-least-32-random-characters";
const API_KEY = "$aact_synthetic_sandbox_key_never_real";
const WEBHOOK_TOKEN = "synthetic-webhook-token-never-real";

function mutateSegment(payload: string, index: number): string {
  const parts = payload.split(".");
  parts[index] = `${parts[index][0] === "A" ? "B" : "A"}${parts[index].slice(1)}`;
  return parts.join(".");
}

Deno.test("crypto: encrypt/decrypt restores the exact API key", async () => {
  const encrypted = await encryptSubaccountApiKey(API_KEY, MASTER);
  assertStringIncludes(encrypted, "v1.");
  assertEquals(await decryptSubaccountApiKey(encrypted, MASTER), API_KEY);
  assert(!encrypted.includes(API_KEY));
});

Deno.test("crypto: random IV produces a different ciphertext", async () => {
  const left = await encryptSubaccountApiKey(API_KEY, MASTER);
  const right = await encryptSubaccountApiKey(API_KEY, MASTER);
  assert(left !== right);
  assert(left.split(".")[1] !== right.split(".")[1]);
  assert(left.split(".")[2] !== right.split(".")[2]);
});

Deno.test("crypto: ciphertext tampering fails without exposing the key", async () => {
  const encrypted = await encryptSubaccountApiKey(API_KEY, MASTER);
  const error = await assertRejects(() => decryptSubaccountApiKey(mutateSegment(encrypted, 2), MASTER));
  assert(!String(error).includes(API_KEY));
});

Deno.test("crypto: auth tag tampering fails", async () => {
  const encrypted = await encryptSubaccountApiKey(API_KEY, MASTER);
  await assertRejects(() => decryptSubaccountApiKey(mutateSegment(encrypted, 3), MASTER), Error, "ASAAS_CRYPTO_INTEGRITY_ERROR");
});

Deno.test("crypto: wrong master key fails", async () => {
  const encrypted = await encryptSubaccountApiKey(API_KEY, MASTER);
  await assertRejects(() => decryptSubaccountApiKey(encrypted, OTHER_MASTER), Error, "ASAAS_CRYPTO_INTEGRITY_ERROR");
});

Deno.test("crypto: malformed payloads fail closed", async () => {
  for (const payload of ["", "v1.invalid", "v2.aa.bb.cc", "v1.@@.bb.cc"]) {
    await assertRejects(() => decryptSubaccountApiKey(payload, MASTER));
  }
});

Deno.test("fingerprint: deterministic SHA-256 without reversible fragments", async () => {
  const fingerprint = await fingerprintSubaccountApiKey(API_KEY);
  assertEquals(fingerprint, await fingerprintSubaccountApiKey(API_KEY));
  assert(/^sha256:[a-f0-9]{64}$/.test(fingerprint));
  assert(!fingerprint.includes(API_KEY));
});

Deno.test("webhook: 256-bit random token, SHA-256 hash and timing-resistant verification", async () => {
  const token = generateWebhookAuthToken();
  const other = generateWebhookAuthToken();
  assert(token !== other);
  const hash = await hashWebhookAuthToken(token);
  assert(/^[a-f0-9]{64}$/.test(hash));
  assert(!hash.includes(token));
  assertEquals(await verifyWebhookAuthToken(token, hash), true);
  assertEquals(await verifyWebhookAuthToken(other, hash), false);
  assertEquals(await verifyWebhookAuthToken(token, "invalid"), false);
});

Deno.test("environment: both official URLs resolve explicitly with no fallback", () => {
  assertEquals(resolveAsaasBaseUrl("sandbox"), "https://api-sandbox.asaas.com/v3");
  assertEquals(resolveAsaasBaseUrl("production"), "https://api.asaas.com/v3");
  for (const invalid of [undefined, "", "SANDBOX", "test", null]) {
    try {
      resolveAsaasBaseUrl(invalid);
      throw new Error("accepted_invalid_environment");
    } catch (error) {
      assert(error instanceof AsaasError && error.code === "ASAAS_INVALID_ENVIRONMENT");
    }
  }
});

Deno.test("environment: Phase 2 allows Sandbox only and blocks Production", () => {
  assertAsaasPhase2Environment("sandbox");
  for (const environment of ["production", undefined, "test"]) {
    try {
      assertAsaasPhase2Environment(environment);
      throw new Error("accepted_forbidden_environment");
    } catch (error) {
      assert(error instanceof AsaasError);
    }
  }
});

Deno.test("environment: mixed environment URLs are rejected", () => {
  assertAsaasUrlMatchesEnvironment("sandbox", "https://api-sandbox.asaas.com/v3/myAccount/status");
  assertAsaasUrlMatchesEnvironment("production", "https://api.asaas.com/v3/myAccount/status");
  for (const [environment, url] of [
    ["sandbox", "https://api.asaas.com/v3/myAccount/status"],
    ["production", "https://api-sandbox.asaas.com/v3/myAccount/status"],
    ["sandbox", "https://api-sandbox.asaas.com.evil.test/v3/myAccount/status"],
  ] as const) {
    try {
      assertAsaasUrlMatchesEnvironment(environment, url);
      throw new Error("accepted_mixed_environment");
    } catch (error) {
      assert(error instanceof AsaasError);
    }
  }
});

Deno.test("client: absolute URLs and traversal cannot override the fixed base", () => {
  for (const path of ["https://api.asaas.com/v3/myAccount/status", "//api.asaas.com/v3", "/../v3/myAccount/status"]) {
    try {
      buildAsaasUrl("sandbox", path);
      throw new Error("accepted_unsafe_path");
    } catch (error) {
      assert(error instanceof AsaasError);
    }
  }
});

Deno.test("client: Sandbox GET uses official auth headers exactly once", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls += 1;
    assertEquals(String(input), "https://api-sandbox.asaas.com/v3/myAccount/status");
    assertEquals(init?.method, "GET");
    const headers = new Headers(init?.headers);
    assertEquals(headers.get("access_token"), API_KEY);
    assertEquals(headers.get("User-Agent"), "ShopDrive-Asaas-BaaS/1.0");
    assertEquals(headers.get("Authorization"), null);
    return new Response(JSON.stringify({ general: "APPROVED" }), { status: 200 });
  };
  await asaasRequest({ environment: "sandbox", apiKey: API_KEY, path: "/myAccount/status", fetchImpl });
  assertEquals(calls, 1);
});

Deno.test("client: Production is blocked before any network call", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response("{}");
  };
  await assertRejects(() => asaasRequest({ environment: "production", apiKey: API_KEY, path: "/myAccount/status", fetchImpl }), AsaasError, "ASAAS_PRODUCTION_BLOCKED");
  assertEquals(calls, 0);
});

Deno.test("client: mutable POST is never retried after an ambiguous network failure", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    throw new Error(`untrusted ${API_KEY}`);
  };
  const error = await assertRejects(() => asaasRequest({
    environment: "sandbox",
    apiKey: API_KEY,
    path: "/payments",
    method: "POST",
    body: { value: 10 },
    idempotencyKey: "synthetic-idempotency-key",
    fetchImpl,
  }), AsaasError, "ASAAS_NETWORK_ERROR");
  assertEquals(calls, 1);
  assert(!String(error).includes(API_KEY));
});

Deno.test("client: timeout is classified and never retried", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = (_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
  };
  await assertRejects(() => asaasRequest({ environment: "sandbox", apiKey: API_KEY, path: "/myAccount/status", timeoutMs: 5, fetchImpl }), AsaasError, "ASAAS_TIMEOUT");
  assertEquals(calls, 1);
});

Deno.test("client: malformed success response and HTTP failures are sanitized", async () => {
  await assertRejects(() => asaasRequest({
    environment: "sandbox",
    apiKey: API_KEY,
    path: "/myAccount/status",
    fetchImpl: async () => new Response("not-json", { status: 200 }),
  }), AsaasError, "ASAAS_INVALID_RESPONSE");
  const error = await assertRejects(() => asaasRequest({
    environment: "sandbox",
    apiKey: API_KEY,
    path: "/myAccount/status",
    fetchImpl: async () => new Response(JSON.stringify({ message: API_KEY }), { status: 401 }),
  }), AsaasError, "ASAAS_AUTH_ERROR");
  assert(!String(error).includes(API_KEY));
});

Deno.test("redaction: API key, Authorization and webhook token never survive", () => {
  const output = redactAsaasText(
    `key=${API_KEY} Authorization: Bearer authorization-secret access_token=header-secret webhook_token=${WEBHOOK_TOKEN}`,
    [API_KEY, WEBHOOK_TOKEN],
  );
  for (const secret of [API_KEY, WEBHOOK_TOKEN, "authorization-secret", "header-secret"]) assert(!output.includes(secret));
  assert(!output.toLowerCase().includes("bearer authorization-secret"));
});

function diagnosticDeps(overrides: Partial<AsaasDiagnosticDeps> = {}, response = new Response(JSON.stringify({ general: "APPROVED" }), { status: 200 })) {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return response.clone();
  };
  const deps: AsaasDiagnosticDeps = {
    getUserId: async () => "synthetic-admin-id",
    isAdmin: async () => true,
    env: (name) => ({ ASAAS_ENVIRONMENT: "sandbox", ASAAS_SANDBOX_API_KEY: API_KEY } as Record<string, string>)[name],
    fetchImpl,
    ...overrides,
  };
  return { deps, calls };
}

Deno.test("diagnostic: anonymous and non-admin callers cannot reach Asaas", async () => {
  const anonymous = diagnosticDeps();
  assertEquals((await runAsaasSandboxDiagnostic(null, anonymous.deps)).status, 401);
  assertEquals(anonymous.calls.length, 0);
  const merchant = diagnosticDeps({ isAdmin: async () => false });
  assertEquals((await runAsaasSandboxDiagnostic("jwt", merchant.deps)).status, 403);
  assertEquals(merchant.calls.length, 0);
});

Deno.test("diagnostic: missing/invalid environment and missing credential fail before network", async () => {
  for (const environment of [undefined, "", "test", "production"]) {
    const fixture = diagnosticDeps({ env: (name) => name === "ASAAS_ENVIRONMENT" ? environment : API_KEY });
    const result = await runAsaasSandboxDiagnostic("jwt", fixture.deps);
    assertEquals(result.body.ok, false);
    assertEquals(fixture.calls.length, 0);
  }
  const missingKey = diagnosticDeps({ env: (name) => name === "ASAAS_ENVIRONMENT" ? "sandbox" : undefined });
  assertEquals((await runAsaasSandboxDiagnostic("jwt", missingKey.deps)).body.error, "ASAAS_CREDENTIAL_NOT_CONFIGURED");
  assertEquals(missingKey.calls.length, 0);
});

Deno.test("diagnostic: admin performs one fixed Sandbox GET and receives no account payload", async () => {
  const fixture = diagnosticDeps({}, new Response(JSON.stringify({ general: "APPROVED", cpfCnpj: "00000000000", apiKey: API_KEY }), { status: 200 }));
  const result = await runAsaasSandboxDiagnostic("jwt", fixture.deps);
  assertEquals(result, { status: 200, body: { ok: true, environment: "sandbox", authenticated: true } });
  assertEquals(fixture.calls.length, 1);
  assertEquals(String(fixture.calls[0].input), "https://api-sandbox.asaas.com/v3/myAccount/status");
  assertEquals(fixture.calls[0].init?.method, "GET");
  assert(!JSON.stringify(result).includes(API_KEY));
  assert(!JSON.stringify(result).includes("00000000000"));
});

Deno.test("diagnostic: provider errors never relay raw body or secrets", async () => {
  const fixture = diagnosticDeps({}, new Response(JSON.stringify({ message: API_KEY, token: WEBHOOK_TOKEN }), { status: 500 }));
  const result = await runAsaasSandboxDiagnostic("jwt", fixture.deps);
  assertEquals(result.body.error, "ASAAS_SERVER_ERROR");
  assert(!JSON.stringify(result).includes(API_KEY));
  assert(!JSON.stringify(result).includes(WEBHOOK_TOKEN));
  assertEquals(fixture.calls.length, 1);
});

Deno.test("diagnostic: incoming mutations and arbitrary parameters are rejected", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const fixture = diagnosticDeps();
    assertEquals((await handleAsaasSandboxDiagnostic(new Request("https://example.test", { method }), fixture.deps)).status, 405);
    assertEquals(fixture.calls.length, 0);
  }
  const fixture = diagnosticDeps();
  assertEquals((await handleAsaasSandboxDiagnostic(new Request("https://example.test?environment=production"), fixture.deps)).status, 400);
  assertEquals(fixture.calls.length, 0);
});
