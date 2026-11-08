"""Delegated MARCA store regression for the eight authorized merchant modules.

Mounts the real route guard, store provider, scoped client wrapper, layout and pages
with a synthetic actor (store A) administering store B. Every backend call is captured
by local fakes; no hosted request, real account, credential, write or charge is possible.
"""
import asyncio
import json
import re
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
PAGES = {
    "/lojista": "Dashboard", "/lojista/products": "Products", "/lojista/orders": "Orders",
    "/lojista/customers": "Customers", "/lojista/store": "StorePreviewEnhanced",
    "/lojista/customize": "Customize", "/lojista/payment-methods": "PaymentMethods",
    "/lojista/financeiro": "Financeiro",
}
TENANT_TABLES = {
    "products", "orders", "order_items", "store_customers", "customer_profiles", "customer_addresses",
    "customer_groups", "customer_group_assignments", "quotes", "quote_items", "product_categories",
    "product_brands", "product_images", "store_events", "payment_settings", "profiles", "invoices",
    "master_subscriptions", "shipping_rules", "plan_trials", "store_onboarding_state",
}

routes = "".join(
    f"h(Route,{{path:'{path}',element:h(MerchantRoute,null,h({name}))}}),"
    for path, name in PAGES.items()
)
imports = "".join(f"import {name} from '/src/pages/dashboard/{name}.tsx';" for name in PAGES.values())
MAIN = (
    "import '/src/index.css';import React from '/node_modules/.vite/deps/react.js';"
    "import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';"
    "import {BrowserRouter,Routes,Route} from '/node_modules/.vite/deps/react-router-dom.js';"
    "import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';"
    "import {MerchantStoreProvider} from '/src/contexts/MerchantStoreContext.tsx';"
    "import {MerchantRoute} from '/src/components/MerchantRoute.tsx';" + imports +
    "const h=React.createElement;ReactDOM.createRoot(document.getElementById('root')).render("
    "h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},"
    "h(BrowserRouter,null,h(MerchantStoreProvider,null,h(Routes,null," + routes + ")))));"
)
AUTH = f"""
const user={{id:'{A}',email:'actor@example.invalid'}};
export const AuthProvider=({{children}})=>children;
export const useAuthContext=()=>({{user,session:{{user,access_token:'synthetic-not-real'}},loading:false,profileStatus:'complete',
 isMerchant:true,isTemplateProfile:false,storeSlug:'fixture-a',refreshProfile:async()=>{{}}}});
"""
FAKE = f"""
const A='{A}',B='{B}';
window.__log=window.__log||[];
const stores=[{{storeId:A,storeName:'Loja A',storeSlug:'fixture-a',publicUrl:'https://shopdrive.com.br/fixture-a',plan:'marca',storeRole:'primary',status:'active'}},
 {{storeId:B,storeName:'Loja B',storeSlug:'fixture-b',publicUrl:'https://shopdrive.com.br/fixture-b',plan:'premium',storeRole:'secondary',status:'active'}}];
const profile=id=>({{id,store_name:id===A?'Loja A':'Loja B',store_slug:id===A?'fixture-a':'fixture-b',email:'fixture@example.invalid',
 primary_color:'#6a1b9a',secondary_color:'#FB8C00',banner_desktop_urls:[],banner_mobile_urls:[],content_banners:[],main_banner_content:[]}});
const rows={{
 profiles:[profile(A),profile(B)],merchant_store_profiles:[profile(B)],
 products:[A,B].map(s=>({{id:s===A?'aaaaaaaa-0000-4000-8000-00000000000a':'bbbbbbbb-0000-4000-8000-00000000000b',user_id:s,
  name:s===A?'Produto A':'Produto B',price:10,stock:3,is_active:true,images:[],image_url:null,created_at:'2026-11-01T00:00:00Z'}})),
 orders:[A,B].map(s=>({{id:s===A?'aaaaaaaa-1111-4000-8000-00000000000a':'bbbbbbbb-1111-4000-8000-00000000000b',store_owner_id:s,
  order_number:s===A?'A-1':'B-1',customer_name:s===A?'Cliente A':'Cliente B',customer_email:'c@example.invalid',total_amount:10,
  status:'pending',order_source:'manual',created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z'}})),
 store_customers:[A,B].map(s=>({{id:s,store_owner_id:s,customer_id:s===A?'aaaaaaaa-2222-4000-8000-00000000000a':'bbbbbbbb-2222-4000-8000-00000000000b',is_active:true,origin:'manual'}})),
 customer_profiles:[{{id:'aaaaaaaa-2222-4000-8000-00000000000a',full_name:'Cliente A',created_at:'2026-11-01T00:00:00Z'}},
  {{id:'bbbbbbbb-2222-4000-8000-00000000000b',full_name:'Cliente B',created_at:'2026-11-01T00:00:00Z'}}],
 merchant_store_payment_settings:[{{id:'bbbbbbbb-3333-4000-8000-00000000000b',user_id:B,pix_enabled:false,credit_card_enabled:false,boleto_enabled:false}}],
}};
function query(client,store,table){{
 const entry={{client,store,kind:'from',name:table,filters:[],write:null,payload:null}};window.__log.push(entry);
 let one=false;
 const q={{
  then(resolve,reject){{
   let data=(rows[table]||[]).filter(r=>entry.filters.every(([op,c,v])=>!(c in r)||(op==='eq'?r[c]===v:op==='in'?v.includes(r[c]):true)));
   if(entry.write) data=entry.write==='update'?[{{...data[0],...entry.payload}}]:[entry.payload];
   return Promise.resolve({{data:one?(data[0]??null):data,error:null,count:data.length}}).then(resolve,reject);
  }},
  single(){{one=true;return q}},maybeSingle(){{one=true;return q}},
 }};
 for(const op of ['eq','neq','in','gte','lte','lt','gt','is','ilike','like','contains','not','or','match','filter'])
  q[op]=(c,v)=>{{entry.filters.push([op,c,v]);return q}};
 for(const op of ['select','order','limit','range','csv','abortSignal','returns']) q[op]=()=>q;
 for(const op of ['insert','update','upsert','delete']) q[op]=p=>{{entry.write=op;entry.payload=p??null;return q}};
 return q;
}}
export function makeClient(client,store){{
 return {{
  from:t=>query(client,store,t),
  rpc:async(name,args)=>{{window.__log.push({{client,store,kind:'rpc',name,args:args??null}});
   if(name==='get_my_store_context')return {{data:stores.find(s=>s.storeId===args.p_store_id)??null,error:null}};
   if(name==='get_my_managed_marca_stores')return {{data:stores,error:null}};
   if(name==='get_product_plan_usage')return {{data:{{plan:'premium',activeProducts:1,planSource:'direct',ownedStoreRole:store===B?'secondary':'primary'}},error:null}};
   return {{data:null,error:null}};}},
  storage:{{from:bucket=>({{upload:async(p)=>{{window.__log.push({{client,store,kind:'storage',name:bucket,payload:p}});return {{data:{{path:p}},error:null}}}},
   getPublicUrl:p=>({{data:{{publicUrl:'https://fixture.invalid/'+p}}}}),remove:async()=>({{data:null,error:null}}),list:async()=>({{data:[],error:null}})}})}},
  functions:{{invoke:async(name,o)=>{{window.__log.push({{client,store,kind:'invoke',name,args:o?.body??null}});return {{data:null,error:null}}}}}},
  channel:()=>{{const c={{on(){{return c}},subscribe(){{return c}}}};return c}},removeChannel:()=>{{}},
  auth:{{getSession:async()=>({{data:{{session:{{user:{{id:A}},access_token:'synthetic-not-real'}}}},error:null}}),
   getUser:async()=>({{data:{{user:{{id:A}}}},error:null}}),onAuthStateChange:()=>({{data:{{subscription:{{unsubscribe(){{}}}}}}}}),
   refreshSession:async()=>({{data:{{session:null}},error:null}}),signOut:async()=>({{error:null}})}},
 }};
}}
export const supabase=makeClient('base',null);
"""
SUPABASE_JS = (
    "import {makeClient} from '/src/integrations/supabase/client.ts';"
    "export const createClient=(u,k,o)=>makeClient('scoped',o?.global?.headers?.['x-shopdrive-store-id']??null);"
)


async def stamped_main(context):
    """Match Vite's dependency versions and HMR stamps so modules are not duplicated."""
    sources = ""
    for path in ["/src/contexts/MerchantStoreContext.tsx", "/src/components/MerchantRoute.tsx",
                 "/src/components/layout/DashboardLayout.tsx", "/src/hooks/useMerchantStore.tsx",
                 *[f"/src/pages/dashboard/{n}.tsx" for n in PAGES.values()]]:
        sources += await (await context.request.get(ORIGIN + path)).text()
    main = MAIN
    for path, version in set(re.findall(r'(/node_modules/\.vite/deps/[^"?]+)\?v=([^"\s]+)', sources)):
        main = main.replace(path + "'", path + "?v=" + version + "'")
    for path, stamp in set(re.findall(r'(/src/[^"?]+)\?t=(\d+)', sources)):
        main = main.replace(path + "'", path + "?t=" + stamp + "'")
    return main


def violations(log):
    found = []
    for entry in log:
        text = json.dumps(entry)
        if entry["client"] == "scoped":
            if entry["store"] != B:
                found.append(("scoped client bound to wrong store", entry))
            if entry["kind"] == "from" and entry["name"] in {"profiles", "payment_settings", "master_subscriptions"}:
                found.append(("raw account table via delegated client", entry))
            if A in text:
                found.append(("delegated call references actor store", entry))
        elif entry["kind"] == "from" and entry["name"] in TENANT_TABLES and A in text:
            found.append(("tenant table read/write for actor store while store B is selected", entry))
        if entry.get("write") and entry["client"] != "scoped":
            found.append(("tenant write outside delegated client", entry))
    return found


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        overrides = {"/src/main.tsx": await stamped_main(context), "/src/contexts/AuthContext.tsx": AUTH,
                     "/src/integrations/supabase/client.ts": FAKE,
                     "/node_modules/.vite/deps/@supabase_supabase-js.js": SUPABASE_JS}
        blocked = []

        async def intercept(route):
            request = route.request
            if not request.url.startswith(ORIGIN + "/") or request.method not in ("GET", "HEAD"):
                blocked.append(request.method + " " + request.url.split("?")[0])
                await route.abort()
                return
            path = request.url[len(ORIGIN):].split("?")[0]
            if path in overrides:
                await route.fulfill(content_type="application/javascript", body=overrides[path])
                return
            await route.fulfill(response=await context.request.get(request.url))

        await context.route("**/*", intercept)
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(ORIGIN + "/lojista")
        await page.evaluate("([a,b]) => sessionStorage.setItem('shopdrive_selected_store:'+a, b)", [A, B])

        expectations = {"/lojista/products": "Produto B", "/lojista/orders": "Cliente B", "/lojista/customers": "Cliente B",
                        "/lojista/financeiro": "Esta loja está vinculada ao Plano MARCA da empresa."}
        for path in PAGES:
            await page.goto(ORIGIN + path)
            await expect(page.get_by_text("Seu Link:")).to_be_visible(timeout=15000)
            await expect(page.get_by_role("link", name=re.compile(r"fixture-b$")).first).to_be_visible()
            if path in expectations:
                await expect(page.get_by_text(expectations[path]).first).to_be_visible()
            await page.wait_for_timeout(600)
            for forbidden in ["Produto A", "Cliente A", "fixture-a"]:
                assert await page.get_by_text(forbidden, exact=True).count() == 0, (path, forbidden)
            print("PASS", PAGES[path], "shows only store B")

        await page.goto(ORIGIN + "/lojista/customize")
        await page.get_by_role("button", name="Salvar Alterações").click()
        await page.goto(ORIGIN + "/lojista/store")
        await page.get_by_role("button", name=re.compile("Salvar")).last.click()
        await page.goto(ORIGIN + "/lojista/payment-methods")
        await page.get_by_role("button", name="Salvar Configurações").click()
        await page.wait_for_timeout(800)
        await page.goto(ORIGIN + "/lojista/settings")
        await expect(page.get_by_text("Esta área pertence à conta principal.")).to_be_visible()
        await page.screenshot(path="/tmp/browser/marca/delegated-denied.png")

        log = await page.evaluate("window.__log")
        writes = [e for e in log if e.get("write")]
        profile_writes = [e for e in writes if e["name"] == "merchant_store_profiles"]
        payment_writes = [e for e in writes if e["name"] == "merchant_store_payment_settings"]
        assert len(profile_writes) >= 2, writes
        assert all(["eq", "id", B] in e["filters"] for e in profile_writes), profile_writes
        assert all(not ({"email", "store_slug"} & set(e["payload"] or {})) for e in profile_writes), profile_writes
        assert payment_writes and all(not any("token" in k or "secret" in k for k in (e["payload"] or {})) for e in payment_writes)
        problems = violations(log)
        account_calls = sorted({e["kind"] + ":" + e["name"] for e in log if e["client"] == "base" and A in json.dumps(e)})
        print("Account-scoped calls kept on the real actor:", account_calls)
        assert not problems, json.dumps(problems[:5], indent=1)
        assert not blocked, blocked
        assert not errors, errors
        print(f"PASS {len(log)} captured backend calls: store B only, account data/credentials never delegated, "
              "settings saved through operational projections, unsupported route denied, zero hosted requests")
        await browser.close()


asyncio.run(main())
