"""Browser regression: "Regularizar pagamento" for a contracted, delinquent MARCA subscription.

Mounts the real GlobalBillingAlert, SubscriptionRegularizationCard and the checkout router with a synthetic owner.
Every backend call is answered by local fakes and every non-GET or external request is aborted:
no hosted account, subscription, payment provider or charge can be touched.
"""
import asyncio, json, re
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
A = "11111111-1111-4111-8111-111111111111"
REG = "22222222-2222-4222-8222-222222222222"
MAIN = (
    "import '/src/index.css';import React from '/node_modules/.vite/deps/react.js';"
    "import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';"
    "import {BrowserRouter,Routes,Route} from '/node_modules/.vite/deps/react-router-dom.js';"
    "import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';"
    "import {GlobalBillingAlert} from '/src/components/billing/GlobalBillingAlert.tsx';"
    "import {SubscriptionRegularizationCard} from '/src/components/financeiro/SubscriptionRegularizationCard.tsx';"
    "import Router from '/src/pages/admin/AdminSubscriptionCheckout.tsx';"
    "import {Toaster} from '/src/components/ui/sonner.tsx';"
    "const h=React.createElement;ReactDOM.createRoot(document.getElementById('root')).render("
    "h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},"
    "h(BrowserRouter,null,h(Routes,null,"
    "h(Route,{path:'/lojista/financeiro',element:h('div',null,h(GlobalBillingAlert),h(SubscriptionRegularizationCard))}),"
    "h(Route,{path:'/gestor/checkout-assinatura',element:h(Router)})),h(Toaster))));"
)
AUTH = f"""
const user={{id:'{A}',email:'owner@example.invalid'}};
export const AuthProvider=({{children}})=>children;
export const useAuthContext=()=>({{user,session:{{user,access_token:'synthetic-not-real'}},loading:false,profileStatus:'complete',
 isMerchant:true,isTemplateProfile:false,storeSlug:'fixture-a',refreshProfile:async()=>{{}}}});
"""
FAKE = f"""
const REG='{REG}';
window.__log=window.__log||[];
const q=new URLSearchParams(location.search); const sc=sessionStorage.getItem('sc')||'approved';
const none=sessionStorage.getItem('none')==='1', open=sessionStorage.getItem('open')==='1';
let statusCalls=0;
const sub={{id:'sub-1',user_id:'{A}',plan_id:'gratis',previous_plan_id:'marca',downgrade_reason:'nonpayment',status:'past_due',billing_cycle:'monthly',
 payment_method:'pix',grace_period_ends_at:null,no_charge:false,created_at:'2026-10-11T00:00:00Z',updated_at:'2026-11-18T19:00:00Z'}};
const tables={{master_subscriptions:sub,master_subscription_payments:null,
 cms_billing_alerts:[{{alert_key:'past_due',title:'Pagamento pendente',message:'Regularize sua assinatura {{nomePlano}}.',cta_text:'Regularizar pagamento',is_active:true}}],
 billing_alert_settings:[]}};
const reg=()=>none?{{state:'none',last:null}}:{{state:'payable',plan_id:'marca',plan_name:'MARCA',billing_cycle:'monthly',amount:199.97,currency:'BRL',payment_method:'pix',
 temporarily_limited:true,open:open?{{regularization_id:REG,pix_qr_code:'fixture-open-qr',pix_qr_code_base64:null,pix_expires_at:'2026-11-19T00:00:00Z'}}:null,last:null}};
export function makeClient(client){{
 return {{
  from:t=>{{window.__log.push({{kind:'from',name:t}});const d=tables[t]??null;const b={{then:r=>Promise.resolve({{data:Array.isArray(d)?d:(d?[d]:[]),error:null}}).then(r),
   maybeSingle:async()=>({{data:Array.isArray(d)?d[0]:d,error:null}}),single:async()=>({{data:Array.isArray(d)?d[0]:d,error:null}})}};
   for(const op of ['select','eq','in','order','limit','neq','gte','lte']) b[op]=()=>b; return b;}},
  rpc:async(name,args)=>{{window.__log.push({{kind:'rpc',name,args:args??null}});
   if(name==='get_my_subscription_regularization')return {{data:reg(),error:null}};
   if(name==='get_my_marca_offer')return {{data:{{status:'ok',path:'regularize',monthly_price:199.97,annual_discount_percent:30}},error:null}};
   if(name==='get_my_marca_upgrade_checkout')return {{data:{{state:'activated'}},error:null}};
   return {{data:null,error:null}};}},
  functions:{{invoke:async(name,o)=>{{window.__log.push({{kind:'invoke',name,args:o?.body??null}});
   await new Promise(r=>setTimeout(r,300));
   if(name==='regularize-master-subscription'){{
    if(o.body.action==='start') return {{data:{{state:'pending',regularizationId:REG,pix:{{qrCode:'fixture-qr-code',qrCodeBase64:null,expiresAt:'2026-11-19T00:00:00Z'}}}},error:null}};
    statusCalls++;
    const final={{approved:'paid',rejected:'failed',expired:'expired'}}[sc];
    return {{data:{{state:statusCalls>=2?final:'pending',regularizationId:REG,pix:null}},error:null}};
   }}
   return {{data:null,error:null}};}}}},
  channel:()=>{{const c={{on(){{return c}},subscribe(){{return c}}}};return c}},removeChannel:()=>{{}},
  auth:{{getSession:async()=>({{data:{{session:{{user:{{id:'{A}'}},access_token:'synthetic-not-real'}}}},error:null}}),
   getUser:async()=>({{data:{{user:{{id:'{A}'}}}},error:null}}),onAuthStateChange:()=>({{data:{{subscription:{{unsubscribe(){{}}}}}}}}),
   signOut:async()=>({{error:null}})}},
 }};
}}
export const supabase=makeClient('base');
"""
SUPABASE_JS = "import {makeClient} from '/src/integrations/supabase/client.ts';export const createClient=()=>makeClient('scoped');"

async def stamped_main(context):
    sources = ""
    for path in ["/src/components/billing/GlobalBillingAlert.tsx", "/src/components/financeiro/SubscriptionRegularizationCard.tsx",
                 "/src/pages/admin/AdminSubscriptionCheckout.tsx", "/src/components/ui/sonner.tsx",
                 "/src/components/financeiro/SubscriptionRegularizationCheckout.tsx"]:
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
        async def scenario(sc, none="0", open_="0"):
            await page.goto(ORIGIN + "/lojista/financeiro")
            await page.evaluate(f"sessionStorage.setItem('sc','{sc}');sessionStorage.setItem('none','{none}');sessionStorage.setItem('open','{open_}')")
        log = lambda: page.evaluate("window.__log||[]")

        # 1) Financeiro card + banner -> regularization page of the same subscription, never the contract flow.
        await scenario("approved")
        await page.goto(ORIGIN + "/lojista/financeiro")
        card = page.get_by_role("region", name=re.compile("Plano contratado: MARCA"))
        await expect(card).to_be_visible(timeout=15000)
        await expect(card.get_by_text("Pagamento pendente")).to_be_visible()
        await expect(card.get_by_text("Recursos temporariamente limitados ao Plano Grátis.")).to_be_visible()
        await page.screenshot(path="/tmp/browser/reg-financeiro.png")
        await page.get_by_role("button", name="Regularizar pagamento").first.click()
        await expect(page).to_have_url(re.compile(r"flow=regularizar"))
        await expect(page.get_by_role("heading", name="Regularizar pagamento")).to_be_visible(timeout=10000)
        for t in ["MARCA", "Mensal", "R$ 199,97", "Pagamento pendente"]:
            await expect(page.get_by_text(t, exact=True).first).to_be_visible()
        for forbidden in ["Empresa / Marca", "Contrato", "Aceitar e continuar", "Plano MARCA ativado!"]:
            assert await page.get_by_text(forbidden).count() == 0, forbidden
        await page.screenshot(path="/tmp/browser/reg-checkout.png")
        print("PASS Financeiro shows contracted MARCA pending; button opens regularization (no company/contract/acceptance)")

        # 2) Double click -> one start request carrying no amount/plan; approval shown only from server state.
        await page.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Gerar PIX e pagar'));b.click();b.click();})()")
        await expect(page.get_by_text("fixture-qr-code")).to_be_visible(timeout=10000)
        starts = [e for e in await log() if e["kind"] == "invoke" and e["args"].get("action") == "start"]
        assert len(starts) == 1 and starts[0]["args"] == {"action": "start"}, starts
        await expect(page.get_by_text("Pagamento confirmado")).to_be_visible(timeout=20000)
        await page.screenshot(path="/tmp/browser/reg-approved.png")
        print("PASS double click: single start without values; success only after server confirmation")

        # 3) Rejected and expired close the charge and offer a new PIX, without success.
        for sc, text in [("rejected", "não foi aprovado"), ("expired", "expirou")]:
            await scenario(sc)
            await page.goto(ORIGIN + "/gestor/checkout-assinatura?flow=regularizar")
            await page.get_by_role("button", name="Gerar PIX e pagar").click()
            await expect(page.get_by_text(re.compile(text))).to_be_visible(timeout=20000)
            await expect(page.get_by_role("button", name="Gerar PIX e pagar")).to_be_visible()
            assert await page.get_by_text("Pagamento confirmado").count() == 0
        await page.screenshot(path="/tmp/browser/reg-expired.png")
        print("PASS rejected/expired: charge closed, new PIX offered, never success")

        # 4) Reopening with an open PIX reuses it (no new start).
        await scenario("approved", open_="1")
        await page.goto(ORIGIN + "/gestor/checkout-assinatura?flow=regularizar")
        await expect(page.get_by_text("fixture-open-qr")).to_be_visible(timeout=10000)
        assert not [e for e in await log() if e["kind"] == "invoke" and e["args"].get("action") == "start"]
        print("PASS reopened page shows the same open PIX without creating another")

        # 5) Old invoice link with plan gratis no longer blank; MARCA checkout redirects; nothing payable -> neutral.
        await scenario("approved")
        await page.goto(ORIGIN + "/gestor/checkout-assinatura?plano=gratis&ciclo=mensal&origem=regularizar&flow=pay_invoice")
        await expect(page.get_by_role("heading", name="Regularizar pagamento")).to_be_visible(timeout=10000)
        await page.goto(ORIGIN + "/gestor/checkout-assinatura?plano=marca")
        await expect(page).to_have_url(re.compile(r"flow=regularizar"), timeout=10000)
        assert await page.get_by_text("Plano MARCA ativado!").count() == 0
        await scenario("approved", none="1")
        await page.goto(ORIGIN + "/gestor/checkout-assinatura?flow=regularizar")
        await expect(page.get_by_text("Nenhum pagamento pendente")).to_be_visible(timeout=10000)
        assert await page.get_by_role("button", name="Gerar PIX e pagar").count() == 0
        print("PASS old gratis link renders regularization; MARCA checkout redirects without false success; non-payable account sees no charge")

        assert not [b for b in blocked if "supabase" in b or not b.startswith("GET ")], blocked
        assert not errors, errors
        print("PASS no hosted/external request and no page errors")
        await browser.close()

asyncio.run(main())
