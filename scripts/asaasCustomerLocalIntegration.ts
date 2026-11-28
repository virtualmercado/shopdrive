// Actual Phase 5.1 handler + approved RPCs, synthetic localhost database only.
import { assertEquals } from "jsr:@std/assert@1";
import { CUSTOMER_STORE, handleAsaasManageCustomer, type CustomerDeps } from "../supabase/functions/asaas-manage-customer/customer.ts";
const [dsn] = Deno.args;
if (!dsn?.startsWith("postgresql://nobody@127.0.0.1:55453/asaas_customer_test")) throw new Error("Disposable localhost only");
const MASTER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const q = (v: unknown) => v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`;
async function sql(query: string) {
  const output = await new Deno.Command("psql", { args: [dsn, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", query],
    stdout: "piped", stderr: "piped", clearEnv: true, env: { PATH: Deno.env.get("PATH") ?? "" } }).output();
  if (!output.success) throw new Error("synthetic database error");
  return new TextDecoder().decode(output.stdout).trim().split("\n").at(-1) ?? "";
}
const deps: CustomerDeps = {
  getUserId: async (jwt) => jwt === "synthetic-master" ? MASTER : jwt === "synthetic-merchant" ? CUSTOMER_STORE : null,
  isAdmin: async (actor) => await sql(`SELECT has_role(${q(actor)},'admin');`) === "t",
  accountId: async () => ACCOUNT,
  assertScope: async (actor, account) => { await sql(`SELECT _lock_asaas_customer_scope(${q(actor)},'${CUSTOMER_STORE}','sandbox',${q(account)});`); },
  hasCommercialLink: async (profile) => await sql(`SELECT EXISTS(SELECT 1 FROM store_customers WHERE store_owner_id='${CUSTOMER_STORE}' AND customer_id=${q(profile)});`) === "t",
  findLocal: async (document, profile) => JSON.parse(await sql(`SELECT coalesce(json_agg(json_build_object(
    'id',id,'document',cpf_cnpj_normalized,'profileId',customer_profile_id,'accountId',store_asaas_account_id,
    'state',reservation_state,'providerId',asaas_customer_id,'externalReference',external_reference,'sent',send_started_at IS NOT NULL)),'[]'::json)
    FROM store_asaas_customers WHERE store_id='${CUSTOMER_STORE}' AND environment='sandbox'
      AND (cpf_cnpj_normalized=${q(document)} OR (${q(profile)}::uuid IS NOT NULL AND customer_profile_id=${q(profile)}::uuid));`)),
};
function request(cpfCnpj: string, extra: Record<string, unknown> = {}, actor = "synthetic-master") {
  return new Request("https://backend.example.test", { method: "POST", headers: { Authorization: `Bearer ${actor}` }, body: JSON.stringify({
    action: "prepare", storeId: CUSTOMER_STORE, environment: "sandbox", data: { name: "Synthetic fixture", cpfCnpj }, ...extra,
  }) });
}
const before = await sql("SELECT count(*) FROM store_asaas_customers;");
const existing = await handleAsaasManageCustomer(request("529.982.247-25"), deps);
assertEquals(existing.body.state, "existing");
assertEquals(await sql(`SELECT asaas_customer_id FROM store_asaas_customers WHERE id=${q(existing.body.customerId)};`), "cus_fixture1");
assertEquals((await handleAsaasManageCustomer(request("52998224725", { action: "create" }), deps)).body.error, "ASAAS_PHASE_52_NOT_AUTHORIZED");
assertEquals((await handleAsaasManageCustomer(request("52998224725", {}, "synthetic-merchant"), deps)).status, 403);
assertEquals((await handleAsaasManageCustomer(request("52998224725", { environment: "production" }), deps)).status, 403);
assertEquals((await handleAsaasManageCustomer(request("52998224725", { storeId: MASTER }), deps)).status, 403);
assertEquals((await handleAsaasManageCustomer(request("93541134780", {
  customerProfileId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
}), deps)).body.state, "reservation_exists");
assertEquals((await handleAsaasManageCustomer(request("39053344705", {
  customerProfileId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
}), deps)).body.state, "identity_conflict");
assertEquals((await handleAsaasManageCustomer(request("11144477735"), deps)).body.state, "reconciliation_required");
assertEquals(await sql("SELECT count(*) FROM store_asaas_customers;"), before);
console.log("PASS: real customer handler -> approved localhost RPCs -> persisted payer readback; Master-only, commercial conflict, existing reservation, blocked create/Production/store; no writes or network.");