"""Exercise real merchant header, domain section, dialog and hook with local fixtures only.

All browser origins are intercepted; no real account, domain write or payment is used.
Run: python3 scripts/test-domain-panel-ux.py
"""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
OUTPUT = Path("/tmp/browser/domain-panel-ux")
ACTIVE = {
    "id": "11111111-1111-4111-8111-111111111111", "domain": "redearoma.com.br",
    "display_hostname": "www.redearoma.com.br", "flow_version": 2,
    "state": "active", "active": True, "released": False,
    "ownership_verified_at": "2026-10-27T22:06:42Z",
    "dns_verified_at": "2026-10-27T22:06:42Z",
    "routing_status": "active", "ssl_status": "active",
    "last_dns_check": "2026-10-30T00:00:00Z", "last_result": {},
    "detected_nameservers": [], "needs_reverification": False,
}

MAIN = """
import "/src/index.css";
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {BrowserRouter} from '/node_modules/.vite/deps/react-router-dom.js';
import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';
import {AuthProvider} from '/src/contexts/AuthContext.tsx';
import DashboardLayout from '/src/components/layout/DashboardLayout.tsx';
import {CustomDomainSection} from '/src/components/domain/CustomDomainSection.tsx';
const h=React.createElement;
ReactDOM.createRoot(document.getElementById('root')).render(h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}})},h(AuthProvider,null,h(BrowserRouter,null,h(DashboardLayout,null,h(CustomDomainSection))))));
"""

CLIENT = """
const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid'};
window.__calls=[];window.__forbidden=[];
class Query {
 constructor(table){this.table=table;this.one=false;}
 select(){return this;} eq(){return this;} order(){return this;} limit(){return this;}
 maybeSingle(){this.one=true;return this;} single(){this.one=true;return this;}
 then(resolve,reject){let data=this.table==='profiles'?[{id:user.id,store_slug:'aromadaamazoniarevenda',store_name:'Loja de teste',is_template_profile:false}]:[];return Promise.resolve({data:this.one?data[0]??null:data,error:null}).then(resolve,reject);}
 insert(){window.__forbidden.push(this.table);throw new Error('Hosted writes forbidden');}
 update(){return this.insert();} delete(){return this.insert();}
}
export const supabase={
 from:table=>new Query(table),
 auth:{getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 rpc:async(name,args)=>{
  window.__calls.push({rpc:name,args});
  if(name==='get_my_custom_domain_v2')return {data:window.__overview,error:null};
  if(name==='resolve_store_preferred_hostname')return {data:window.__overview.domain?.active?'www.redearoma.com.br':null,error:null};
  window.__forbidden.push(name);throw new Error('Unexpected RPC');
 },
 functions:{invoke:(name,options)=>{
  window.__calls.push({fn:name,body:options.body});
  if(name!=='verify-custom-domain-dns'){window.__forbidden.push(name);throw new Error('Unexpected function');}
  return new Promise(resolve=>{window.__finishVerify=(success)=>{
   if(success){window.__overview.domain.last_dns_check='2026-10-31T00:42:00Z';resolve({data:{state:'active'},error:null});}
   else resolve({data:null,error:{message:'feature_unavailable'}});
  }});
 }},
};
"""


def overview_for(mode):
    domain = dict(ACTIVE) if mode not in ("empty", "unavailable") else None
    if mode == "pending":
        domain.update(state="dns_pending", active=False, dns_verified_at=None, routing_status="not_started", ssl_status="pending")
    return {"available": mode != "unavailable", "ingress_ready": False, "records": [], "domain": domain,
            "purchase_url": "https://registrar.example.invalid"}


async def mount(context, mode):
    overview = mode if isinstance(mode, dict) else overview_for(mode)
    auth_source = await (await context.request.get(ORIGIN + "/src/contexts/AuthContext.tsx")).text()
    layout_source = await (await context.request.get(ORIGIN + "/src/components/layout/DashboardLayout.tsx")).text()
    deps = dict(re.findall(r'(/node_modules/\.vite/deps/[^"?]+)\?v=([^"\s]+)', auth_source + layout_source))
    main = MAIN
    for path, version in deps.items():
        main = main.replace(path + "\'", path + "?v=" + version + "\'")
    async def intercept(route):
        request = route.request
        if not request.url.startswith(ORIGIN + "/") or request.method not in ("GET", "HEAD"):
            await route.abort()
            return
        path = request.url[len(ORIGIN):].split("?")[0]
        overrides = {
            "/src/main.tsx": main,
            "/src/integrations/supabase/client.ts": CLIENT,
            "/src/hooks/useBrandNetwork.tsx": "export const useMinhaRedeMenuVisible=()=>false;",
            "/src/components/billing/GlobalBillingAlert.tsx": "export const GlobalBillingAlert=()=>null;",
            "/src/lib/auditLog.ts": "export const logAuditEvent=()=>{};",
        }
        if path in overrides:
            await route.fulfill(content_type="application/javascript", body=overrides[path])
            return
        response = await context.request.get(request.url)
        if request.is_navigation_request():
            body = (await response.text()).replace("<head>", "<head><script>window.__overview=" + json.dumps(overview) + ";window.__copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async(value)=>{window.__copied=value;}}});</script>")
            await route.fulfill(response=response, body=body)
        else:
            await route.fulfill(response=response)
    await context.route("**/*", intercept)


async def check_active(browser):
    context = await browser.new_context(viewport={"width": 1280, "height": 1800}, reduced_motion="reduce")
    await mount(context, "active")
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.goto(ORIGIN + "/lojista/store")
    await expect(page.locator("header").get_by_role("button", name="Gerenciar domínio", exact=True, include_hidden=True)).to_have_count(1)
    await expect(page.locator("main").get_by_text("www.redearoma.com.br", exact=True)).to_be_visible()
    await expect(page.locator("main").get_by_role("link", name="Visitar domínio", exact=True)).to_have_attribute("href", "https://www.redearoma.com.br")
    await page.wait_for_timeout(500)
    await page.screenshot(path=str(OUTPUT / "active-panel.png"))
    await page.locator("header").get_by_role("button", name="Gerenciar domínio", exact=True).click()
    dialog = page.get_by_role("dialog")
    await expect(dialog.get_by_text("www.redearoma.com.br", exact=True)).to_be_visible()
    await expect(dialog.get_by_role("heading", name="Informe seu domínio")).not_to_be_visible()
    await expect(dialog.get_by_text("Os registros de apontamento", exact=False)).not_to_be_visible()
    await expect(dialog.get_by_role("link", name="Visitar domínio")).to_have_attribute("href", "https://www.redearoma.com.br")
    async with page.expect_popup() as popup_event:
        await dialog.get_by_role("link", name="Visitar domínio").click()
    popup = await popup_event.value
    await popup.wait_for_timeout(100)
    await popup.close()
    await dialog.get_by_role("button", name="Desconectar domínio", exact=True).click()
    await expect(page.get_by_role("alertdialog").get_by_role("heading", name="Deseja desconectar www.redearoma.com.br?")).to_be_visible()
    await page.get_by_role("alertdialog").get_by_role("button", name="Manter domínio", exact=True).click()
    await dialog.get_by_role("button", name="Copiar endereço", exact=True).click()
    assert await page.evaluate("window.__copied") == "https://www.redearoma.com.br"
    timestamp = dialog.get_by_text("Última verificação:", exact=False)
    before = await timestamp.inner_text()
    await dialog.get_by_role("button", name="Verificar novamente", exact=True).click()
    await expect(dialog.get_by_role("button", name="Verificar novamente", exact=True)).to_be_disabled()
    assert await timestamp.inner_text() == before
    await page.evaluate("window.__finishVerify(false)")
    await expect(dialog.get_by_role("button", name="Verificar novamente", exact=True)).to_be_enabled()
    assert await timestamp.inner_text() == before
    await dialog.get_by_role("button", name="Verificar novamente", exact=True).click()
    assert await timestamp.inner_text() == before
    await page.evaluate("window.__finishVerify(true)")
    await expect(timestamp).not_to_have_text(before)
    await expect(dialog.get_by_text("Domínio conectado", exact=True).last).to_be_visible()
    await expect(page.locator("header").get_by_role("button", name="Gerenciar domínio", exact=True, include_hidden=True)).to_have_count(1)
    calls = await page.evaluate("window.__calls.filter(x=>x.fn)")
    assert calls == [{"fn": "verify-custom-domain-dns", "body": {}}, {"fn": "verify-custom-domain-dns", "body": {}}]
    assert await page.evaluate("window.__forbidden") == []
    await page.wait_for_timeout(500)
    await dialog.screenshot(path=str(OUTPUT / "active-management.png"))
    await dialog.get_by_role("button", name="Ver detalhes da configuração").click()
    await expect(dialog.get_by_text("DNS configurado e verificado.", exact=True)).to_be_visible()
    await expect(dialog.get_by_text("Os registros de apontamento", exact=False)).to_have_count(0)
    await expect(dialog.get_by_text("www.redearoma.com.br", exact=True).last).to_be_visible()
    await page.wait_for_timeout(500)
    await dialog.screenshot(path=str(OUTPUT / "active-details.png"))
    assert errors == [], errors
    print("PASS active: shared header/block/modal, exact host and copied URL, reverify success/failure, server timestamp, no forbidden calls")
    await context.close()


async def check_other(browser, mode, label):
    context = await browser.new_context(viewport={"width": 1280, "height": 1800}, reduced_motion="reduce")
    await mount(context, mode)
    page = await context.new_page()
    await page.goto(ORIGIN + "/lojista/store")
    await expect(page.locator("header").get_by_role("button", name=label, exact=True)).to_be_visible()
    await page.locator("header").get_by_role("button", name=label, exact=True).click()
    dialog = page.get_by_role("dialog")
    if mode == "unavailable":
        await expect(dialog.get_by_text("Domínio próprio temporariamente indisponível", exact=True)).to_be_visible()
        await expect(dialog.get_by_role("button", name="Verificar novamente")).to_have_count(0)
        await expect(dialog.get_by_role("textbox")).to_have_count(0)
    else:
        await expect(dialog.get_by_role("heading", name="Informe seu domínio", exact=False)).to_be_visible()
        if mode == "pending":
            await expect(dialog.get_by_text("www.redearoma.com.br", exact=True)).to_be_visible()
    await page.screenshot(path=str(OUTPUT / (mode + ".png")))
    assert await page.evaluate("window.__forbidden") == []
    print("PASS", mode, ": existing setup/controlled rollout preserved")
    await context.close()


CNAME = {"purpose": "www", "type": "CNAME", "host": "www", "value": "domains.shopdrive.com.br"}
ROOT_NULL = {"purpose": "root", "type": "A", "host": "@", "value": None}


def domain_in(state, **extra):
    d = dict(ACTIVE)
    d.update(state=state, active=False, routing_status="not_started", ssl_status="pending",
             domain="sualoja.com.br", display_hostname="www.sualoja.com.br")
    d.update(extra)
    return d


def state_overview(name):
    base = {"available": True, "ingress_ready": True, "records": [ROOT_NULL, CNAME],
            "purchase_url": "https://registrar.example.invalid", "domain": None}
    if name in ("free", "pro"):
        return {**base, "available": False, "unavailable_reason": "plan", "records": []}
    if name == "blocked":
        return {**base, "available": False, "unavailable_reason": "blocked", "records": []}
    if name in ("premium-empty", "marca-empty"):
        return base
    if name == "dns-pending":
        return {**base, "domain": domain_in("dns_pending", ownership_verified_at=None, dns_verified_at=None,
                txt_host="_shopdrive-verification.sualoja.com.br", txt_value="shopdrive=fixture-token")}
    if name == "dns-verified":
        return {**base, "domain": domain_in("dns_verified")}
    if name == "ssl-provisioning":
        return {**base, "domain": domain_in("ssl_provisioning", routing_status="active")}
    if name == "error":
        return {**base, "domain": domain_in("dns_error", dns_verified_at=None)}
    if name == "connected":
        return {**base, "domain": {**ACTIVE, "domain": "sualoja.com.br", "display_hostname": "www.sualoja.com.br"}}
    if name == "managed":
        return {**base, "domain": {**ACTIVE, "managed_by_platform": True}}
    raise ValueError(name)


async def check_states(browser):
    names = ["free", "pro", "premium-empty", "marca-empty", "dns-pending", "dns-verified", "ssl-provisioning",
             "connected", "managed", "blocked", "error"]
    for name in names:
        for label, viewport in (("desktop", {"width": 1280, "height": 1800}), ("mobile", {"width": 390, "height": 844})):
            context = await browser.new_context(viewport=viewport, reduced_motion="reduce")
            await mount(context, state_overview(name))
            page = await context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(ORIGIN + "/lojista/store")
            card = page.locator("section[aria-labelledby=custom-domain-title]")
            await expect(card.get_by_role("heading", name="Domínio próprio")).to_be_visible()
            if name in ("free", "pro"):
                await expect(card.get_by_text("Use o endereço da sua própria marca", exact=True)).to_be_visible()
                await expect(card.get_by_text("Disponível no Premium e MARCA", exact=True)).to_be_visible()
                await expect(card.get_by_role("button", name="Ver planos com domínio próprio")).to_be_visible()
                await expect(card.get_by_role("link", name="Já quer registrar seu domínio?")).to_be_visible()
                await expect(card.get_by_role("textbox")).to_have_count(0)
                await expect(card.get_by_role("button", name="Conectar meu domínio")).to_have_count(0)
            elif name.endswith("-empty"):
                await expect(card.get_by_role("button", name="Conectar meu domínio")).to_be_visible()
                await expect(card.get_by_text("domains.shopdrive.com.br")).to_have_count(0)
                await card.get_by_role("button", name="Como funciona?").click()
                await expect(card.get_by_text("informe o endereço com www", exact=False)).to_be_visible()
            elif name == "dns-pending":
                await expect(card.locator("[aria-current=step]")).to_contain_text("DNS")
                await expect(card.get_by_text("domains.shopdrive.com.br", exact=True)).to_be_visible()
                await expect(card.get_by_text("@", exact=True)).to_have_count(0)
                await expect(card.get_by_text("Utilize o endereço com www.", exact=True)).to_be_visible()
                await card.get_by_role("button", name="Copiar Destino").click()
                assert await page.evaluate("window.__copied") == "domains.shopdrive.com.br"
            elif name == "dns-verified":
                await expect(card.locator("[aria-current=step]")).to_contain_text("Verificação")
                await expect(card.get_by_text("DNS verificado", exact=True)).to_be_visible()
                await expect(card.get_by_text("Domínio conectado")).to_have_count(0)
            elif name == "ssl-provisioning":
                await expect(card.get_by_text("Aguardando certificado de segurança", exact=True)).to_be_visible()
                await expect(card.get_by_text("Você não precisa alterar o DNS novamente", exact=False)).to_be_visible()
                await expect(card.get_by_text("Domínio conectado")).to_have_count(0)
            elif name == "connected":
                await expect(card.get_by_text("Conectado", exact=True)).to_be_visible()
                await expect(card.get_by_role("link", name="Visitar domínio")).to_have_attribute("href", "https://www.sualoja.com.br")
                await expect(card.get_by_role("button", name="Gerenciar domínio")).to_be_visible()
            elif name == "managed":
                await expect(card.get_by_text("Gerenciado pela ShopDrive", exact=True)).to_be_visible()
                await expect(card.get_by_role("link", name="Visitar domínio")).to_have_attribute("href", "https://www.redearoma.com.br")
                if label == "desktop":
                    await card.get_by_role("button", name="Ver detalhes").click()
                    dialog = page.get_by_role("dialog")
                    await expect(dialog.get_by_text("Gerenciado pela ShopDrive", exact=True)).to_be_visible()
                    await expect(dialog.get_by_role("button", name="Verificar novamente")).to_have_count(0)
                    await expect(dialog.get_by_role("button", name="Desconectar domínio")).to_have_count(0)
                    await dialog.screenshot(path=str(OUTPUT / "state-managed-dialog.png"))
                    await page.keyboard.press("Escape")
            elif name == "blocked":
                await expect(card.get_by_text("Domínio próprio indisponível para esta loja", exact=True)).to_be_visible()
                await expect(card.get_by_role("textbox")).to_have_count(0)
                await expect(card.get_by_role("button")).to_have_count(0)
                await expect(card.get_by_text("domains.shopdrive.com.br")).to_have_count(0)
            elif name == "error":
                await expect(card.get_by_text("Não conseguimos confirmar a configuração do domínio.", exact=True)).to_be_visible()
                if label == "desktop":
                    await card.get_by_role("button", name="Verificar novamente").click()
                    await expect(card.get_by_role("button", name="Verificar novamente")).to_be_disabled()
                    calls = await page.evaluate("window.__calls.filter(x=>x.fn)")
                    assert calls == [{"fn": "verify-custom-domain-dns", "body": {}}], calls
                    await page.evaluate("window.__finishVerify(false)")
                    await expect(card.get_by_role("button", name="Verificar novamente")).to_be_enabled()
            if name != "error":
                assert await page.evaluate("window.__calls.filter(x=>x.fn).length") == 0
            assert await page.evaluate("window.__forbidden") == []
            overflow = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            card_overflow = await card.evaluate("e => e.scrollWidth - e.clientWidth")
            assert card_overflow <= 0, (name, label, card_overflow)
            await page.wait_for_timeout(200)
            await card.screenshot(path=str(OUTPUT / f"state-{name}-{label}.png"))
            assert errors == [], errors
            print("PASS state", name, label, "page overflow", overflow)
            await context.close()


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        await check_active(browser)
        await check_other(browser, "empty", "Conectar domínio próprio")
        await check_other(browser, "pending", "Continuar configuração")
        await check_other(browser, "unavailable", "Conectar domínio próprio")
        await check_states(browser)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())