import asyncio, re, json
from pathlib import Path
from playwright.async_api import async_playwright
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222';P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';PB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';O='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
source=Path(__file__).resolve().parent.joinpath('public-store-runtime.fixture.ts').read_text()
client=re.search(r'const clientFixture = `(.*?)`;\n',source,re.S).group(1)
for key,value in [('STORE_A',A),('STORE_B',B),('PRODUCT_A',P),('PRODUCT_B',PB),('ORDER_A',O)]:client=client.replace('${'+key+'}',value)
EXT='http://loja-piloto.exemplo';LOCAL='http://localhost:8080';passed=[]
async def fixture(browser,origin=EXT,resolution='valid',mobile=False):
 context=await browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':1800});page=await context.new_page();page.set_default_navigation_timeout(60000);original_goto=page.goto;page.goto=lambda url:original_goto(url,wait_until='domcontentloaded');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 async def route_handler(route):
  from urllib.parse import urlsplit
  req=route.request;u=urlsplit(req.url);base=u.scheme+'://'+u.netloc
  if base!=origin or req.method not in ['GET','HEAD']:await route.abort();return
  if u.path=='/src/integrations/supabase/client.ts':await route.fulfill(content_type='application/javascript',body=client);return
  if u.path=='/src/hooks/useStoreEvents.tsx':await route.fulfill(content_type='application/javascript',body='export const trackStoreEvent=()=>{};export const useStoreEvents=()=>({});');return
  if u.path=='/src/lib/auditLog.ts':await route.fulfill(content_type='application/javascript',body='export const logAuditEvent=()=>{};');return
  response=await page.request.get(LOCAL+u.path+('?' +u.query if u.query else ''))
  if req.is_navigation_request():
   body=(await response.text()).replace('<head>','<head><script>window.__resolution='+json.dumps(resolution)+";localStorage.setItem('vm_cookie_consent','true');</script>");await route.fulfill(response=response,body=body);return
  await route.fulfill(response=response)
 await page.route('**/*',route_handler);return context,page,errors
async def visible(loc):await loc.wait_for(state='visible',timeout=15000)
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True)
  context,page,errors=await fixture(browser)
  await page.goto(EXT+'/');await visible(page.get_by_role('heading',name='Produto A',exact=True));await page.screenshot(path='/tmp/browser/hostname-runtime/start.png');passed.append('custom home STORE_A')
  await page.get_by_role('link').filter(has=page.get_by_role('heading',name='Produto A',exact=True)).click();assert page.url==EXT+'/produto/'+P;await visible(page.get_by_role('heading',name='Produto A',exact=True))
  await page.get_by_role('button',name='Adicionar ao Carrinho',exact=True).click();await visible(page.get_by_role('heading',name='Carrinho de Compras'));await page.screenshot(path='/tmp/browser/hostname-runtime/cart.png')
  await page.get_by_role('button',name='Finalizar Compra',exact=True).click();assert page.url==EXT+'/checkout'
  await page.get_by_label('Nome completo *',exact=True).fill('Cliente Fictício');await page.get_by_label('Telefone/WhatsApp *',exact=True).fill('00000000000')
  await page.get_by_text('Combinar via WhatsApp',exact=True).click();await page.get_by_role('button',name='Finalizar compra',exact=True).click();await page.wait_for_url(EXT+'/pedido-confirmado/'+O);await visible(page.get_by_text('TESTE-001',exact=True));await visible(page.get_by_text('Produto A',exact=True));await page.screenshot(path='/tmp/browser/hostname-runtime/order.png')
  assert await page.evaluate('window.__createdOrder.p_store_owner_id')==A;assert await page.evaluate('window.__createdOrder.p_items[0].product_id')==P;assert not await page.evaluate('window.__forbidden');assert not errors,errors;passed.append('product → cart → checkout → mocked order readback')
  await page.evaluate("sessionStorage.setItem('vm_active_store_slug','loja-b')")
  await page.goto(EXT+'/buscar?q=produto&storeSlug=loja-b&store_id='+B);await visible(page.get_by_role('heading',name='Produto A',exact=True));assert await page.get_by_text('Produto B',exact=True).count()==0;assert await page.evaluate("window.__calls.find(c=>c.rpc==='search_store_products').args.p_store_slug")=='loja-a';passed.append('search ignores query/storage/store B')
  await page.goto(EXT+'/loja-b');await visible(page.get_by_role('heading',name='Página não encontrada.'));assert not await page.evaluate("window.__calls.filter(c=>c.table==='public_store_profiles')")
  await page.goto(EXT+'/produto/'+PB);await visible(page.get_by_role('heading',name='Produto não encontrado'));assert ['user_id',A] in await page.evaluate("window.__calls.find(c=>c.table==='products').filters");passed.append('slug and other-store product blocked')
  await page.evaluate("([id,store])=>sessionStorage.setItem('shopdrive_checkout_order:'+id,JSON.stringify({order:{store_owner_id:store,order_number:'OTHER-STORE'}}))",[PB,B]);await page.goto(EXT+'/pedido-confirmado/'+PB);await visible(page.get_by_role('heading',name='Pedido não encontrado'));assert ['store_owner_id',A] in await page.evaluate("window.__calls.find(c=>c.table==='orders').filters");passed.append('cross-store order cache rejected')
  await context.close()
  for mode in ['zero','error','malformed']:
   context,page,errors=await fixture(browser,resolution=mode)
   for path in ['/','/loja-b','/loja-b/produto/P','/gestor','/login']:
    await page.goto(EXT+path);await visible(page.get_by_role('heading',name='Esta loja não está disponível neste domínio.'));assert not await page.evaluate('window.__calls.filter(c=>c.table)');assert 'private infrastructure details' not in await page.locator('body').inner_text()
   await page.screenshot(path=f'/tmp/browser/hostname-runtime/{mode}.png');passed.append(mode+' fail closed all paths');await context.close()
  context,page,errors=await fixture(browser,resolution='delay');await page.goto(EXT+'/loja-b');await visible(page.get_by_role('status'));assert not await page.evaluate('window.__calls.filter(c=>c.table)');await visible(page.get_by_role('heading',name='Página não encontrada.'));passed.append('loading no tenant/landing flash');await context.close()
  context,page,errors=await fixture(browser)
  for path in ['/produtos','/categoria/C','/promocoes','/marca/M','/sobre-nos','/trocas-e-devolucoes','/auth']:
   await page.goto(EXT+path)
   if path=='/marca/M':await visible(page.get_by_role('heading',name='Marca não encontrada'))
   else:await visible(page.locator('header'))
   calls=await page.evaluate("window.__calls.filter(c=>c.table==='public_store_profiles')");assert any(['id',A] in c['filters'] for c in calls),path
  await page.goto(EXT+'/conta?tab=pedidos');await page.wait_for_url(re.compile('/auth\\?redirect='));await page.get_by_label('E-mail',exact=True).fill('fixture@example.invalid');await page.get_by_label('Senha',exact=True).fill('fixture-only-password');await page.get_by_role('button',name='Entrar',exact=True).click();await page.wait_for_url(EXT+'/conta?tab=pedidos');await visible(page.get_by_role('heading',name='Meus Pedidos',exact=True));await page.screenshot(path='/tmp/browser/hostname-runtime/account.png');await visible(page.get_by_text('TESTE-001',exact=True));await page.get_by_text('TESTE-001',exact=True).click();await visible(page.get_by_role('dialog'));await visible(page.get_by_role('dialog').get_by_text('Produto A',exact=True));await page.screenshot(path='/tmp/browser/hostname-runtime/account-order.png');passed.append('institutional pages and authenticated account order readback STORE_A');assert not errors,errors;await page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click();await page.goto(EXT+'/produto/'+P);await page.get_by_role('button',name='Adicionar ao Carrinho',exact=True).click();await page.get_by_role('button',name='Finalizar Compra',exact=True).click();await visible(page.get_by_role('button',name='Editar dados',exact=True));
  async with page.expect_popup() as popup_info:await page.get_by_role('button',name='Editar dados',exact=True).click()
  popup=await popup_info.value;assert popup.url==EXT+'/conta';await popup.close()
  passed.append('authenticated checkout Editar dados popup is slugless');await context.close()
  context,page,errors=await fixture(browser,origin=LOCAL)
  await page.goto(LOCAL+'/loja/loja-a?origem=legado');await page.wait_for_url(LOCAL+'/loja-a?origem=legado');await visible(page.get_by_role('heading',name='Produto A',exact=True));link=page.get_by_role('link').filter(has=page.get_by_role('heading',name='Produto A',exact=True));assert await link.get_attribute('href')=='/loja-a/produto/'+P
  await page.goto(LOCAL+'/loja-a/produto/'+P);await page.get_by_role('button',name='Adicionar ao Carrinho',exact=True).click();await page.get_by_role('button',name='Finalizar Compra',exact=True).click();assert page.url==LOCAL+'/loja-a/checkout';await visible(page.get_by_label('Nome completo *',exact=True));await page.goto(LOCAL+'/loja-b/checkout');await visible(page.get_by_role('heading',name='Carrinho vazio'));await page.goto(LOCAL+'/buscar?q=produto');await visible(page.get_by_role('heading',name='Produto A',exact=True));assert not await page.evaluate("window.__calls.filter(c=>c.rpc==='resolve_public_store_by_domain')");passed.append('platform slug routes/search/cart/checkout/legacy preserved');await page.goto(LOCAL+'/loja-a/conta?tab=pedidos');await page.wait_for_url(re.compile('/loja-a/auth\\?redirect='));await page.get_by_label('E-mail',exact=True).fill('fixture@example.invalid');await page.get_by_label('Senha',exact=True).fill('fixture-only-password');await page.get_by_role('button',name='Entrar',exact=True).click();await page.wait_for_url(LOCAL+'/loja-a/conta?tab=pedidos');await visible(page.get_by_text('TESTE-001',exact=True));passed.append('platform auth/account retain slug and scoped order');await context.close()
  context,page,errors=await fixture(browser,mobile=True);await page.goto(EXT+'/produto/'+P);await page.evaluate("sessionStorage.setItem('vm_active_store_slug','loja-b');localStorage.setItem('shopdrive-cart-v2:loja-b',JSON.stringify({version:2,storeKey:'loja-b',items:[{id:'OTHER',name:'Produto B',price:50,quantity:1}]}))")
  await page.get_by_role('button',name='Adicionar ao Carrinho',exact=True).click();cart=await page.evaluate("JSON.parse(localStorage.getItem('shopdrive-cart-v2:loja-a'))");assert cart['storeKey']=='loja-a' and cart['items'][0]['id']==P;assert await page.get_by_text('Produto B',exact=True).count()==0;await visible(page.get_by_role('heading',name='Carrinho de Compras'));await page.wait_for_timeout(600);await page.screenshot(path='/tmp/browser/hostname-runtime/mobile-cart.png');await page.get_by_role('button',name='Finalizar Compra',exact=True).click();assert page.url==EXT+'/checkout';passed.append('mobile trusted cart isolation and links');await context.close()
  for host in ['https://shopdrive.com.br','https://www.shopdrive.com.br','https://virtualmercado.lovable.app','https://id-preview--9f6c1d8d-8e82-428c-a496-b3fa1dba56be.lovable.app']:
   context,page,errors=await fixture(browser,origin=host);await page.goto(host+'/loja-a');await visible(page.get_by_role('heading',name='Produto A',exact=True));assert not await page.evaluate("window.__calls.filter(c=>c.rpc==='resolve_public_store_by_domain')");assert await page.get_by_role('link').filter(has=page.get_by_role('heading',name='Produto A',exact=True)).get_attribute('href')=='/loja-a/produto/'+P;passed.append('official host '+host+' preserves slug');await context.close()
  await browser.close()
 print(json.dumps({'passed':len(passed),'checks':passed},ensure_ascii=False,indent=2))
try:asyncio.run(main())
except Exception:
 print('Completed checks:',passed)
 raise
