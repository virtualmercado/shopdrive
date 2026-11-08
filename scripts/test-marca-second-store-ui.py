"""Browser regression for "Minha Rede -> Minhas Lojas -> Criar segunda loja".

Mounts the real MerchantStoreProvider, ManagedStores and CreateSecondStore with a synthetic actor.
Every backend call is answered by local fakes and every non-GET or external request is aborted:
no hosted account, store, e-mail, credential or charge can be touched.
"""
import asyncio, json, re
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
A = "11111111-1111-4111-8111-111111111111"
N = "99999999-9999-4999-8999-999999999999"
MAIN = (
    "import '/src/index.css';import React from '/node_modules/.vite/deps/react.js';"
    "import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';"
    "import {BrowserRouter} from '/node_modules/.vite/deps/react-router-dom.js';"
    "import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';"
    "import {MerchantStoreProvider} from '/src/contexts/MerchantStoreContext.tsx';"
    "import {ManagedStores} from '/src/components/network/ManagedStores.tsx';"
    "import {Toaster} from '/src/components/ui/sonner.tsx';"
    "const h=React.createElement;ReactDOM.createRoot(document.getElementById('root')).render("
    "h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},"
    "h(BrowserRouter,null,h(MerchantStoreProvider,null,h(ManagedStores),h(Toaster)))));"
)
AUTH = f"""
const user={{id:'{A}',email:'actor@example.invalid'}};
export const AuthProvider=({{children}})=>children;
export const useAuthContext=()=>({{user,session:{{user,access_token:'synthetic-not-real'}},loading:false,profileStatus:'complete',
 isMerchant:true,isTemplateProfile:false,storeSlug:'fixture-a',refreshProfile:async()=>{{}}}});
"""
FAKE = f"""
const A='{A}',N='{N}';
window.__log=window.__log||[];
const full=new URLSearchParams(location.search).get('s')==='full';
const st={{stores:[{{storeId:A,storeName:'Loja A',storeSlug:'fixture-a',publicUrl:'https://shopdrive.com.br/fixture-a',plan:'marca',storeRole:'primary',status:'active'}}]}};
if(full) st.stores.push({{storeId:'22222222-2222-4222-8222-222222222222',storeName:'Loja B',storeSlug:'fixture-b',publicUrl:'https://shopdrive.com.br/fixture-b',plan:'marca',storeRole:'secondary',status:'active'}});
const slots=()=>({{eligible:true,used:st.stores.length,limit:2,canCreate:st.stores.length<2,pending:false}});
export function makeClient(client,store){{
 return {{
  from:t=>{{window.__log.push({{client,kind:'from',name:t}});const q={{then:r=>Promise.resolve({{data:[],error:null}}).then(r)}};
   for(const op of ['select','eq','in','order','limit','single','maybeSingle']) q[op]=()=>q; return q;}},
  rpc:async(name,args)=>{{window.__log.push({{client,kind:'rpc',name,args:args??null}});
   if(name==='get_my_store_context')return {{data:st.stores.find(s=>s.storeId===args.p_store_id)??null,error:null}};
   if(name==='get_my_managed_marca_stores')return {{data:st.stores,error:null}};
   if(name==='get_my_marca_store_slots')return {{data:slots(),error:null}};
   return {{data:null,error:null}};}},
  functions:{{invoke:async(name,o)=>{{window.__log.push({{client,kind:'invoke',name,args:o?.body??null}});
   await new Promise(r=>setTimeout(r,400));
   if(name==='create-marca-second-store'){{
    if(st.stores.length>=2) return {{data:null,error:{{context:new Response(JSON.stringify({{status:'limit_reached'}}),{{status:409}})}}}};
    st.stores.push({{storeId:N,storeName:o.body.storeName,storeSlug:'loja-nova',publicUrl:'https://shopdrive.com.br/loja-nova',plan:'marca',storeRole:'secondary',status:'active'}});
    return {{data:{{status:'completed',storeId:N,accessEmailSent:true}},error:null}};
   }}
   return {{data:null,error:null}}}}}},
  channel:()=>{{const c={{on(){{return c}},subscribe(){{return c}}}};return c}},removeChannel:()=>{{}},
  auth:{{getSession:async()=>({{data:{{session:{{user:{{id:A}},access_token:'synthetic-not-real'}}}},error:null}}),
   getUser:async()=>({{data:{{user:{{id:A}}}},error:null}}),onAuthStateChange:()=>({{data:{{subscription:{{unsubscribe(){{}}}}}}}}),
   setSession:async()=>{{window.__log.push({{client,kind:'auth',name:'setSession'}});return {{error:null}}}},
   signOut:async()=>{{window.__log.push({{client,kind:'auth',name:'signOut'}});return {{error:null}}}}}},
 }};
}}
export const supabase=makeClient('base',null);
"""
SUPABASE_JS = "import {makeClient} from '/src/integrations/supabase/client.ts';export const createClient=(u,k,o)=>makeClient('scoped',o?.global?.headers?.['x-shopdrive-store-id']??null);"

async def stamped_main(context):
    sources = ""
    for path in ["/src/contexts/MerchantStoreContext.tsx", "/src/components/network/ManagedStores.tsx",
                 "/src/components/network/CreateSecondStore.tsx", "/src/components/ui/sonner.tsx", "/src/hooks/useMerchantStore.tsx"]:
        sources += await (await context.request.get(ORIGIN + path)).text()
    main = MAIN
    for path, version in set(re.findall(r'(/node_modules/\.vite/deps/[^"?]+)\?v=([^"\s]+)', sources)):
        main = main.replace(path + "'", path + "?v=" + version + "'")
    for path, stamp in set(re.findall(r'(/src/[^"?]+)\?t=(\d+)', sources)):
        main = main.replace(path + "'", path + "?t=" + stamp + "'")
    return main

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        overrides = {"/src/main.tsx": await stamped_main(context), "/src/contexts/AuthContext.tsx": AUTH,
                     "/src/integrations/supabase/client.ts": FAKE, "/node_modules/.vite/deps/@supabase_supabase-js.js": SUPABASE_JS}
        blocked = []
        async def intercept(route):
            r = route.request
            if not r.url.startswith(ORIGIN + "/") or r.method not in ("GET", "HEAD"):
                blocked.append(r.method + " " + r.url.split("?")[0]); await route.abort(); return
            path = r.url[len(ORIGIN):].split("?")[0]
            if path in overrides:
                await route.fulfill(content_type="application/javascript", body=overrides[path]); return
            await route.fulfill(response=await context.request.get(r.url))
        await context.route("**/*", intercept)
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1) Account already with two stores: limit shown immediately, no form, no creation call.
        await page.goto(ORIGIN + "/lojista/minha-rede?s=full")
        await expect(page.get_by_text("Limite de 2 lojas do Plano MARCA atingido.")).to_be_visible(timeout=15000)
        btn = page.get_by_role("button", name="Criar segunda loja")
        await expect(btn).to_be_disabled()
        await btn.click(force=True)
        assert await page.get_by_role("dialog").count() == 0
        await page.screenshot(path="/tmp/browser/marca2-limit.png")
        log = await page.evaluate("window.__log")
        assert not [e for e in log if e["kind"] == "invoke"], log
        print("PASS two stores: limit message immediately, button disabled, no creation request")

        # 2) Account with one store creates the second without changing session or selection.
        await page.goto(ORIGIN + "/lojista/minha-rede")
        await page.get_by_role("button", name="Criar segunda loja").click()
        dialog = page.get_by_role("dialog")
        await dialog.get_by_label("Nome do responsável").fill("Responsável Nova")
        await dialog.get_by_label("E-mail da conta da nova loja").fill("invalido")
        await dialog.get_by_label("Nome da loja").fill("Loja Nova")
        await dialog.get_by_role("button", name="Criar loja").click()
        await expect(dialog.get_by_text("Email inválido")).to_be_visible()
        assert not [e for e in await page.evaluate("window.__log") if e["kind"] == "invoke"]
        await dialog.get_by_label("E-mail da conta da nova loja").fill("nova@example.invalid")
        submit = dialog.get_by_role("button", name="Criar loja")
        await submit.click()
        await submit.click(force=True)  # double click must not create twice
        await expect(page.get_by_text("Loja criada. O responsável receberá um e-mail para definir a senha.")).to_be_visible(timeout=10000)
        await expect(page.get_by_text("https://shopdrive.com.br/loja-nova")).to_be_visible()
        await expect(page.get_by_text("Limite de 2 lojas do Plano MARCA atingido.")).to_be_visible()
        await page.screenshot(path="/tmp/browser/marca2-created.png")
        log = await page.evaluate("window.__log")
        invokes = [e for e in log if e["kind"] == "invoke"]
        assert len(invokes) == 1 and invokes[0]["client"] == "base", invokes
        body = invokes[0]["args"]
        assert set(body) == {"ownerName", "email", "storeName", "idempotencyKey"} and "password" not in json.dumps(body), body
        assert not [e for e in log if e["kind"] == "auth"], "session must not change"
        assert await page.evaluate(f"sessionStorage.getItem('shopdrive_selected_store:{A}')") is None, "selection must not change"
        print("PASS one store: validation, single request (double click), new store listed, limit shown, session and selection unchanged")
        assert not [b for b in blocked if not b.startswith("GET ") or "supabase" in b], blocked  # page-shell fonts/SDK GETs are aborted too
        assert not errors, errors
        print("PASS no hosted/external request and no page errors")
        await browser.close()

asyncio.run(main())
