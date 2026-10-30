import asyncio, re, json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent; OUT=Path('/tmp/browser/mercadopago-log-safety'); OUT.mkdir(parents=True, exist_ok=True)
fixture=re.search(r'const clientFixture = `([\s\S]*?)`;', (ROOT/'e2e/public-store-runtime.fixture.ts').read_text()).group(1)
ids={'STORE_A':'11111111-1111-4111-8111-111111111111','STORE_B':'22222222-2222-4222-8222-222222222222','PRODUCT_A':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRODUCT_B':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ORDER_A':'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}
for k,v in ids.items(): fixture=fixture.replace('${'+k+'}',v)
fixture=fixture.replace('pix_enabled:false,credit_card_enabled:false,boleto_enabled:false',"pix_enabled:true,pix_provider:'mercado_pago',credit_card_enabled:true,credit_card_provider:'mercado_pago',mercadopago_enabled:true,mercadopago_accepts_pix:true,mercadopago_accepts_credit:true,mercadopago_public_key:'fixture-public-key',boleto_enabled:true")
fixture=fixture.replace('window.__createdOrder=args;', 'window.__orderCalls=(window.__orderCalls||0)+1;window.__createdOrder=args;order.payment_method=args.p_payment_method;order.payment_status=args.p_payment_status;order.status=args.p_status;')
fixture=fixture.replace("functions:{invoke:async()=>{throw new Error('Fixture forbids external functions');}}",'''functions:{invoke:async(name,opts)=>{
if(name!=='process-credit-card')throw new Error('Fixture forbids external functions');
window.__paymentCalls=(window.__paymentCalls||0)+1;
window.__transportOk=opts.body.cardToken==='fixture-sdk-token-sentinel' && !('cardNumber' in opts.body) && !('securityCode' in opts.body) && !('cvv' in opts.body);
if(window.__cardMode==='backend-error')return {data:null,error:{message:'fixture-sensitive-error-sentinel fixture-sdk-token-sentinel',token:'fixture-sdk-token-sentinel'}};
if(window.__cardMode==='rejected')return {data:{status:'rejected',success:false,error:'fixture-sensitive-error-sentinel',token:'fixture-sdk-token-sentinel'},error:null};
return {data:{status:'approved',success:true,token:'fixture-sdk-token-sentinel'},error:null};
}}''')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for mode in ['approved','sdk-error','backend-error','rejected']:
   context=await browser.new_context(viewport={'width':1280,'height':1800}); page=await context.new_page(); logs=[]; errors=[]
   page.on('console',lambda msg: logs.append(msg.text));page.on('pageerror',lambda err:errors.append(str(err)))
   async def route_handler(route):
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
   await page.goto('http://localhost:8080/loja-a/produto/'+ids['PRODUCT_A'])
   await page.get_by_role('button',name='Adicionar ao Carrinho',exact=True).click()
   await page.get_by_role('button',name='Finalizar Compra',exact=True).click()
   await page.evaluate('''mode=>{window.__cardMode=mode;window.MercadoPago=class{constructor(key){window.__sdkInitialized=key==='fixture-public-key'}async createCardToken(){if(mode==='sdk-error')throw {message:'fixture-sensitive-error-sentinel',token:'fixture-sdk-token-sentinel',cause:[{description:'fixture-sdk-token-sentinel'}]};return {id:'fixture-sdk-token-sentinel'}}}}''',mode)
   await page.get_by_label('Nome completo *',exact=True).fill('Cliente Fictício')
   await page.get_by_label('Telefone/WhatsApp *',exact=True).fill('00000000000')
   assert await page.get_by_role('radio',name='Pix',exact=True).is_visible()
   assert await page.get_by_role('radio',name='Boleto bancário',exact=True).is_visible()
   await page.get_by_role('radio',name='Cartão de crédito',exact=True).click()
   await page.get_by_placeholder('0000 0000 0000 0000',exact=True).fill('4000000000000000')
   await page.get_by_placeholder('MM/AA',exact=True).fill('1299')
   await page.get_by_placeholder('123',exact=True).fill('000')
   await page.get_by_placeholder('NOME COMO ESTÁ NO CARTÃO',exact=True).fill('FICTICIO')
   await page.get_by_role('button',name='Pagar e finalizar',exact=True).click()
   if mode=='approved':
    await page.wait_for_url('http://localhost:8080/loja-a/pedido-confirmado/'+ids['ORDER_A'])
   else:
    msg={'sdk-error':'Erro ao processar cartão. Verifique os dados.','backend-error':'Erro ao processar pagamento','rejected':'Pagamento recusado pelo banco emissor'}[mode]
    await page.get_by_text(msg,exact=True).first.wait_for(state='visible')
   state=await page.evaluate('()=>({initialized:window.__sdkInitialized,transportOk:window.__transportOk,paymentCalls:window.__paymentCalls||0,orderCalls:window.__orderCalls||0,storage:JSON.stringify({local:{...localStorage},session:{...sessionStorage}})})')
   assert state['initialized'] is True
   assert state['paymentCalls']==(0 if mode=='sdk-error' else 1)
   assert state['orderCalls']==(1 if mode=='approved' else 0)
   if mode!='sdk-error': assert state['transportOk'] is True
   text=await page.locator('body').inner_text()
   for sentinel in ['fixture-sdk-token-sentinel','fixture-sensitive-error-sentinel']:
    assert sentinel not in '\n'.join(logs)
    assert sentinel not in text
    assert sentinel not in state['storage']
   assert not errors, 'Runtime errors in controlled checkout'
   await page.locator('input').evaluate_all("inputs=>inputs.forEach(input=>input.value='')")
   await page.screenshot(path=str(OUT/(mode+'.png')))
   print(json.dumps({'scenario':mode,'result':'passed','sdk_initialized':True,'token_transport_verified':mode!='sdk-error','payment_calls_simulated':state['paymentCalls'],'order_calls_simulated':state['orderCalls'],'sensitive_console_or_storage':False,'hosted_writes':0,'real_payments':0}))
   await context.close()
  await browser.close()
asyncio.run(main())
