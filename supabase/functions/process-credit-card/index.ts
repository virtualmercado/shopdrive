import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { paymentIdentity, authorizePayment, PaymentAccessError, cardProviderEnabled, PAYMENT_NOT_STARTED, PAYMENT_UNKNOWN, fetchPayment, normalizeGatewayPayment, persistPayment, reconcilePayment } from '../_shared/checkoutPayment.ts';

const Body = z.object({ orderId: z.string().uuid(), guestPaymentToken: z.string().regex(/^[0-9a-f]{64}$/).optional(), action: z.enum(['pay','status']).default('pay'), cardToken: z.string().min(1).max(512).optional(), paymentMethodId: z.string().regex(/^[a-z0-9_]+$/).max(40).optional(), issuerId: z.string().max(40).optional(), installments: z.number().int().min(1).max(12).default(1), customerCpf: z.string().max(20).optional(), customerAddress: z.object({ zipCode:z.string().max(12).optional(),street:z.string().max(150).optional(),number:z.string().max(20).optional(),neighborhood:z.string().max(100).optional(),city:z.string().max(100).optional(),state:z.string().max(2).optional() }).optional() });
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...corsHeaders,'Content-Type':'application/json'} });
serve(async req => {
 if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
 if (req.method !== 'POST') return json({error:PAYMENT_NOT_STARTED,status:'not_started'},405);
 let sent = false; let orderId: string | undefined; let db: ReturnType<typeof createClient> | undefined;
 try {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json({error:PAYMENT_NOT_STARTED,status:'not_started'},400);
  const body=parsed.data; orderId=body.orderId;
  const url=Deno.env.get('SUPABASE_URL'); const anon=Deno.env.get('SUPABASE_ANON_KEY'); const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({error:PAYMENT_NOT_STARTED,status:'not_started'},503);
  db=createClient(url,service); const auth=createClient(url,anon);
  const identity=await paymentIdentity(req,auth,body.guestPaymentToken);
  const { data: order, error: authError } = await db.rpc(body.action === 'status' ? 'authorize_checkout_payment_status' : 'authorize_checkout_payment', {p_order_id:orderId,p_method:'cartao_credito',...identity});
  if (authError || !order) throw new PaymentAccessError();
  const { data: existingAttempt, error: attemptError } = await db.from('checkout_payment_attempts').select('state').eq('order_id', orderId).maybeSingle();
  sent = Boolean(order.card_payment_id || (existingAttempt && existingAttempt.state !== 'ready'));
  if (attemptError) return json({success:false,status:'unknown',message:PAYMENT_UNKNOWN});
  const {data:settings,error:settingsError}=await db.from('payment_settings').select('mercadopago_access_token,mercadopago_enabled,mercadopago_accepts_credit,credit_card_enabled,credit_card_provider,credit_card_installments_no_interest').eq('user_id',order.store_owner_id).single();
  if (settingsError || !settings?.mercadopago_access_token || !cardProviderEnabled(settings) || !(Number(order.total_amount)>0)) return json({error:sent?PAYMENT_UNKNOWN:PAYMENT_NOT_STARTED,status:sent?'unknown':'not_started'},400);
  if (!sent && body.action==='pay' && (!body.cardToken || !body.paymentMethodId || body.installments>Number(settings.credit_card_installments_no_interest || 1))) return json({error:PAYMENT_NOT_STARTED,status:'not_started'},400);
  if (body.action==='pay' && !z.string().email().safeParse(order.customer_email).success) return json({error:PAYMENT_NOT_STARTED,status:'not_started'},400);
  const {data:claim,error}=await db.rpc('claim_checkout_payment',{p_order_id:orderId,...identity,p_method:'cartao_credito',p_gateway:'mercadopago',p_status_only:body.action==='status'});
  if (error || !claim) return json({error:sent?PAYMENT_UNKNOWN:PAYMENT_NOT_STARTED,status:sent?'unknown':'not_started'},409);
  if (claim.state==='approved' && claim.orderConfirmed) return json({success:true,status:'approved',orderConfirmed:true,duplicate:true,paymentId:claim.externalPaymentId});
  if (['approved','rejected','cancelled','expired'].includes(claim.state)) {
   const { data, error: applyError } = await db.rpc('apply_checkout_payment_result',{p_order_id:orderId});
   return json(applyError || !data ? {success:claim.state==='approved',status:claim.state==='approved'?'approved':'unknown',orderConfirmed:false,message:claim.state==='approved'?'Pagamento aprovado. Estamos confirmando seu pedido.':PAYMENT_UNKNOWN} : {...data,success:claim.state==='approved'});
  }
  if (!claim.charge) {
   if (claim.state==='ready') return json({success:false,status:'not_started',message:PAYMENT_NOT_STARTED});
   sent=true;
   const payment=await reconcilePayment(order,claim.externalPaymentId,settings.mercadopago_access_token,'mercadopago','card');
   return json(payment ? await persistPayment(db,orderId,payment) : {success:false,status:'unknown',message:PAYMENT_UNKNOWN});
  }
  const address=body.customerAddress;
  const payload={transaction_amount:Math.round(Number(order.total_amount)*100)/100,token:body.cardToken,description:`Pedido ${orderId}`,payment_method_id:body.paymentMethodId,installments:body.installments,external_reference:orderId,capture:true,
   ...(body.issuerId ? {issuer_id:body.issuerId}:{}),payer:{email:order.customer_email,first_name:order.customer_name.split(' ')[0],last_name:order.customer_name.split(' ').slice(1).join(' ') || order.customer_name,
   ...(body.customerCpf ? {identification:{type:'CPF',number:body.customerCpf.replace(/\D/g,'')}}:{}),
   ...(address?.zipCode ? {address:{zip_code:address.zipCode.replace(/\D/g,''),street_name:address.street,street_number:address.number,neighborhood:address.neighborhood,city:address.city,federal_unit:address.state}}:{})}};
  sent=true;
  const response=await fetchPayment('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:`Bearer ${settings.mercadopago_access_token}`,'Content-Type':'application/json','X-Idempotency-Key':`order-${orderId}`},body:JSON.stringify(payload)});
  const raw=await response.json();
  const payment=response.ok ? normalizeGatewayPayment(raw,order) : null;
  if (!payment) {
   await db.rpc('record_checkout_payment_result',{p_order_id:orderId,p_state:'unknown'});
   return json({success:false,status:'unknown',message:PAYMENT_UNKNOWN});
  }
  return json(await persistPayment(db,orderId,payment));
 } catch (error) {
  console.error('Card payment could not complete');
  if (error instanceof PaymentAccessError) return json({error:PAYMENT_NOT_STARTED,status:'not_started'},403);
  if (sent && db && orderId) await db.rpc('record_checkout_payment_result',{p_order_id:orderId,p_state:'unknown'});
  return json({success:false,status:sent?'unknown':'not_started',message:sent?PAYMENT_UNKNOWN:PAYMENT_NOT_STARTED},sent?200:500);
 }
});
