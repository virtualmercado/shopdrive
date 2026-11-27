import { assertEquals } from "jsr:@std/assert@1";
import { encryptSubaccountApiKey } from "./asaasCrypto.ts";
import { reconcileAsaasAccountEvents, type AccountReconciliationDeps } from "./asaasAccountReconciliation.ts";
const MASTER = "synthetic-master-key-with-at-least-32-characters";
const KEY = "$aact_synthetic_subaccount_never_real";
const STATES = { commercialInfo: "APPROVED", bankAccountInfo: "APPROVED", documentation: "APPROVED", general: "APPROVED" };
async function fixture() {
  let reads=0; let finishes=0;
  const deps: AccountReconciliationDeps = {
    env: (n) => n === "ASAAS_ENVIRONMENT" ? "sandbox" : MASTER,
    snapshot: async () => ({ accountId: "synthetic-account", webhookTokenHash: "a".repeat(64), encryptedApiKey: await encryptSubaccountApiKey(KEY, MASTER), revision: 3, through: "2026-11-27T19:00:00Z" }),
    fetchImpl: async (url, init) => { reads++; assertEquals(String(url), "https://api-sandbox.asaas.com/v3/myAccount/status"); assertEquals(init?.method,"GET"); assertEquals(new Headers(init?.headers).get("access_token"), KEY); return new Response(JSON.stringify(STATES)); },
    finish: async (_store, observation, states) => { finishes++; assertEquals(observation.revision,3); assertEquals(states,STATES); return { state:"processed" }; },
  };
  return { deps, counts: () => [reads,finishes] };
}
Deno.test("Recovery reads only authenticated current status and passes the revision fence", async () => {
 const f=await fixture(); assertEquals((await reconcileAsaasAccountEvents("synthetic-store",f.deps)).state,"processed"); assertEquals(f.counts(),[1,1]);
});
Deno.test("Recovery without bound credentials leaves evidence deferred with zero network", async () => {
 const f=await fixture(); f.deps.snapshot=async()=>null;
 assertEquals((await reconcileAsaasAccountEvents("synthetic-store",f.deps)).state,"deferred"); assertEquals(f.counts(),[0,0]);
});
Deno.test("Invalid status never finishes accepted events", async () => {
 const f=await fixture(); f.deps.fetchImpl=async()=>new Response('{}');
 assertEquals((await reconcileAsaasAccountEvents("synthetic-store",f.deps)).state,"deferred"); assertEquals(f.counts(),[0,0]);
});
Deno.test("Stale observation stays pending instead of overwriting newer state", async () => {
 const f=await fixture(); f.deps.finish=async()=>({state:"stale_observation"});
 assertEquals((await reconcileAsaasAccountEvents("synthetic-store",f.deps)).state,"stale_observation");
});
Deno.test("Production recovery fails closed before any network call", async () => {
 const f=await fixture(); f.deps.env=()=>"production";
 assertEquals((await reconcileAsaasAccountEvents("synthetic-store",f.deps)).state,"deferred"); assertEquals(f.counts(),[0,0]);
});
