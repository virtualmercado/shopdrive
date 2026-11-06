import asyncio,re,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
ORIGIN='http://localhost:8080'
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222'
MAIN="""
import '/src/index.css';import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import {BrowserRouter,useLocation} from '/node_modules/.vite/deps/react-router-dom.js';import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';import {MerchantStoreProvider} from '/src/contexts/MerchantStoreContext.tsx';import {useMerchantStore} from '/src/hooks/useMerchantStore.tsx';import {StoreSwitcher,ManagedStores} from '/src/components/network/ManagedStores.tsx';import {useOrders} from '/src/hooks/useOrders.tsx';
const h=React.createElement;function Probe(){let s=useMerchantStore(),l=useLocation(),o=useOrders();return h('main',null,h(StoreSwitcher),h(ManagedStores),h('div',{'data-testid':'active'},s.store?.storeName),h('div',{'data-testid':'path'},l.pathname),h('a',{href:s.store?.publicUrl},s.store?.publicUrl),h('div',{'data-testid':'orders'},JSON.stringify(o.data)));}
ReactDOM.createRoot(document.getElementById('root')).render(h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},h(BrowserRouter,null,h(MerchantStoreProvider,null,h(Probe)))));
"""
AUTH="""export const useAuthContext=()=>({user:{id:'%s'},loading:false});"""%A
CLIENT="""
const A='%s',B='%s';const stores=[{storeId:A,storeName:'Loja A',storeSlug:'fixture-a',publicUrl:'https://shopdrive.com.br/fixture-a',plan:'marca',storeRole:'primary'},{storeId:B,storeName:'Loja B',storeSlug:'fixture-b',publicUrl:'https://shopdrive.com.br/fixture-b',plan:'premium',storeRole:'secondary'}];
window.__writes=[];function make(s){return {auth:{getSession:async()=>({data:{session:{user:{id:A},access_token:'synthetic-not-real'}}})},rpc:async(n,a)=>({data:n==='get_my_store_context'?stores.find(x=>x.storeId===a.p_store_id):n==='get_my_managed_marca_stores'?stores:null,error:null}),from:t=>{let selected=s;const q={select(){return q},eq(c,v){if(c==='store_owner_id')selected=v;return q},order(){return q},range(){return q},then(r,j){return Promise.resolve({data:[{id:selected,customer_name:selected===A?'Cliente A':'Cliente B'}],error:null}).then(r,j)},update(){window.__writes.push(t);throw Error('Writes forbidden')},insert(){window.__writes.push(t);throw Error('Writes forbidden')}};return q}}};export const supabase=make(A);export const fixtureClient=make;
"""%(A,B)
SCOPED="import {fixtureClient} from '/src/integrations/supabase/client.ts';export const createMerchantScopedClient=(actor,store)=>fixtureClient(store);"
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True);context=await browser.new_context(viewport={'width':1280,'height':1800})
  source=await (await context.request.get(ORIGIN+'/src/contexts/MerchantStoreContext.tsx')).text()+await (await context.request.get(ORIGIN+'/src/hooks/useMerchantStore.tsx')).text()+await (await context.request.get(ORIGIN+'/src/components/network/ManagedStores.tsx')).text();mainjs=MAIN
  for path,stamp in re.findall(r'(/src/[^\"?]+)\?t=([^\"\s]+)',source):mainjs=mainjs.replace(path+"'",path+'?t='+stamp+"'")
  for path,version in re.findall(r'(/node_modules/\.vite/deps/[^"?]+)\?v=([^"\s]+)',source):mainjs=mainjs.replace(path+"'",path+'?v='+version+"'")
  overrides={'/src/main.tsx':mainjs,'/src/contexts/AuthContext.tsx':AUTH,'/src/integrations/supabase/client.ts':CLIENT,'/src/lib/merchantScopedClient.ts':SCOPED}
  async def intercept(route):
   r=route.request
   if not r.url.startswith(ORIGIN+'/') or r.method not in ['GET','HEAD']:await route.abort();return
   path=r.url[len(ORIGIN):].split('?')[0]
   if path in overrides:await route.fulfill(content_type='application/javascript',body=overrides[path]);return
   response=await context.request.get(r.url);await route.fulfill(response=response)
  await context.route('**/*',intercept);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(ORIGIN+'/lojista/orders');await expect(page.get_by_test_id('active')).to_have_text('Loja A')
  await expect(page.get_by_test_id('orders')).to_contain_text('Cliente A')
  await page.get_by_role('button',name='Trocar loja').click();await page.get_by_role('menuitem',name='Loja B').click()
  await expect(page.get_by_test_id('active')).to_have_text('Loja B');await expect(page.get_by_test_id('path')).to_have_text('/lojista')
  await expect(page.get_by_test_id('orders')).to_contain_text('Cliente B');await expect(page.get_by_test_id('orders')).not_to_contain_text('Cliente A')
  await expect(page.get_by_role('link',name='https://shopdrive.com.br/fixture-b').last).to_be_visible()
  assert not await page.evaluate('window.__writes');assert not errors,errors
  await page.screenshot(path='/tmp/browser/marca/switch.png');print('PASS real provider/switcher: authorized A to B, Dashboard navigation, orders cache isolation, updated link, zero writes/errors')
  await browser.close()
asyncio.run(main())
