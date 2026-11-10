"""Browser regression for "Clientes -> detalhe -> Endereço Principal" (add/edit).

Mounts the real CustomerDetail page and CustomerAddressDialog with a synthetic merchant.
Every backend call is answered by local fakes (persisted in sessionStorage to survive reloads)
and every non-GET or external request is aborted: no hosted customer, order or account is touched.
"""
import asyncio, json, re
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
A = "11111111-1111-4111-8111-111111111111"
C = "33333333-3333-4333-8333-333333333333"
K1, K2, K3 = "a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002", "a0000000-0000-4000-8000-000000000003"
MAIN = (
    "import '/src/index.css';import * as React from '@@REACT@@';"
    "import {createRoot} from '@@REACTDOM@@';"
    "import {BrowserRouter,Routes,Route} from '@@ROUTER@@';"
    "import CustomerDetail from '/src/pages/dashboard/CustomerDetail.tsx';"
    "import {Toaster} from '/src/components/ui/toaster.tsx';"
    "const h=React.createElement;createRoot(document.getElementById('root')).render("
    "h(BrowserRouter,null,h(Routes,null,h(Route,{path:'/lojista/customers/:customerId',element:h(CustomerDetail)})),h(Toaster)));"
)
AUTH = f"""
const user={{id:'{A}',email:'merchant@example.invalid'}};
export const AuthProvider=({{children}})=>children;
export const useAuthContext=()=>({{user,session:{{user,access_token:'synthetic-not-real'}},loading:false,profileStatus:'complete',
 isMerchant:true,isTemplateProfile:false,storeSlug:'fixture-a',refreshProfile:async()=>{{}}}});
"""
LAYOUT = "export default function DashboardLayout({children}){return children}"
FAKE = f"""
const A='{A}',C='{C}';
window.__log=JSON.parse(sessionStorage.getItem('__log')||'[]');
const __push=e=>{{window.__log.push(e);sessionStorage.setItem('__log',JSON.stringify(window.__log))}};
const seed={{customers:[
  {{id:'{K1}',full_name:'Cliente Sem Endereco',email:'k1@example.invalid',phone:'(92) 90000-0001',cpf:'000.000.000-01',created_at:'2026-01-01T00:00:00Z'}},
  {{id:'{K2}',full_name:'Cliente Com Endereco',email:'k2@example.invalid',phone:'(92) 90000-0002',cpf:'000.000.000-02',created_at:'2026-01-01T00:00:00Z'}},
  {{id:'{K3}',full_name:'Cliente Outra Loja',email:'k3@example.invalid',phone:null,cpf:null,created_at:'2026-01-01T00:00:00Z'}}],
 addresses:[
  {{id:'addr-k2',customer_id:'{K2}',store_owner_id:A,recipient_name:'Cliente Com Endereco',cep:'69000000',street:'Rua Um',number:'10',complement:null,neighborhood:'Centro',city:'Manaus',state:'AM',is_default:true,updated_at:'2026-01-01T00:00:00Z'}},
  {{id:'addr-k3',customer_id:'{K3}',store_owner_id:C,recipient_name:'Cliente Outra Loja',cep:'20000000',street:'Rua Loja C',number:'5',complement:null,neighborhood:'Centro',city:'Rio de Janeiro',state:'RJ',is_default:true,updated_at:'2026-01-01T00:00:00Z'}}]}};
const db=()=>JSON.parse(sessionStorage.getItem('__db')||JSON.stringify(seed));
const put=d=>sessionStorage.setItem('__db',JSON.stringify(d));
function table(name,filters){{
  const d=db();
  if(name==='customer_profiles')return d.customers.filter(c=>filters.every(([k,v])=>c[k]===v));
  if(name==='customer_addresses')return d.addresses.filter(a=>filters.every(([k,v])=>a[k]===v));
  if(name==='store_customers')return [{{is_active:true}}];
  return [];
}}
export const supabase={{
  from:t=>{{const f=[];let one=false,write=null;
   const q={{then:(res,rej)=>{{__push({{kind:write?'write':'read',name:t,write}});
     if(write)return Promise.resolve({{data:null,error:{{message:'blocked in test'}}}}).then(res,rej);
     const rows=table(t,f);return Promise.resolve({{data:one?(rows[0]??null):rows,error:null}}).then(res,rej);}}}};
   q.select=()=>q;q.order=()=>q;q.limit=()=>q;q.in=()=>q;q.eq=(k,v)=>{{f.push([k,v]);return q}};
   q.maybeSingle=()=>{{one=true;return q}};q.single=()=>{{one=true;return q}};
   for(const op of ['update','insert','delete','upsert']) q[op]=(v)=>{{write={{op,v}};return q}};
   return q;}},
  rpc:async(name,args)=>{{__push({{kind:'rpc',name,args}});
   await new Promise(r=>setTimeout(r,300));
   if(name!=='merchant_save_customer_primary_address')return {{data:null,error:null}};
   if(sessionStorage.getItem('__fail')){{sessionStorage.removeItem('__fail');return {{data:null,error:{{message:'customer_not_found',code:'42501'}}}}}}
   const d=db();const cid=args.p_customer_id;
   let row=d.addresses.find(a=>a.customer_id===cid&&a.store_owner_id===A);
   const vals={{recipient_name:args.p_recipient_name||d.customers.find(c=>c.id===cid).full_name,cep:args.p_cep.replace(/\\D/g,''),street:args.p_street.trim(),
     number:args.p_number.trim(),complement:args.p_complement.trim()||null,neighborhood:args.p_neighborhood.trim(),city:args.p_city.trim(),state:args.p_state.trim().toUpperCase(),updated_at:new Date().toISOString()}};
   if(row)Object.assign(row,vals);else{{row={{id:'new-'+cid,customer_id:cid,store_owner_id:A,is_default:!d.addresses.some(a=>a.customer_id===cid&&a.is_default),...vals}};d.addresses.push(row);}}
   put(d);return {{data:row,error:null}};}},
  channel:()=>{{const c={{on(){{return c}},subscribe(){{return c}}}};return c}},removeChannel:()=>{{}},
  auth:{{getSession:async()=>({{data:{{session:null}},error:null}}),onAuthStateChange:()=>({{data:{{subscription:{{unsubscribe(){{}}}}}}}}),
   resetPasswordForEmail:async()=>{{__push({{kind:'auth'}});return {{error:null}}}}}},
}};
"""

async def stamped_main(context):
    """Resolve the dev server's dependency URLs (Vite or oj) from the real served modules."""
    sources = ""
    for path in ["/src/main.tsx", "/src/pages/dashboard/CustomerDetail.tsx"]:
        sources += await (await context.request.get(ORIGIN + path)).text()
    def dep(pattern):
        found = re.search(r'from "([^"]*' + pattern + r'[^"]*)"', sources)
        assert found, pattern
        return found.group(1)
    return (MAIN.replace("@@REACT@@", dep(r"/react(__oj_named)?\.m?js"))
                .replace("@@REACTDOM@@", dep(r"/react-dom_client"))
                .replace("@@ROUTER@@", dep(r"/react-router-dom")))


def rpc_calls(log):
    return [e for e in log if e["kind"] == "rpc" and e["name"] == "merchant_save_customer_primary_address"]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
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
        # The address card's own content (CardTitle -> CardHeader -> Card).
        card = lambda: page.get_by_text("Endereço Principal", exact=True).locator("xpath=ancestor::div[contains(@class,'border')][1]")

        # 1) Customer without address: add.
        await page.goto(f"{ORIGIN}/lojista/customers/{K1}")
        await expect(page.get_by_text("Nenhum endereço cadastrado.")).to_be_visible(timeout=15000)
        assert await page.get_by_role("button", name="Editar endereço").count() == 0
        await page.get_by_role("button", name="Adicionar endereço").click()
        dialog = page.get_by_role("dialog")
        await expect(dialog.get_by_role("heading", name="Adicionar endereço")).to_be_visible()
        assert await dialog.get_by_role("button", name="Cadastrar cliente").count() == 0
        # 8) Validation: required fields missing -> no request.
        await dialog.get_by_role("button", name="Salvar endereço").click()
        await expect(dialog.get_by_text("Informe o CEP.")).to_be_visible()
        await expect(dialog.get_by_text("Informe a rua.")).to_be_visible()
        await dialog.get_by_label("CEP *").fill("6900501")
        await dialog.get_by_label("Rua/Logradouro *").fill("Av. Teste")
        await dialog.get_by_label("Número *").fill("100")
        await dialog.get_by_label("Bairro *").fill("Adrianópolis")
        await dialog.get_by_label("Cidade *").fill("Manaus")
        await dialog.get_by_label("Estado *").fill("XX")
        await dialog.get_by_role("button", name="Salvar endereço").click()
        await expect(dialog.get_by_text("CEP deve ter 8 dígitos (00000-000).")).to_be_visible()
        await expect(dialog.get_by_text("Use a sigla de um estado brasileiro (ex.: AM).")).to_be_visible()
        assert not rpc_calls(await page.evaluate("window.__log"))
        await page.screenshot(path="/tmp/browser/address/1-validation.png")
        print("PASS add dialog: title/button labels, missing and invalid CEP/UF block saving with no request")
        await page.route("https://viacep.com.br/**", lambda r: r.abort())
        await dialog.get_by_label("CEP *").fill("69005010")
        assert await dialog.get_by_label("CEP *").input_value() == "69005-010"
        await dialog.get_by_label("Estado *").fill("am")
        save = dialog.get_by_role("button", name="Salvar endereço")
        await save.click()
        busy = dialog.get_by_role("button", name="Salvando...")
        await expect(busy).to_be_disabled()
        await busy.click(force=True)  # second click while saving must not send another request
        await expect(page.get_by_text("Endereço adicionado com sucesso.").first).to_be_visible(timeout=5000)
        await expect(page.get_by_role("dialog")).to_have_count(0)
        await expect(card().get_by_text("Av. Teste, 100")).to_be_visible()
        await expect(card().get_by_text("CEP: 69005-010")).to_be_visible()
        calls = rpc_calls(await page.evaluate("window.__log"))
        assert len(calls) == 1 and calls[0]["args"]["p_customer_id"] == K1 and calls[0]["args"]["p_state"] == "AM", calls
        assert set(calls[0]["args"]) == {"p_customer_id", "p_recipient_name", "p_cep", "p_street", "p_number", "p_complement", "p_neighborhood", "p_city", "p_state"}
        await page.screenshot(path="/tmp/browser/address/2-added.png")
        print("PASS add: single save, dialog closes, card shows the address immediately with masked CEP")

        # 3) Reload: persisted.
        await page.reload()
        await expect(card().get_by_text("Av. Teste, 100")).to_be_visible(timeout=15000)
        print("PASS reload: added address persists")

        # 2) Customer with address: edit number/complement.
        await page.goto(f"{ORIGIN}/lojista/customers/{K2}")
        await expect(card().get_by_text("Rua Um, 10")).to_be_visible(timeout=15000)
        await page.get_by_role("button", name="Editar endereço").click()
        dialog = page.get_by_role("dialog")
        await expect(dialog.get_by_role("heading", name="Editar endereço")).to_be_visible()
        assert await dialog.get_by_label("CEP *").input_value() == "69000-000"
        assert await dialog.get_by_label("Rua/Logradouro *").input_value() == "Rua Um"
        assert await dialog.get_by_label("Estado *").input_value() == "AM"
        await dialog.get_by_label("Número *").fill("250")
        await dialog.get_by_label("Complemento").fill("Apto 3")
        # 9) Backend failure: dialog stays open, typed data kept, card unchanged.
        await page.evaluate("sessionStorage.setItem('__fail','1')")
        await dialog.get_by_role("button", name="Salvar alterações").click()
        await expect(dialog.get_by_role("alert")).to_have_text("Este cliente não pertence à loja atual.")
        assert await dialog.get_by_label("Número *").input_value() == "250"
        assert await dialog.get_by_label("Complemento").input_value() == "Apto 3"
        await page.screenshot(path="/tmp/browser/address/3-failure.png")
        await dialog.get_by_role("button", name="Cancelar").click()
        await expect(card().get_by_text("Rua Um, 10")).to_be_visible()
        print("PASS failure: dialog stays open with typed data and clear message; card keeps previous address")
        await page.get_by_role("button", name="Editar endereço").click()
        dialog = page.get_by_role("dialog")
        v = await dialog.get_by_label("Número *").input_value()
        assert v == "10"  # reopened from saved data
        await dialog.get_by_label("Número *").fill("250")
        await dialog.get_by_label("Complemento").fill("Apto 3")
        await dialog.get_by_role("button", name="Salvar alterações").click()
        await expect(page.get_by_text("Endereço atualizado com sucesso.").first).to_be_visible(timeout=5000)
        await expect(card().get_by_text("Rua Um, 250")).to_be_visible()
        await expect(card().get_by_text("Apto 3")).to_be_visible()
        await page.screenshot(path="/tmp/browser/address/4-edited.png")
        await page.reload()
        await expect(card().get_by_text("Rua Um, 250")).to_be_visible(timeout=15000)
        db = json.loads(await page.evaluate("sessionStorage.getItem('__db')"))
        assert len([a for a in db["addresses"] if a["customer_id"] == K2]) == 1
        print("PASS edit: prefilled, saved, card updated without reload, persists after reload, no duplicate")

        # Customer whose only address belongs to another store: not shown, editing creates nothing there.
        await page.goto(f"{ORIGIN}/lojista/customers/{K3}")
        await expect(page.get_by_text("Nenhum endereço cadastrado.")).to_be_visible(timeout=15000)
        assert await page.get_by_text("Rua Loja C").count() == 0
        print("PASS another store's address is neither shown nor offered for editing")

        log = await page.evaluate("window.__log")
        assert not [e for e in log if e["kind"] in ("write", "auth")], [e for e in log if e["kind"] in ("write", "auth")]
        assert {e["name"] for e in log if e["kind"] == "rpc"} == {"merchant_save_customer_primary_address"}
        assert not [b for b in blocked if "supabase" in b], blocked
        assert not errors, errors
        print("PASS no direct table writes, no profile/login change, no hosted request, no page errors")
        await browser.close()

asyncio.run(main())
