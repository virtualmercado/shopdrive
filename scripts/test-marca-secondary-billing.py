"""Verify the real invoice-history UI with synthetic sessions/data and all hosted traffic blocked."""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
OUTPUT = Path("/tmp/browser/marca-secondary-billing")
MAIN = """
import '/src/index.css';
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {BrowserRouter} from '/node_modules/.vite/deps/react-router-dom.js';
import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js';
import {AuthProvider} from '/src/contexts/AuthContext.tsx';
import {InvoiceHistorySection} from '/src/components/financeiro/InvoiceHistorySection.tsx';
const h=React.createElement;
ReactDOM.createRoot(document.getElementById('root')).render(h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},h(AuthProvider,null,h(BrowserRouter,null,h('main',null,h(InvoiceHistorySection))))));
"""
CLIENT = """
const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid'};
window.__forbidden=[];
class Query {
 constructor(table){this.table=table;this.one=false;}
 select(){return this;}eq(column,id){if(['subscriber_id','user_id'].includes(column)&&id!==user.id)throw Error('Unexpected store');return this;}
 order(){return this;}limit(){return this;}single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
 then(resolve,reject){let data=[];
  if(this.table==='profiles')data=[{store_slug:'fixture-store',store_name:'Loja fictícia',is_template_profile:false}];
  else if(this.table==='invoices')data=window.__fixtures.invoices;
  else if(this.table==='master_subscriptions')data=[window.__fixtures.subscription];
  else if(this.table!=='store_customers')throw Error('Unexpected table '+this.table);
  return Promise.resolve({data:this.one?data[0]??null:data,error:null,count:0}).then(resolve,reject);
 }
 insert(){window.__forbidden.push(this.table);throw Error('Hosted writes forbidden');}update(){return this.insert();}delete(){return this.insert();}
}
export const supabase={
 from:table=>new Query(table),
 auth:{getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 rpc:async(name,args)=>{if(name!=='get_product_plan_usage'||args.p_store_id!==user.id){window.__forbidden.push(name);throw Error('Unexpected RPC');}
  return {data:{plan:'premium',activeProducts:217,planSource:'direct',ownedStoreRole:window.__fixtures.role},error:null};}
};
"""


async def check(browser, role, open_invoice=False, mobile=False):
    context = await browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1280, "height": 1800})
    source = await (await context.request.get(ORIGIN + "/src/contexts/AuthContext.tsx")).text()
    main = MAIN
    for path, version in re.findall(r'(/node_modules/\.vite/deps/[^"?]+)\?v=([^"\s]+)', source):
        main = main.replace(path + "'", path + "?v=" + version + "'")
    invoice = {"id": "22222222-2222-4222-8222-222222222222", "due_date": "2026-10-20T00:00:00Z", "amount": 49.97,
               "plan": "premium", "status": "pending" if open_invoice else "paid", "payment_method": "credit_card", "mp_payment_id": None,
               "paid_at": None if open_invoice else "2026-10-20T12:00:00Z", "created_at": "2026-10-20T00:00:00Z"}
    fixture = {"role": role, "invoices": [invoice], "subscription": {"plan_id": "premium", "billing_cycle": "monthly", "status": "active",
               "no_charge": False, "current_period_end": "2099-11-20T00:00:00Z", "payment_method": "credit_card"}}
    blocked = []

    async def intercept(route):
        request = route.request
        if not request.url.startswith(ORIGIN + "/") or request.method not in ("GET", "HEAD"):
            blocked.append(request.method)
            await route.abort()
            return
        path = request.url[len(ORIGIN):].split("?")[0]
        overrides = {"/src/main.tsx": main, "/src/integrations/supabase/client.ts": CLIENT}
        if path in overrides:
            await route.fulfill(content_type="application/javascript", body=overrides[path])
            return
        response = await context.request.get(request.url)
        if request.is_navigation_request():
            body = (await response.text()).replace("<head>", "<head><script>window.__fixtures=" + json.dumps(fixture) + ";</script>")
            await route.fulfill(response=response, body=body)
        else:
            await route.fulfill(response=response)

    await context.route("**/*", intercept)
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.goto(ORIGIN + "/lojista/financeiro")
    await page.wait_for_timeout(1200)
    print("Diagnostic", errors, (await page.locator("body").inner_text())[:300])
    await page.screenshot(path=str(OUTPUT / "diagnostic.png"))
    await expect(page.get_by_role("heading", name="Histórico de faturas")).to_be_visible()
    await expect(page.get_by_role("cell", name="PREMIUM").first).to_be_visible()
    if role == "secondary":
        await expect(page.get_by_role("button", name="Pagar fatura")).to_have_count(0)
        await expect(page.get_by_text("A vencer", exact=True)).to_have_count(0)
        await expect(page.get_by_text("Aguardando pagamento" if open_invoice else "Paga", exact=True)).to_be_visible()
    else:
        await expect(page.get_by_role("button", name="Pagar fatura")).to_have_count(1)
        if not open_invoice:
            await expect(page.get_by_text("A vencer", exact=True)).to_be_visible()
    await page.locator("main").screenshot(path=str(OUTPUT / f"{role or 'single'}-{'pending' if open_invoice else 'paid'}-{'mobile' if mobile else 'desktop'}.png"))
    assert await page.evaluate("window.__forbidden") == []
    assert blocked == [], blocked
    assert errors == [], errors
    print("PASS", role or "single", "pending" if open_invoice else "paid", "mobile" if mobile else "desktop", "history retained; no hosted writes")
    await context.close()


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        await check(browser, "secondary")
        await check(browser, "secondary", open_invoice=True)
        await check(browser, "secondary", mobile=True)
        await check(browser, "primary")
        await check(browser, None, open_invoice=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())