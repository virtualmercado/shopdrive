// Real handlers -> real RPCs in disposable PostgreSQL. No real JWT/credentials/network.
import { assertEquals } from "jsr:@std/assert@1";
import { handleAsaasManageSubaccount, type AsaasProvisioningDeps } from "../supabase/functions/asaas-manage-subaccount/provisioning.ts";
import { handleAsaasWebhook, type AsaasWebhookDeps } from "../supabase/functions/asaas-webhook/webhook.ts";
import { reconcileAsaasAccountEvents } from "../supabase/functions/_shared/asaasAccountReconciliation.ts";
const [dsn] = Deno.args;
if (!dsn?.startsWith("postgresql://nobody@127.0.0.1:55451/")) throw new Error("Disposable localhost only");
const STORE="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const LOST="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ADMIN="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MASTER="synthetic-master-key-with-at-least-32-characters";
const SUBKEY="$aact_synthetic_subaccount_never_real";
const STATES={commercialInfo:"APPROVED",bankAccountInfo:"APPROVED",documentation:"APPROVED",general:"APPROVED"};
const quote=(v:unknown):string => v===null||v===undefined ? "NULL" : `'${String(v).replaceAll("'","''")}'`;
async function sql(query:string):Promise<string> {
 const result=await new Deno.Command("psql",{args:[dsn,"-X","-q","-v","ON_ERROR_STOP=1","-At","-c",query],stdout:"piped",stderr:"piped",clearEnv:true,env:{PATH:Deno.env.get("PATH")??""}}).output();
 if(!result.success) throw new Error(new TextDecoder().decode(result.stderr));
 return new TextDecoder().decode(result.stdout).trim().split("\n").at(-1)??"";
}
async function rpc(name:string,args:Record<string,unknown>) {
 return await sql(`SELECT public.${name}(${Object.entries(args).map(([k,v])=>`${k} := ${quote(v)}`).join(",")});`);
}
await sql(`INSERT INTO profiles(id) VALUES('${STORE}'),('${LOST}');`);
async function authorize(store:string) {
 return JSON.parse(await sql(`BEGIN; SELECT set_config('test.actor','${ADMIN}',true); SELECT admin_authorize_asaas_subaccount_creation('${store}','${store}',now()+interval '30 minutes'); COMMIT;`)).authorizationId;
}
let posts=0;let gets=0;let earlyState:unknown;let token="";let loseResponse=false;
const fetchMock:typeof fetch=async (url,init)=>{
 if(init?.method==="POST") {
  posts++;
  if(loseResponse) throw new Error("synthetic network loss");
  const payload=JSON.parse(String(init.body)); token=payload.webhooks[0].authToken;
  earlyState=(await handleAsaasWebhook(eventRequest("evt_e2e_early"),webhookDeps)).body;
  return new Response(JSON.stringify({id:"acc_e2e",walletId:"wal_e2e",apiKey:SUBKEY}));
 }
 gets++;assertEquals(String(url),"https://api-sandbox.asaas.com/v3/myAccount/status");
 assertEquals(new Headers(init?.headers).get("access_token"),SUBKEY);
 return new Response(JSON.stringify(STATES));
};
const env=(name:string)=>name==="ASAAS_ENVIRONMENT"?"sandbox":name==="ASAAS_SUBACCOUNT_ENCRYPTION_KEY"?MASTER:name==="SUPABASE_URL"?"https://backend.example.test":"$aact_synthetic_parent_never_real";
const reconcile=(store:string)=>reconcileAsaasAccountEvents(store,{
 env,fetchImpl:fetchMock,
 snapshot:async()=>{
  const a=JSON.parse(await sql(`SELECT row_to_json(a) FROM store_asaas_accounts a WHERE store_id='${store}' AND environment='sandbox';`));
  if(!a.asaas_account_id||!a.encrypted_api_key||a.creation_attempt_token) return null;
  const through=await sql(`SELECT max(received_at) FROM asaas_webhook_events WHERE store_id='${store}' AND processing_status IN ('received','error');`);
  if(!through) return null;
  return {accountId:a.asaas_account_id,webhookTokenHash:a.webhook_token_hash,encryptedApiKey:a.encrypted_api_key,revision:a.status_revision,through};
 },
 finish:async(store,obs,s)=>JSON.parse(await rpc("reconcile_asaas_account_events",{p_store_id:store,p_account_id:obs.accountId,p_webhook_token_hash:obs.webhookTokenHash,p_expected_revision:obs.revision,p_through:obs.through,p_commercial_status:s.commercialInfo,p_bank_account_status:s.bankAccountInfo,p_document_status:s.documentation,p_general_approval_status:s.general})),
});
const webhookDeps:AsaasWebhookDeps={
 reconcileEvents:reconcile,
 findAccountByTokenHash:async(hash)=>{
  const raw=await sql(`SELECT json_build_object('storeId',store_id,'webhookTokenHash',webhook_token_hash) FROM store_asaas_accounts WHERE webhook_token_hash=${quote(hash)};`);
  return raw?JSON.parse(raw):null;
 },
 apply:async(i)=>JSON.parse(await rpc("apply_asaas_account_webhook",{p_store_id:i.storeId,p_webhook_token_hash:i.webhookTokenHash,p_event_id:i.eventId,p_event_type:i.eventType,p_account_id:i.accountId,p_payload:JSON.stringify(i.payload),p_commercial_status:i.statuses?.commercialInfo,p_bank_account_status:i.statuses?.bankAccountInfo,p_document_status:i.statuses?.documentation,p_general_approval_status:i.statuses?.general})),
};
const provisioning:AsaasProvisioningDeps={
 getUserId:async(jwt)=>jwt==="synthetic-owner"?STORE:jwt==="synthetic-lost"?LOST:jwt==="synthetic-admin"?ADMIN:null,
 canManageStore:async(actor,store)=>actor===store,isAdmin:async(actor)=>actor===ADMIN,
 getInstitutionalEmail:async()=>"institutional@example.test",reconcileEvents:reconcile,env,fetchImpl:fetchMock,
 begin:async(actor,store,hash,grant)=>JSON.parse(await rpc("begin_asaas_subaccount_creation",{p_actor:actor,p_store_id:store,p_webhook_token_hash:hash,p_authorization_id:grant})),
 capture:async(i)=>await rpc("capture_asaas_subaccount_credentials",{p_attempt_token:i.attemptToken,p_asaas_account_id:i.accountId,p_wallet_id:i.walletId,p_account_number:i.accountNumber,p_encrypted_api_key:i.encryptedApiKey,p_api_key_fingerprint:i.apiKeyFingerprint})==="t",
 complete:async(i)=>await rpc("complete_asaas_subaccount_creation",{p_attempt_token:i.attemptToken,p_commercial_status:i.statuses?.commercialInfo,p_bank_account_status:i.statuses?.bankAccountInfo,p_document_status:i.statuses?.documentation,p_general_approval_status:i.statuses?.general,p_status:i.status,p_last_error_code:i.errorCode})==="t",
 fail:async(i)=>await rpc("fail_asaas_subaccount_creation",{p_attempt_token:i.attemptToken,p_error_code:i.errorCode,p_asaas_account_id:i.accountId,p_wallet_id:i.walletId,p_account_number:i.accountNumber})==="t",
};
function eventRequest(id:string,general="APPROVED",date="2026-11-27T20:00:00Z") {
 return new Request("https://backend.example.test",{method:"POST",headers:{"asaas-access-token":token},body:JSON.stringify({id,event:`ACCOUNT_STATUS_GENERAL_APPROVAL_${general}`,dateCreated:date,account:{id:"acc_e2e"},accountStatus:{...STATES,general}})});
}
function request(body:unknown,jwt="synthetic-owner") {
 return new Request("https://backend.example.test",{method:"POST",headers:{Authorization:`Bearer ${jwt}`},body:JSON.stringify(body)});
}
const data={name:"Pessoa Fictícia",email:"person@example.test",cpfCnpj:"52998224725",mobilePhone:"11987654321",incomeValue:2500,address:"Rua Fictícia",addressNumber:"100",province:"Centro",postalCode:"01310100",birthDate:"1990-01-02"};
const input={action:"create",storeId:STORE,data};
assertEquals((await handleAsaasManageSubaccount(request(input),provisioning)).status,403); assertEquals(posts,0);
const grant=await authorize(STORE);
assertEquals((await handleAsaasManageSubaccount(request({...input,authorizationId:grant}),provisioning)).status,201);
assertEquals(posts,1);assertEquals(earlyState,{received:true,deferred:true});
assertEquals(await sql("SELECT processing_status FROM asaas_webhook_events WHERE event_id='evt_e2e_early'"),"received");
assertEquals((await handleAsaasManageSubaccount(request({action:"reconcile_events",storeId:STORE},"synthetic-admin"),provisioning)).body.state,"processed");
assertEquals(await sql("SELECT processing_status FROM asaas_webhook_events WHERE event_id='evt_e2e_early'"),"processed");
assertEquals((await handleAsaasWebhook(eventRequest("evt_e2e_old","REJECTED","2020-01-01T00:00:00Z"),webhookDeps)).body.processed,true);
assertEquals(await sql(`SELECT status FROM store_asaas_accounts WHERE store_id='${STORE}'`),"active");
const readsBefore=gets;
assertEquals((await handleAsaasWebhook(eventRequest("evt_e2e_old","REJECTED"),webhookDeps)).body.duplicate,true);assertEquals(gets,readsBefore);
assertEquals((await handleAsaasManageSubaccount(request({...input,authorizationId:grant}),provisioning)).body.state,"existing");assertEquals(posts,1);
loseResponse=true;const lostGrant=await authorize(LOST);const lostInput={...input,storeId:LOST,authorizationId:lostGrant};
assertEquals((await handleAsaasManageSubaccount(request(lostInput,"synthetic-lost"),provisioning)).status,409);
assertEquals((await handleAsaasManageSubaccount(request(lostInput,"synthetic-lost"),provisioning)).status,409);assertEquals(posts,2);
console.log("PASS: end-to-end real handlers + local RPCs; denied/approved synthetic creation, early recovery, delayed/duplicate events and lost response; all Asaas transport mocked.");
