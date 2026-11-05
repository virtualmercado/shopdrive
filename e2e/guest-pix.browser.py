import asyncio, re, json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent; OUT=Path('/tmp/browser/guest-pix'); OUT.mkdir(parents=True, exist_ok=True)
fixture=re.search(r'const clientFixture = `([\s\S]*?)`;', (ROOT/'e2e/public-store-runtime.fixture.ts').read_text()).group(1)
ids={'STORE_A':'11111111-1111-4111-8111-111111111111','STORE_B':'22222222-2222-4222-8222-222222222222','PRODUCT_A':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRODUCT_B':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ORDER_A':'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}
for k,v in ids.items(): fixture=fixture.replace('${'+k+'}',v)
fixture=fixture.replace('pix_enabled:false,credit_card_enabled:false,boleto_enabled:false',"pix_enabled:true,pix_provider:'mercado_pago',credit_card_enabled:true,credit_card_provider:'mercado_pago',mercadopago_enabled:true,mercadopago_accepts_pix:true,mercadopago_accepts_credit:true,mercadopago_public_key:'fixture-public-key',boleto_enabled:true")
fixture=fixture.replace("if(name==='create_checkout_order'){window.__createdOrder=args;return {data:order,error:null};}","if(name==='begin_checkout_attempt')return {data:{attemptId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',guestPaymentToken:'a'.repeat(64),expiresAt:'2026-11-06T18:00:00Z'},error:null};if(name==='create_checkout_order_once'){window.__orderRequests=(window.__orderRequests||0)+1;if(!window.__orderCalls){window.__orderCalls=1;window.__createdOrder=args.p_order;order.payment_method=args.p_order.p_payment_method;}return {data:order,error:null};}")
fixture=fixture.replace('window.__createdOrder=args;', 'window.__orderCalls=(window.__orderCalls||0)+1;window.__createdOrder=args;order.payment_method=args.p_payment_method;order.payment_status=args.p_payment_status;order.status=args.p_status;')
fixture=fixture.replace("functions:{invoke:async()=>{throw new Error('Fixture forbids external functions');}}",'''functions:{invoke:async(name,opts)=>{
window.__fn=window.__fn||[];window.__fn.push({name,hasToken:opts.body.guestPaymentToken==='a'.repeat(64),orderId:opts.body.orderId,forged:'amount' in opts.body||'storeOwnerId' in opts.body||'gateway' in opts.body});
const m=window.__pixMode;const qr={success:true,status:'pending',qrCode:'fixture-pix-qr',qrCodeBase64:'',expiresAt:new Date(Date.now()+(m==='expired'?6000:1800000)).toISOString(),pixPaymentId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
if(name==='generate-pix'){if(m==='unknown')return {data:{success:false,status:'unknown',message:'Não foi possível confirmar o pagamento. Estamos verificando o resultado. Não tente pagar novamente agora.'},error:null};if(m==='local-failure')return {data:{success:true,status:'approved',orderConfirmed:false},error:null};return {data:qr,error:null};}
if(name==='check-pix-status'){window.__polls=(window.__polls||0)+1;if(m==='approved'&&window.__polls>=1)return {data:{status:'approved'},error:null};if(m==='expired')return {data:{status:'expired'},error:null};if(m==='rejected')return {data:{status:'cancelled'},error:null};return {data:{status:'pending'},error:null};}
throw new Error('Fixture forbids external functions');
}}''')

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for mode in ['approved','pending-refresh','expired','rejected','unknown','local-failure']:
   context=await browser.new_context(viewport={'width':1280,'height':1800}); page=await context.new_page(); logs=[]; errors=[]
   page.on('console',lambda msg: logs.append(msg.text));page.on('pageerror',lambda err:errors.append(str(err)))
   async def route_handler(route,page=page):
    req=route.request; url=req.url
    if not url.startswith('http://localhost:8080/') or req.method not in ['GET','HEAD']:
     await route.abort();return
    path=url.split('http://localhost:8080',1)[1]
    if path.startswith('/src/integrations/supabase/client.ts'):
     await route.fulfill(content_type='application/javascript',body=fixture);return
    if path.startswith('/src/hooks/useStoreEvents.tsx'):
     await route.fulfill(content_type='application/javascript',body='export const trackStoreEvent=()=>{};export const useStoreEvents=()=>({});');return
    if path.startswith('/src/lib/auditLog.ts'):
     await route.fulfill(content_type='application/javascript',body='export const logAuditEvent=()=>{};');return
    response=await page.request.get(url)
    if req.is_navigation_request():
     body=(await response.text()).replace('<head>',"<head><script>localStorage.setItem('vm_cookie_consent','true')</script>")
     await route.fulfill(response=response,body=body);return
    await route.fulfill(response=response)
   await context.route('**/*',route_handler)
   async def finalize():
    await page.evaluate('m=>{window.__pixMode=m}',mode)
    await page.get_by_label('Nome completo *',exact=True).fill('Cliente Fictício')
    await page.get_by_label('Telefone/WhatsApp *',exact=True).fill('00000000000')
    await page.get_by_role('radio',name='Pix',exact=True).click()
    await page.get_by_role('button',name='Finalizar compra',exact=True).first.click()
   await page.goto('http://localhost:8080/loja-a/produto/'+ids['PRODUCT_A'])
   await page.get_by_role('button',name='Adicionar ao Carrinho',exact=True).click()
   await page.get_by_role('button',name='Finalizar Compra',exact=True).click()
   await finalize()
   calls_total={'order':0,'generate':0}
   if mode in ['approved','local-failure']:
    await page.wait_for_url('**/pedido-confirmado/'+ids['ORDER_A'],timeout=20000)
   elif mode=='pending-refresh':
    await page.get_by_text('Pagamento via PIX',exact=True).wait_for()
    before=await page.evaluate('()=>({o:window.__orderRequests||0,g:(window.__fn||[]).filter(f=>f.name==="generate-pix").length})')
    await page.reload(); await page.get_by_label('Nome completo *',exact=True).wait_for()
    await finalize(); await page.get_by_text('Pagamento via PIX',exact=True).wait_for()
    after=await page.evaluate('()=>({o:window.__orderRequests||0,orders:window.__orderCalls||0,g:(window.__fn||[]).filter(f=>f.name==="generate-pix"),att:sessionStorage.length})')
    assert before['o']==1 and before['g']==1, before
    # after reload counters reset per page; same attempt reused -> server returns same order (single order proven in SQL suite)
    assert after['o']==1 and len(after['g'])==1 and after['g'][0]['orderId']==ids['ORDER_A'], after
    await page.wait_for_timeout(6000)
    assert await page.get_by_text('Pagamento via PIX',exact=True).is_visible()
   elif mode in ['expired','rejected']:
    await page.get_by_text('Pagamento via PIX',exact=True).wait_for(); await page.wait_for_timeout(7000)
   elif mode=='unknown':
    await page.get_by_text('Não foi possível confirmar o pagamento. Estamos verificando o resultado. Não tente pagar novamente agora.',exact=True).first.wait_for()
   st=await page.evaluate('()=>({fn:window.__fn||[],orders:window.__orderRequests||0,storage:JSON.stringify({l:{...localStorage}})})')
   gens=[f for f in st['fn'] if f['name']=='generate-pix']
   assert all(f['hasToken'] and not f['forged'] and f['orderId']==ids['ORDER_A'] for f in st['fn']), st['fn']
   assert len(gens)<=1, 'auto second PIX generation'
   assert 'a'*64 not in st['storage'], 'capability leaked to localStorage'
   assert 'a'*64 not in '\n'.join(logs)
   assert not errors, errors
   await page.screenshot(path=str(OUT/(mode+'.png')))
   print(json.dumps({'scenario':mode,'result':'passed','generate_calls':len(gens),'status_polls':len([f for f in st['fn'] if f['name']=='check-pix-status']),'hosted_writes':0,'real_payments':0,'url':page.url}))
   await context.close()
  await browser.close()
asyncio.run(main())
