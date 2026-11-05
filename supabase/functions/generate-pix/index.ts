import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { paymentIdentity, authorizePayment, PaymentAccessError, pixProvider, PAYMENT_NOT_STARTED, PAYMENT_UNKNOWN, fetchPayment, normalizeGatewayPayment, persistPayment, reconcilePayment } from '../_shared/checkoutPayment.ts';
const Body=z.object({orderId:z.string().uuid(),guestPaymentToken:z.string().regex(/^[0-9a-f]{64}$/).optional()});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:PAYMENT_NOT_STARTED},405);
 let sent=false;let db:ReturnType<typeof createClient>|undefined;let orderId:string|undefined;
 try{
  const parsed=Body.safeParse(await req.json());if(!parsed.success)return json({error:PAYMENT_NOT_STARTED},400);
  orderId=parsed.data.orderId;
  const url=Deno.env.get('SUPABASE_URL');const anon=Deno.env.get('SUPABASE_ANON_KEY');const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)return json({error:PAYMENT_NOT_STARTED},503);
  db=createClient(url,service);const identity=await paymentIdentity(req,createClient(url,anon),parsed.data.guestPaymentToken);
  const order=await authorizePayment(db,orderId,'pix',identity);
  const {data:settings,error:settingsError}=await db.from('payment_settings').select('pix_enabled,pix_provider,mercadopago_enabled,mercadopago_accepts_pix,mercadopago_access_token,pagbank_enabled,pagbank_accepts_pix,pagbank_token').eq('user_id',order.store_owner_id).single();
  const gateway=settings?pixProvider(settings):null;const credential=gateway==='mercadopago'?settings?.mercadopago_access_token:settings?.pagbank_token;
  if(settingsError||!gateway||!credential)return json({error:PAYMENT_NOT_STARTED,status:'not_started'},400);
  const {data:claim,error}=await db.rpc('claim_checkout_payment',{p_order_id:orderId,...identity,p_method:'pix',p_gateway:gateway,p_status_only:false});
  if(error||!claim)return json({error:PAYMENT_NOT_STARTED,status:'not_started'},409);
  if(claim.state==='approved'&&claim.orderConfirmed)return json({success:true,status:'approved',orderConfirmed:true});
  if(['rejected','cancelled','expired'].includes(claim.state))return json({success:false,status:claim.state,message:'Este pagamento foi encerrado.'});
  if(!claim.charge){
   const payment=await reconcilePayment(order,claim.externalPaymentId,credential,gateway,'pix');
   return json(payment?await persistPayment(db,orderId,payment):{success:false,status:'unknown',message:PAYMENT_UNKNOWN});
  }
  const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  const payload=gateway==='mercadopago'?{transaction_amount:Number(order.total_amount),external_reference:orderId,description:`Pedido ${orderId}`,payment_method_id:'pix',payer:{email:order.customer_email||'cliente@example.invalid'},date_of_expiration:expiresAt}:
   {reference_id:orderId,customer:{name:order.customer_name,email:order.customer_email||'cliente@example.invalid',tax_id:'00000000000'},items:[{name:`Pedido ${orderId}`,quantity:1,unit_amount:Math.round(Number(order.total_amount)*100)}],qr_codes:[{amount:{value:Math.round(Number(order.total_amount)*100)},expiration_date:expiresAt}]};
  sent=true;
  const response=await fetchPayment(gateway==='mercadopago'?'https://api.mercadopago.com/v1/payments':'https://api.pagseguro.com/orders',{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json',[gateway==='mercadopago'?'X-Idempotency-Key':'x-idempotency-key']:`order-${orderId}`},body:JSON.stringify(payload)});
  const raw=await response.json();const payment=response.ok?normalizeGatewayPayment(raw,order,gateway):null;
  if(!payment||!payment.qr){await db.rpc('record_checkout_payment_result',{p_order_id:orderId,p_state:'unknown'});return json({success:false,status:'unknown',message:PAYMENT_UNKNOWN});}
  payment.expiresAt=payment.expiresAt||expiresAt;
  return json(await persistPayment(db,orderId,payment));
 }catch(error){
  console.error('PIX payment could not complete');
  if(error instanceof PaymentAccessError)return json({error:PAYMENT_NOT_STARTED,status:'not_started'},403);
  if(sent&&db&&orderId)await db.rpc('record_checkout_payment_result',{p_order_id:orderId,p_state:'unknown'});
  return json({success:false,status:sent?'unknown':'not_started',message:sent?PAYMENT_UNKNOWN:PAYMENT_NOT_STARTED},sent?200:500);
 }
});
