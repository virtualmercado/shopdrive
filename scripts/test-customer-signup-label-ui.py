"""Browser regression: manual customer signup saves the address through the secure address function
(with honest partial-failure + address-only retry) and the shipping label prints the order's own
address copy. Mounts the real Customers and Orders pages with local fakes; every non-GET or external
request is aborted, so no hosted customer, order or account is touched.
"""
import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
OUT = Path("/tmp/browser/signup-label"); OUT.mkdir(parents=True, exist_ok=True)
A = "11111111-1111-4111-8111-111111111111"
C = "33333333-3333-4333-8333-333333333333"
K = "a0000000-0000-4000-8000-000000000001"
MAIN = (
    "import '/src/index.css';import * as React from '@@REACT@@';"
    "import {createRoot} from '@@REACTDOM@@';"
    "import {BrowserRouter,Routes,Route} from '@@ROUTER@@';"
    "import {QueryClient,QueryClientProvider} from '@@RQ@@';"
    "import Customers from '/src/pages/dashboard/Customers.tsx';"
    "import Orders from '/src/pages/dashboard/Orders.tsx';"
    "import {Toaster} from '/src/components/ui/toaster.tsx';"
    "const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});"
    "const h=React.createElement;createRoot(document.getElementById('root')).render("
    "h(QueryClientProvider,{client:qc},h(BrowserRouter,null,h(Routes,null,"
    "h(Route,{path:'/lojista/customers',element:h(Customers)}),h(Route,{path:'/lojista/orders',element:h(Orders)})),h(Toaster))));"
)
AUTH = f"""
const user={{id:'{A}',email:'merchant@example.invalid'}};
export const AuthProvider=({{children}})=>children;
export const useAuthContext=()=>({{user,session:{{user,access_token:'synthetic-not-real'}},loading:false,profileStatus:'complete',
 isMerchant:true,isTemplateProfile:false,storeSlug:'fixture-a',refreshProfile:async()=>{{}}}});
"""
LAYOUT = "export default function DashboardLayout({children}){return children}"
FAKE = f"""
const A='{A}',C='{C}',K='{K}';
window.__log=[];
const db={{
 customer_profiles:[{{id:K,full_name:'Cliente Nome Atual',email:'k@example.invalid',phone:null,cpf:null,created_at:'2026-01-01T00:00:00Z'}}],
 store_customers:[{{id:'sc-k',store_owner_id:A,customer_id:K,is_active:true,customer_code:'0001',origin:'store',created_at:'2026-01-01T00:00:00Z'}}],
 customer_addresses:[
  {{id:'addr-b',customer_id:K,store_owner_id:A,recipient_name:'Cliente',cep:'69000002',street:'Rua B Atual',number:'2',complement:null,neighborhood:'Bairro B',city:'Manaus',state:'AM',is_default:false,updated_at:'2026-11-10T00:00:00Z'}},
  {{id:'addr-c',customer_id:K,store_owner_id:C,recipient_name:'Cliente',cep:'20000000',street:'Rua Outra Loja',number:'9',complement:null,neighborhood:'Centro',city:'Rio de Janeiro',state:'RJ',is_default:true,updated_at:'2026-11-10T00:00:00Z'}}],
 orders:[
  {{id:'o-old',order_number:'#000101',customer_id:K,customer_name:'Cliente Nome Antigo',customer_email:null,customer_phone:null,
    customer_address:'Rua A Antiga, 1 - Casa, Bairro A, Manaus - AM, CEP: 69000-001',total_amount:10,subtotal:10,delivery_fee:0,delivery_method:'entrega',
    status:'pending',payment_method:'pix',notes:null,created_at:'2026-01-02T00:00:00Z',updated_at:'2026-01-02T00:00:00Z',order_source:'store',store_owner_id:A}},
  {{id:'o-new',order_number:'#000102',customer_id:K,customer_name:'Cliente Nome Atual',customer_email:null,customer_phone:null,
    customer_address:'Rua B Atual, 2, Bairro B, Manaus - AM, CEP: 69000-002',total_amount:10,subtotal:10,delivery_fee:0,delivery_method:'entrega',
    status:'pending',payment_method:'pix',notes:null,created_at:'2026-11-10T00:00:00Z',updated_at:'2026-11-10T00:00:00Z',order_source:'store',store_owner_id:A}},
  {{id:'o-legacy',order_number:'#000100',customer_id:K,customer_name:'Cliente Nome Antigo',customer_email:null,customer_phone:null,
    customer_address:'A combinar pelo WhatsApp',total_amount:10,subtotal:10,delivery_fee:0,delivery_method:null,
    status:'pending',payment_method:'pix',notes:null,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',order_source:'store',store_owner_id:A}}],
 profiles:[{{id:A,store_name:'Loja Fixture',store_slug:'fixture-a'}}],
}};
window.__db=db;
window.__failNextAddress=false;
function rows(t,f){{return (db[t]||[]).filter(r=>f.every(([k,v,op])=>op==='in'?v.includes(r[k]):r[k]===v));}}
const builder=t=>{{const f=[];let one=false,write=null,head=false;
  const q=new Proxy({{}},{{get(_,p){{
   if(p==='then')return (res,rej)=>{{window.__log.push({{kind:write?'write':'read',name:t,write}});
     if(write)return Promise.resolve({{data:null,error:{{message:'blocked in test'}}}}).then(res,rej);
     const r=rows(t,f);return Promise.resolve({{data:one?(r[0]??null):r,error:null,count:r.length}}).then(res,rej);}};
   if(p==='eq')return (k,v)=>{{f.push([k,v]);return q}};
   if(p==='in')return (k,v)=>{{f.push([k,v,'in']);return q}};
   if(p==='single'||p==='maybeSingle')return ()=>{{one=true;return q}};
   if(['update','insert','delete','upsert'].includes(p))return v=>{{write={{op:p,v}};return q}};
   return ()=>q;}}}});
  return q;}};
export const supabase={{
  from:builder,
  rpc:async(name,args)=>{{window.__log.push({{kind:'rpc',name,args}});
   await new Promise(r=>setTimeout(r,250));
   if(name==='create_manual_store_customer'){{
     const id='new-customer-1';
     if(!db.customer_profiles.some(c=>c.id===id))db.customer_profiles.push({{id,full_name:args.p_full_name,email:args.p_email,phone:args.p_phone,cpf:args.p_cpf,created_at:new Date().toISOString()}});
     if(!db.store_customers.some(s=>s.customer_id===id))db.store_customers.push({{id:'sc-new',store_owner_id:A,customer_id:id,is_active:true,origin:'manual',created_at:new Date().toISOString()}});
     return {{data:id,error:null}};}}
   if(name==='merchant_save_customer_primary_address'){{
     if(window.__failNextAddress){{window.__failNextAddress=false;return {{data:null,error:{{message:'synthetic network failure'}}}}}}
     let row=db.customer_addresses.find(a=>a.customer_id===args.p_customer_id&&a.store_owner_id===A);
     const vals={{recipient_name:args.p_recipient_name,cep:args.p_cep.replace(/\\D/g,''),street:args.p_street,number:args.p_number,complement:args.p_complement||null,
       neighborhood:args.p_neighborhood,city:args.p_city,state:args.p_state.toUpperCase()}};
     if(row)Object.assign(row,vals);else{{row={{id:'addr-new-'+db.customer_addresses.length,customer_id:args.p_customer_id,store_owner_id:A,is_default:true,...vals}};db.customer_addresses.push(row);}}
     return {{data:row,error:null}};}}
   return {{data:null,error:null}};}},
  channel:()=>{{const c={{on(){{return c}},subscribe(){{return c}}}};return c}},removeChannel:()=>{{}},
  auth:{{getSession:async()=>({{data:{{session:null}},error:null}}),getUser:async()=>({{data:{{user:null}},error:null}}),onAuthStateChange:()=>({{data:{{subscription:{{unsubscribe(){{}}}}}}}})}},
  storage:{{from:()=>({{getPublicUrl:()=>({{data:{{publicUrl:''}}}})}})}},
}};
"""


async def stamped_main(context):
    sources = ""
    for path in ["/src/main.tsx", "/src/App.tsx", "/src/pages/dashboard/Orders.tsx"]:
        sources += await (await context.request.get(ORIGIN + path)).text()
    def dep(pattern):
        found = re.search(r'from "([^"]*' + pattern + r'[^"]*)"', sources)
        assert found, pattern
        return found.group(1)
    return (MAIN.replace("@@REACT@@", dep(r"/react(__oj_named)?\.m?js"))
                .replace("@@REACTDOM@@", dep(r"/react-dom_client"))
                .replace("@@ROUTER@@", dep(r"/react-router-dom"))
                .replace("@@RQ@@", dep(r"tanstack_react-query")))


async def label_text(page, order_number):
    row = page.locator("div.border, div").filter(has_text=order_number).filter(has=page.get_by_role("combobox")).last
    await row.get_by_role("combobox").first.click()
    await page.get_by_role("option", name=re.compile("Imprimir etiqueta")).click()
    dialog = page.get_by_role("alertdialog")
    await dialog.get_by_role("checkbox").click()
    async with page.expect_download() as dl:
        await dialog.get_by_role("button", name="Confirmar e imprimir etiqueta").click()
    path = OUT / f"label-{order_number.strip('#')}.pdf"
    await (await dl.value).save_as(path)
    return path.read_bytes().decode("latin-1")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
        overrides = {"/src/main.tsx": await stamped_main(context), "/src/contexts/AuthContext.tsx": AUTH,
                     "/src/integrations/supabase/client.ts": FAKE, "/src/components/layout/DashboardLayout.tsx": LAYOUT}
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
        log = lambda: page.evaluate("window.__log")
        calls = lambda l, n: [e for e in l if e["kind"] == "rpc" and e["name"] == n]

        # ---------- Manual signup ----------
        await page.goto(f"{ORIGIN}/lojista/customers")
        await page.get_by_role("button", name=re.compile("Incluir cadastro|Novo cliente|Cadastrar", re.I)).first.click(timeout=15000)
        dialog = page.get_by_role("dialog")
        await expect(dialog.get_by_role("heading", name="Incluir cadastro")).to_be_visible()
        fields = dialog.locator("input")
        await dialog.get_by_placeholder("Nome do cliente").fill("Cliente Manual Teste")
        await dialog.get_by_placeholder("email@exemplo.com").fill("manual@example.invalid")
        await dialog.get_by_placeholder("00000-000", exact=True).fill("69005010")
        assert await dialog.get_by_placeholder("00000-000", exact=True).input_value() == "69005-010"
        await dialog.get_by_placeholder("Rua, Avenida, etc.").fill("Rua Cadastro")
        await dialog.get_by_placeholder("123", exact=True).fill("12")
        await dialog.get_by_placeholder("Bairro", exact=True).fill("Centro")
        await dialog.get_by_placeholder("Cidade", exact=True).fill("Manaus")
        await dialog.get_by_placeholder("UF").fill("XX")
        await dialog.get_by_role("button", name="Cadastrar cliente").click()
        await expect(page.get_by_text("Use a sigla de um estado brasileiro (ex.: AM).").first).to_be_visible()
        assert not calls(await log(), "create_manual_store_customer"), "invalid UF must block before creating the customer"
        print("PASS invalid address blocks signup before any customer is created")

        await dialog.get_by_placeholder("UF").fill("AM")
        await page.evaluate("window.__failNextAddress=true")
        await dialog.get_by_role("button", name="Cadastrar cliente").click()
        await dialog.get_by_role("button", name="Cadastrando...").click(force=True)  # double click while busy
        await expect(dialog.get_by_text("Cliente criado, mas o endereço não foi salvo")).to_be_visible()
        await expect(dialog).to_be_visible()
        assert await dialog.get_by_placeholder("Nome do cliente").is_disabled()
        assert not await page.get_by_text("Cliente cadastrado com sucesso!").count()
        l = await log()
        assert len(calls(l, "create_manual_store_customer")) == 1 and len(calls(l, "merchant_save_customer_primary_address")) == 1, l
        await page.screenshot(path=str(OUT / "1-partial-failure.png"))
        print("PASS address failure: customer created once, dialog stays open with honest message, no success toast")

        await dialog.get_by_role("button", name="Salvar endereço").click()
        await expect(page.get_by_text("Cliente cadastrado com sucesso!")).to_be_visible()
        await expect(dialog).to_be_hidden()
        l = await log()
        assert len(calls(l, "create_manual_store_customer")) == 1, "retry must not create the customer again"
        saves = calls(l, "merchant_save_customer_primary_address")
        assert len(saves) == 2 and saves[-1]["args"]["p_customer_id"] == "new-customer-1" and saves[-1]["args"]["p_state"] == "AM"
        assert saves[-1]["args"]["p_recipient_name"] == "Cliente Manual Teste"
        assert not [e for e in l if e["kind"] == "write" and e["name"] == "customer_addresses"], "no direct table write"
        n_addr = await page.evaluate("window.__db.customer_addresses.filter(a=>a.customer_id==='new-customer-1').length")
        assert n_addr == 1
        print("PASS retry saves only the address (one customer, one address, via the secure function, no direct table write)")

        # Success path in one go.
        await page.get_by_role("button", name=re.compile("Incluir cadastro|Novo cliente|Cadastrar", re.I)).first.click()
        dialog = page.get_by_role("dialog")
        await expect(dialog.get_by_placeholder("Nome do cliente")).to_have_value("")
        assert await dialog.get_by_placeholder("Nome do cliente").is_enabled()
        print("PASS form resets for the next signup")
        await page.keyboard.press("Escape")

        # ---------- Shipping label ----------
        await page.goto(f"{ORIGIN}/lojista/orders")
        await expect(page.get_by_text("#000101").first).to_be_visible(timeout=15000)
        old = await label_text(page, "#000101")
        assert "RUA A ANTIGA" in old and "69000-001" in old and "BAIRRO A" in old and "CLIENTE NOME ANTIGO" in old, "old order must print address A"
        assert "RUA B ATUAL" not in old and "OUTRA LOJA" not in old
        print("PASS old order label prints the stored address A and the name at purchase (not current registration B)")
        old2 = await label_text(page, "#000101")
        assert "RUA A ANTIGA" in old2 and "RUA B ATUAL" not in old2
        print("PASS reprint keeps address A")
        new = await label_text(page, "#000102")
        assert "RUA B ATUAL" in new and "69000-002" in new and "RUA A ANTIGA" not in new
        print("PASS new order label prints address B")
        legacy = await label_text(page, "#000100")
        assert "RUA B ATUAL" in legacy and "OUTRA LOJA" not in legacy, "legacy fallback uses this store's address only"
        print("PASS legacy order without address copy falls back to this store's registered address (never another store's)")

        await page.screenshot(path=str(OUT / "2-orders.png"))
        assert not errors, errors
        assert not [b for b in blocked if "viacep" not in b], blocked
        print("PASS no page errors; no hosted writes or external calls")
        print("ALL PASS")
        await browser.close()

asyncio.run(main())
