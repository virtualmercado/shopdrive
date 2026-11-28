import { assert, assertEquals } from "jsr:@std/assert@1";
import { CUSTOMER_ACCOUNT, CUSTOMER_STORE, handleAsaasManageCustomer, inspectLocalMatches,
  matchCustomerEvidence, normalizeCustomer, sandboxCustomerPayload, type CustomerDeps, type LocalCustomer } from "./customer.ts";
const MASTER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCAL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REF = `sd_customer_${LOCAL}`;
const PF = { name: "Pessoa Fictícia", cpfCnpj: "529.982.247-25" };
function fixture(options: { admin?: boolean; actor?: string | null; missing?: boolean; error?: boolean;
  linked?: boolean; rows?: LocalCustomer[] } = {}) {
  let reads = 0;
  const deps: CustomerDeps = {
    getUserId: async (jwt) => jwt === "synthetic-jwt" ? options.actor === undefined ? MASTER : options.actor : null,
    isAdmin: async () => options.admin !== false,
    accountId: async () => { reads++; return options.missing ? null : LOCAL; },
    assertScope: async () => { if (options.error) throw new Error("secret raw error"); },
    hasCommercialLink: async () => options.linked !== false,
    findLocal: async () => options.rows ?? [],
  };
  return { deps, reads: () => reads };
}
function request(extra: Record<string, unknown> = {}, jwt = "synthetic-jwt", method = "POST") {
  return new Request("https://backend.example.test", { method, headers: { Authorization: `Bearer ${jwt}` },
    ...(method === "POST" ? { body: JSON.stringify({ action: "prepare", storeId: CUSTOMER_STORE, environment: "sandbox", data: PF, ...extra }) } : {}) });
}
const row: LocalCustomer = { id: LOCAL, document: "52998224725", profileId: null, accountId: LOCAL,
  state: "linked", providerId: "cus_fixture", externalReference: REF, sent: false };

Deno.test("customer PF: checksum and normalization reuse existing validation", () => {
  assertEquals(normalizeCustomer(PF), { ok: true, data: { name: "Pessoa Fictícia", cpfCnpj: "52998224725" } });
  assertEquals(normalizeCustomer({ ...PF, cpfCnpj: "52998224724" }), { ok: false, field: "cpfCnpj" });
});
Deno.test("customer PJ: checksum and normalization", () => {
  assert(normalizeCustomer({ ...PF, cpfCnpj: "12.345.678/0001-95" }).ok);
  assertEquals(normalizeCustomer({ ...PF, cpfCnpj: "12345678000194" }), { ok: false, field: "cpfCnpj" });
});
Deno.test("customer: repeated or malformed document rejected", () => {
  for (const cpfCnpj of ["11111111111", "00000000000000", "abc52998224725", 52998224725, "123"])
    assertEquals(normalizeCustomer({ ...PF, cpfCnpj }), { ok: false, field: "cpfCnpj" });
});
Deno.test("customer: optional contact and address fields normalized", () => {
  const result = normalizeCustomer({ ...PF, email: " PERSON@EXAMPLE.TEST ", phone: "+55 (11) 3333-4444",
    mobilePhone: "+55 (11) 98765-4321", postalCode: "01310-100", address: " Rua Fictícia ", addressNumber: "100" });
  assert(result.ok);
  assertEquals(result.data.email, "person@example.test");
  assertEquals(result.data.phone, "1133334444");
  assertEquals(result.data.mobilePhone, "11987654321");
  assertEquals(result.data.postalCode, "01310100");
  assertEquals(result.data.address, "Rua Fictícia");
});
Deno.test("customer: invalid optional fields fail without inventing missing data", () => {
  for (const [field, value] of [["email", "invalid"], ["phone", "123"], ["mobilePhone", "11111111111"], ["postalCode", "123"], ["address", "\u0001street"]])
    assertEquals(normalizeCustomer({ ...PF, [field]: value }), { ok: false, field });
  const result = normalizeCustomer(PF);
  assert(result.ok);
  assertEquals(Object.keys(result.data).sort(), ["cpfCnpj", "name"]);
});
Deno.test("customer: Sandbox payload disables notifications and drops unnecessary personal/internal fields", () => {
  const result = normalizeCustomer({ ...PF, notes: "private order history", apiKey: "secret" });
  assert(result.ok);
  assertEquals(sandboxCustomerPayload(result.data, REF), { name: "Pessoa Fictícia", cpfCnpj: "52998224725", externalReference: REF, notificationDisabled: true });
});
Deno.test("customer: invalid external reference cannot form payload", () => {
  const result = normalizeCustomer(PF); assert(result.ok);
  let failed = false;
  try { sandboxCustomerPayload(result.data, "52998224725"); } catch { failed = true; }
  assert(failed);
});
Deno.test("customer: valid Master preparation is local and does not reserve a payer", async () => {
  const f = fixture();
  const result = await handleAsaasManageCustomer(request(), f.deps);
  assertEquals(result.body, { ok: true, state: "ready_for_local_reservation", environment: "sandbox", externalExecutionEnabled: false });
  assertEquals(f.reads(), 1);
});
Deno.test("customer: missing/invalid JWT rejected", async () => {
  const f = fixture();
  assertEquals((await handleAsaasManageCustomer(request({}, "invalid"), f.deps)).status, 401);
  assertEquals((await handleAsaasManageCustomer(new Request("https://backend.example.test", { method: "POST" }), f.deps)).status, 401);
  assertEquals(f.reads(), 0);
});
Deno.test("customer: merchant or visual authorization never grants Master access", async () => {
  const f = fixture({ admin: false, actor: CUSTOMER_STORE });
  assertEquals((await handleAsaasManageCustomer(request({ authorizationId: "consumed", uiEnabled: true }), f.deps)).status, 403);
  assertEquals(f.reads(), 0);
});
Deno.test("customer: Production blocked before account/credentials/network", async () => {
  const f = fixture();
  assertEquals((await handleAsaasManageCustomer(request({ environment: "production" }), f.deps)).body.error, "ASAAS_CUSTOMER_ENVIRONMENT_BLOCKED");
  assertEquals(f.reads(), 0);
});
Deno.test("customer: commercial stores blocked", async () => {
  const f = fixture();
  assertEquals((await handleAsaasManageCustomer(request({ storeId: MASTER }), f.deps)).body.error, "ASAAS_CUSTOMER_SCOPE_BLOCKED");
  assertEquals(f.reads(), 0);
});
Deno.test("customer: all external actions and reservation execution remain blocked", async () => {
  const f = fixture();
  for (const action of ["create", "reserve", "lookup_external", "reconcile"])
    assertEquals((await handleAsaasManageCustomer(request({ action, authorizationId: "approved-looking" }), f.deps)).body.error, "ASAAS_PHASE_52_NOT_AUTHORIZED");
  assertEquals(f.reads(), 0);
});
Deno.test("customer: missing/incorrect/unapproved account fails closed", async () => {
  assertEquals((await handleAsaasManageCustomer(request(), fixture({ missing: true }).deps)).status, 403);
  assertEquals((await handleAsaasManageCustomer(request(), fixture({ error: true }).deps)).status, 503);
});
Deno.test("customer: commercial profile must belong to authorized store", async () => {
  assertEquals((await handleAsaasManageCustomer(request({ customerProfileId: MASTER }), fixture({ linked: false }).deps)).body.error, "ASAAS_CUSTOMER_COMMERCIAL_SCOPE_BLOCKED");
});
Deno.test("customer: existing payer reused without exposing personal data or attempt token", async () => {
  const result = await handleAsaasManageCustomer(request(), fixture({ rows: [row] }).deps);
  assertEquals(result.body.state, "existing");
  const output = JSON.stringify(result);
  for (const secret of ["52998224725", PF.name, "cus_fixture", REF, "attemptToken", "apiKey"]) assert(!output.includes(secret));
});
Deno.test("customer: every local match checked, never LIMIT 1", () => {
  assertEquals(inspectLocalMatches([row, { ...row, id: MASTER }], row.document, null, LOCAL).state, "identity_conflict");
  assertEquals(inspectLocalMatches([row], "12345678000195", null, LOCAL).state, "identity_conflict");
  assertEquals(inspectLocalMatches([row], row.document, MASTER, LOCAL).state, "identity_conflict");
});
Deno.test("customer: uncertain/blocked attempt requires reconciliation without fresh creation", () => {
  assertEquals(inspectLocalMatches([{ ...row, state: "unknown", sent: true, providerId: null }], row.document, null, LOCAL).state, "reconciliation_required");
  assertEquals(inspectLocalMatches([{ ...row, state: "blocked", providerId: null }], row.document, null, LOCAL).state, "reconciliation_required");
});
Deno.test("customer evidence: zero/multiple/incomplete results never associate", () => {
  const match = { id: "cus_fixture", externalReference: REF, cpfCnpj: row.document };
  for (const data of [[], [match, match]])
    assertEquals(matchCustomerEvidence(REF, row.document, CUSTOMER_ACCOUNT, { accountId: CUSTOMER_ACCOUNT, complete: true, data }).state, "reconciliation_required");
  assertEquals(matchCustomerEvidence(REF, row.document, CUSTOMER_ACCOUNT, { accountId: CUSTOMER_ACCOUNT, complete: false, data: [match] }).state, "reconciliation_required");
});
Deno.test("customer evidence: exact reference+document+subaccount required", () => {
  const match = { id: "cus_fixture", externalReference: REF, cpfCnpj: row.document };
  const evidence = { accountId: CUSTOMER_ACCOUNT, complete: true, data: [match] };
  assertEquals(matchCustomerEvidence(REF, row.document, CUSTOMER_ACCOUNT, evidence), { state: "matched", providerId: "cus_fixture" });
  assertEquals(matchCustomerEvidence(REF, row.document, CUSTOMER_ACCOUNT, { ...evidence, accountId: MASTER }).state, "reconciliation_required");
  assertEquals(matchCustomerEvidence(REF, "12345678000195", CUSTOMER_ACCOUNT, evidence).state, "identity_conflict");
  assertEquals(matchCustomerEvidence(REF, row.document, CUSTOMER_ACCOUNT, { ...evidence, data: [{ ...match, externalReference: "document-only" }] }).state, "identity_conflict");
});
Deno.test("customer: errors return fixed codes, never raw caught details", async () => {
  const output = JSON.stringify(await handleAsaasManageCustomer(request(), fixture({ error: true }).deps));
  assert(!output.includes("secret raw error"));
  assert(!output.includes(PF.name));
});
Deno.test("customer: invalid method and JSON rejected", async () => {
  const f = fixture();
  assertEquals((await handleAsaasManageCustomer(request({}, "synthetic-jwt", "GET"), f.deps)).status, 405);
  assertEquals((await handleAsaasManageCustomer(new Request("https://backend.example.test", {
    method: "POST", headers: { Authorization: "Bearer synthetic-jwt" }, body: "{bad" }), f.deps)).status, 400);
});