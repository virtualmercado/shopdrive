import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { describe, it, expect } from 'vitest';

const ORDER='11111111-2222-4333-8444-555555555555'; const STORE='22222222-2222-4222-8222-222222222222'; const GUEST='a'.repeat(64);
interface Options { guest?: boolean; noToken?: boolean; denied?: boolean; state?: string; timeout?: boolean; reject?: boolean; localFailure?: boolean; method?: 'card'|'pix'; forged?: boolean; pagbank?: boolean; gatewayStatus?: string; claimState?: string; legacyBody?: boolean; }
async function run(options:Options={}) {
 const outbound:{url:string;init:RequestInit}[]=[]; const calls:{name:string;args:any}[]=[]; const logs:unknown[]=[];
 let handler:((r:Request)=>Promise<Response>)|undefined;
 const db={auth:{getClaims:async()=>options.guest?{data:null,error:{}}:{data:{claims:{sub:'fixture-customer'}},error:null}},rpc:async(name:string,args:any)=>{
  calls.push({name,args});
  if(name==='authorize_checkout_payment' || name==='authorize_checkout_payment_status') return options.denied?{data:null,error:{}}:{data:{id:ORDER,store_owner_id:STORE,total_amount:10,customer_email:'fixture@example.invalid',customer_name:'Fictício',payment_status:'pending'},error:null};
  if(name==='claim_checkout_payment')return options.claimState?{data:{charge:false,state:options.claimState,orderConfirmed:true},error:null}:{data:{charge:!options.state,state:options.state||'submitting',externalPaymentId:options.state==='pending'?'fixture-payment':null},error:null};
  if(name==='apply_checkout_payment_result')return options.localFailure?{data:null,error:{}}:{data:{status:options.gatewayStatus||(options.reject?'rejected':'approved'),orderConfirmed:true,qrCode:options.method==='pix'?'fixture-qr':null,pixPaymentId:'fixture-pix'},error:null};
  return {data:null,error:null};
 },from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{state:options.state||'ready'},error:null}),single:async()=>({data:{mercadopago_access_token:'fixture-server-secret',mercadopago_enabled:true,mercadopago_accepts_credit:true,credit_card_enabled:true,credit_card_provider:'mercado_pago',credit_card_installments_no_interest:12,pix_enabled:true,pix_provider:options.pagbank?'pagbank':'mercado_pago',pagbank_enabled:true,pagbank_accepts_pix:true,pagbank_token:'fixture-server-secret'},error:null})})};
 const context:any={Request,Response,Date,crypto,TextEncoder,Uint8Array,AbortSignal,z,createClient:()=>db,Deno:{env:{get:()=> 'fixture-config'}},corsHeaders:{'Access-Control-Allow-Origin':'*'},console:{error:(...a:unknown[])=>logs.push(a)},fetch:async(url:string,init:RequestInit)=>{
  outbound.push({url,init});if(options.timeout)throw new Error('fixture-card-token-sentinel fixture-server-secret');
  const payment={id:'fixture-payment',external_reference:ORDER,transaction_amount:10,currency_id:'BRL',status:options.gatewayStatus||(options.reject?'rejected':'approved'),payment_method_id:options.method==='pix'?'pix':'visa',status_detail:options.reject?'cc_rejected_insufficient_amount':'accredited',token:'fixture-card-token-sentinel',point_of_interaction:{transaction_data:{qr_code:'fixture-qr'}},date_of_expiration:'2026-11-05T17:00:00Z'};
  return Response.json(url.includes('/search?')?{results:[payment]}:payment);
 },serve:(fn:typeof handler)=>{handler=fn}};
 const shared=ts.transpileModule(readFileSync('supabase/functions/_shared/checkoutPayment.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.createContext(context);vm.runInContext(shared,context);
 const path=options.method==='pix'?'generate-pix':'process-credit-card';
 const source=ts.transpileModule(readFileSync(`supabase/functions/${path}/index.ts`,'utf8').replace(/^import .*;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.runInContext(source,context);if(!handler)throw new Error('Handler missing');
 const body=options.legacyBody?{orderId:ORDER,amount:0.01,storeOwnerId:'attacker-store',gateway:'pagbank',description:'Pedido legado'}:{orderId:ORDER,guestPaymentToken:options.noToken?undefined:GUEST,cardToken:'fixture-card-token-sentinel',paymentMethodId:'visa',installments:1,amount:options.forged?0.01:10,storeOwnerId:'attacker-store',gateway:'pagbank'};
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer fixture-session'},body:JSON.stringify(body)}));
 return{body:await response.json(),status:response.status,outbound,calls,logs:JSON.stringify(logs)};
}
describe('Real card/PIX handlers with synthetic transport only',()=>{
 it('legitimate guest card is accepted without a user JWT',async()=>{const r=await run({guest:true});expect(r.status).toBe(200);expect(r.body.status).toBe('approved');expect(r.calls[0].args.p_user_id).toBeNull();expect(r.calls[0].args.p_token_hash).toHaveLength(64);});
 it('order ID without a guest capability never reaches a privileged operation',async()=>{const r=await run({guest:true,noToken:true});expect(r.status).toBe(403);expect(r.outbound).toHaveLength(0);expect(r.calls).toHaveLength(0);});
 it.each(['wrong order token','expired token','cross-tenant user'])('%s denied by authorization cannot charge',async()=>{const r=await run({denied:true});expect(r.status).toBe(403);expect(r.outbound).toHaveLength(0);});
 it('forged amount and merchant are ignored, credentials and amount come from the order',async()=>{const r=await run({guest:true,forged:true});const payload=JSON.parse(String(r.outbound[0].init.body));expect(payload.transaction_amount).toBe(10);expect(payload.external_reference).toBe(ORDER);expect(r.outbound[0].init.headers).toMatchObject({Authorization:'Bearer fixture-server-secret','X-Idempotency-Key':`order-${ORDER}`});});
 it('authenticated existing flow still approves',async()=>{expect((await run()).body.success).toBe(true)});
 it('refusal stays a definitive rejected outcome and persists before stock finalization',async()=>{const r=await run({reject:true});expect(r.body.status).toBe('rejected');expect(r.calls.find(c=>c.name==='record_checkout_payment_result')?.args.p_state).toBe('rejected');expect(r.calls.at(-1)?.name).toBe('apply_checkout_payment_result');});
 it('timeout persists unknown and never claims no charge',async()=>{const r=await run({timeout:true});expect(r.body.status).toBe('unknown');expect(r.calls.at(-1)?.args.p_state).toBe('unknown');expect(r.body.message).not.toContain('Nenhuma cobrança');});
 it('retry of an unresolved call uses GET reconciliation, never another POST',async()=>{const r=await run({state:'unknown'});expect(r.outbound).toHaveLength(1);expect(r.outbound[0].url).toContain('external_reference='+ORDER);expect(r.outbound[0].init.method).not.toBe('POST');expect(r.body.status).toBe('approved');});
 it('known payment ID is reconciled by GET',async()=>{const r=await run({state:'pending'});expect(r.outbound[0].url).toBe('https://api.mercadopago.com/v1/payments/fixture-payment');expect(r.outbound[0].init.method).not.toBe('POST');});
 it('failed reconciliation never claims no charge for a previously sent payment',async()=>{const r=await run({state:'pending',timeout:true});expect(r.body.status).toBe('unknown');expect(r.body.message).not.toContain('Nenhuma cobrança');expect(r.outbound[0].init.method).not.toBe('POST');});
 it('approval with local write failure never becomes generic payment failure',async()=>{const r=await run({localFailure:true});expect(r.body.status).toBe('approved');expect(r.body.orderConfirmed).toBe(false);expect(r.body.message).toBe('Pagamento aprovado. Estamos confirmando seu pedido.');});
 it('guest PIX accepts the same order-bound capability and ignores forged provider',async()=>{const r=await run({method:'pix',guest:true,forged:true});expect(r.status).toBe(200);expect(r.body.qrCode).toBe('fixture-qr');expect(r.outbound[0].url).toBe('https://api.mercadopago.com/v1/payments');expect(JSON.parse(String(r.outbound[0].init.body)).transaction_amount).toBe(10);});
 it('no guest token or card data reaches logs, result or persistence',async()=>{const r=await run({guest:true});for(const secret of [GUEST,'fixture-card-token-sentinel','fixture-server-secret']){expect(r.logs).not.toContain(secret);expect(JSON.stringify(r.body)).not.toContain(secret);expect(JSON.stringify(r.calls)).not.toContain(secret);}});

 it('PIX pending creation returns QR once with order idempotency key',async()=>{const r=await run({method:'pix',guest:true,gatewayStatus:'pending'});expect(r.outbound.filter(o=>o.init.method==='POST')).toHaveLength(1);expect(r.outbound[0].init.headers).toMatchObject({'X-Idempotency-Key':`order-${ORDER}`});expect(r.calls.find(c=>c.name==='record_checkout_payment_result')?.args.p_state).toBe('pending');expect(r.body.qrCode).toBe('fixture-qr');});
 it('PIX retry/refresh after send reconciles by GET and never creates a second charge',async()=>{for(const state of ['unknown','pending']){const r=await run({method:'pix',guest:true,state});expect(r.outbound.every(o=>o.init.method!=='POST')).toBe(true);expect(r.calls.filter(c=>c.name==='claim_checkout_payment')).toHaveLength(1);}});
 it('PIX approved, rejected and expired claims return without gateway calls',async()=>{for(const claimState of ['approved','rejected','expired']){const r=await run({method:'pix',guest:true,claimState});expect(r.outbound).toHaveLength(0);expect(r.body.status).toBe(claimState);}});
 it('PIX timeout persists unknown and never claims no charge',async()=>{const r=await run({method:'pix',guest:true,timeout:true});expect(r.body.status).toBe('unknown');expect(r.calls.at(-1)?.args.p_state).toBe('unknown');expect(r.outbound).toHaveLength(1);});
 it('PIX local confirmation failure keeps a replayable state without charging again',async()=>{const r=await run({method:'pix',guest:true,localFailure:true,gatewayStatus:'pending'});expect(r.body.status).toBe('unknown');expect(r.calls.find(c=>c.name==='record_checkout_payment_result')?.args.p_external_id).toBe('fixture-payment');const retry=await run({method:'pix',guest:true,state:'pending'});expect(retry.outbound.every(o=>o.init.method!=='POST')).toBe(true);});
 it('PagBank ambiguous result without recoverable reference stays blocked/manual',async()=>{const r=await run({method:'pix',guest:true,pagbank:true,state:'unknown'});expect(r.outbound).toHaveLength(0);expect(r.body.status).toBe('unknown');});
 it('published legacy PIX body for authenticated customer stays compatible and ignores forged fields',async()=>{const r=await run({method:'pix',legacyBody:true});expect(r.status).toBe(200);expect(r.body.success).toBe(true);expect(r.body.pixPaymentId).toBe('fixture-pix');expect(JSON.parse(String(r.outbound[0].init.body)).transaction_amount).toBe(10);expect(r.outbound[0].url).toContain('mercadopago');});
 it('published legacy guest PIX body stays fail-closed without capability',async()=>{const r=await run({method:'pix',guest:true,legacyBody:true});expect(r.status).toBe(403);expect(r.outbound).toHaveLength(0);});
 it('published legacy authenticated card body is accepted without guest capability',async()=>{const r=await run({legacyBody:false,noToken:true});expect(r.status).toBe(200);expect(r.body.status).toBe('approved');expect(r.calls[0].args.p_token_hash).toBeNull();});
});
