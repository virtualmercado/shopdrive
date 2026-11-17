"""Browser regression: order item presentation order (Inserção / Produto / Código).
Mounts the real Orders page, details dialog, edit modal, A4 PDF and thermal receipt with local fakes.
Every non-GET or external request is aborted; no hosted order, customer or account is touched.
"""
import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
OUT = Path("/tmp/browser/item-sort"); OUT.mkdir(parents=True, exist_ok=True)
A = "11111111-1111-4111-8111-111111111111"
K = "a0000000-0000-4000-8000-000000000001"
MAIN = (
    "import '/src/index.css';import * as React from '@@REACT@@';"
    "import {createRoot} from '@@REACTDOM@@';"
    "import {BrowserRouter,Routes,Route} from '@@ROUTER@@';"
    "import {QueryClient,QueryClientProvider} from '@@RQ@@';"
    "import Orders from '/src/pages/dashboard/Orders.tsx';"
    "import {Toaster} from '/src/components/ui/toaster.tsx';"
    "const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});"
    "const h=React.createElement;createRoot(document.getElementById('root')).render("
    "h(QueryClientProvider,{client:qc},h(BrowserRouter,null,h(Routes,null,"
    "h(Route,{path:'/lojista/orders',element:h(Orders)})),h(Toaster))));"
)
AUTH = f"""
const user={{id:'{A}',email:'merchant@example.invalid'}};
export const AuthProvider=({{children}})=>children;
export const useAuthContext=()=>({{user,session:{{user,access_token:'synthetic-not-real'}},loading:false,profileStatus:'complete',
 isMerchant:true,isTemplateProfile:false,storeSlug:'fixture-a',refreshProfile:async()=>{{}}}});
"""
LAYOUT = "export default function DashboardLayout({children}){return children}"
S, O, C, M = "p-sabonete", "p-oleo", "p-cha", "p-mel"
def it(id, order, pos, pid, name, price, qty, sku=None, var=None):
    return {"id": id, "order_id": order, "item_position": pos, "product_id": pid, "product_name": name, "product_price": price,
            "quantity": qty, "subtotal": price * qty, "variant_sku": sku, "variations": var, "variant_id": ("v-" + id) if sku and pid == S else None,
            "created_at": "2026-11-17T19:00:00Z"}
# Returned by the fake SELECT in a shuffled order (as the database may return them).
V2 = [it("i4", "o-v2", 4, C, "Chá", 8, 1, "CHA-01"), it("i1", "o-v2", 1, S, "Sabonete", 12, 1, "SAB-ACAI", {"Aroma": "Açaí"}),
      it("i5", "o-v2", 5, S, "Sabonete", 12, 2, "SAB-BREU", {"Aroma": "Breu"}), it("i2", "o-v2", 2, O, "Óleo de Copaíba", 30, 2),
      it("i3", "o-v2", 3, S, "Sabonete", 12, 3, "SAB-BURITI", {"Aroma": "Buriti"})]
LEGACY = [it("l2", "o-legacy", None, O, "Óleo de Copaíba", 30, 2), it("l1", "o-legacy", None, C, "Chá", 8, 1)]
MANY = [it(f"m{n:02d}", "o-many", 41 - n, f"p-{n:02d}", f"Produto {n:02d}", 1, 1) for n in [7, 31, 2, 40, 19, 11, 25, 1, 36, 14, 22, 5, 28, 9, 33, 17, 3, 38, 12, 27, 6, 20, 35, 15, 30, 10, 24, 4, 39, 18, 13, 29, 8, 34, 21, 16, 37, 23, 26, 32]]
def order(id, num, version, total, created):
    return {"id": id, "order_number": num, "customer_id": K, "customer_name": "Cliente Fictício", "customer_email": "k@example.invalid", "customer_phone": None,
            "customer_address": "Rua Fictícia, 1, Centro, Manaus - AM, CEP: 69000-000", "total_amount": total, "subtotal": total, "delivery_fee": 0,
            "delivery_method": None, "status": "pending", "payment_method": "pix", "notes": None, "created_at": created, "updated_at": created,
            "order_source": "manual", "store_owner_id": A, "order_format_version": version}
DB = {
    "orders": [order("o-v2", "#000201", 2, 140, "2026-11-17T19:00:00Z"), order("o-legacy", "#000150", None, 68, "2026-10-01T10:00:00Z"),
               order("o-many", "#000202", 2, 40, "2026-11-17T18:00:00Z")],
    "order_items": V2 + LEGACY + MANY,
    "customer_profiles": [{"id": K, "full_name": "Cliente Fictício", "email": "k@example.invalid", "phone": None, "cpf": None}],
    "store_customers": [{"id": "sc", "store_owner_id": A, "customer_id": K, "customer_code": "0001"}],
    "customer_addresses": [], "shipping_rules": [], "payment_settings": [],
    "products": [{"id": M, "user_id": A, "name": "Mel", "price": 20, "promotional_price": None, "stock": 10, "image_url": None, "inventory_mode": "simple"}],
    "profiles": [{"id": A, "store_name": "Loja Fixture", "store_slug": "fixture-a"}],
}
FAKE = """
window.__log=[];const db=@@DB@@;window.__db=db;
function rows(t,f){return (db[t]||[]).filter(r=>f.every(([k,v,op])=>op==='in'?v.includes(r[k]):r[k]===v));}
const builder=t=>{const f=[];let one=false,write=null;
  const q=new Proxy({},{get(_,p){
   if(p==='then')return (res,rej)=>{window.__log.push({kind:write?'write':'read',name:t,write});
     if(write)return Promise.resolve({data:null,error:{message:'blocked in test'}}).then(res,rej);
     const r=rows(t,f).map(x=>({...x}));return Promise.resolve({data:one?(r[0]??null):r,error:null,count:r.length}).then(res,rej);};
   if(p==='eq')return (k,v)=>{f.push([k,v]);return q};
   if(p==='in')return (k,v)=>{f.push([k,v,'in']);return q};
   if(p==='single'||p==='maybeSingle')return ()=>{one=true;return q};
   if(['update','insert','delete','upsert'].includes(p))return v=>{write={op:p,v};return q};
   return ()=>q;}});
  return q;};
export const supabase={from:builder,
  rpc:async(name,args)=>{window.__log.push({kind:'rpc',name,args});return {data:null,error:null};},
  channel:()=>{const c={on(){return c},subscribe(){return c}};return c},removeChannel:()=>{},
  auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})},
};
""".replace("@@DB@@", json.dumps(DB))

INSERTION = ["12.00", "60.00", "36.00", "8.00", "24.00"]   # Açaí, Óleo, Buriti, Chá, Breu
PRODUCT = ["8.00", "60.00", "12.00", "24.00", "36.00"]     # Chá, Óleo, Sabonete Açaí/Breu/Buriti
CODE = ["8.00", "12.00", "24.00", "36.00", "60.00"]        # CHA-01, SAB-ACAI, SAB-BREU, SAB-BURITI, (no code) Óleo
PDF_TOKENS = {"12.00": "Aroma: Açaí", "60.00": "Óleo de Copaíba", "36.00": "Aroma: Buriti", "8.00": "Chá", "24.00": "Aroma: Breu"}

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




def order_row(page, number):
    return page.locator("div.p-4").filter(has_text=f"Pedido {number}")

async def choose_sort(page, scope, label):
    await scope.get_by_role("combobox", name="Ordenar itens por").click()
    await page.get_by_role("option", name=label, exact=True).click()

def pdf_sequence(text, tokens):
    found = sorted((text.index("(" + tok + ")"), tok) for tok in tokens)
    return [t for _, t in found]

async def pdf_text(page, number, mode_label=None):
    await order_row(page, number).get_by_title("Imprimir pedido").click()
    dialog = page.get_by_role("dialog").filter(has_text="Imprimir pedido")
    if mode_label:
        await choose_sort(page, dialog, mode_label)
    async with page.expect_download() as dl:
        await dialog.get_by_role("button", name="PDF A4").click()
    path = OUT / f"{number.strip('#')}-{mode_label or 'default'}.pdf"
    await (await dl.value).save_as(path)
    return path.read_bytes().decode("latin-1")

async def thermal_sequence(page, number, mode_label):
    await page.evaluate("window.__thermal=null")
    await order_row(page, number).get_by_title("Imprimir pedido").click()
    dialog = page.get_by_role("dialog").filter(has_text="Imprimir pedido")
    await choose_sort(page, dialog, mode_label)
    await dialog.get_by_role("button", name=re.compile("Cupom térmico")).click()
    for _ in range(60):
        for fr in page.frames:
            try:
                vals = await fr.evaluate("Array.from(document.querySelectorAll('.thermal-receipt .item-values span:last-child')).map(s=>s.textContent)")
            except Exception:
                continue
            if vals:
                return [v.replace("R$ ", "").replace(",", ".") for v in vals[:-3] if v]  # drop subtotal/total rows
        await page.wait_for_timeout(50)
    raise AssertionError("thermal receipt not rendered")

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
        await page.add_init_script("window.print=()=>{}")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(f"{ORIGIN}/lojista/orders")
        await expect(page.get_by_text("Pedido #000201")).to_be_visible(timeout=20000)

        # ---------- Visualizar Pedido ----------
        await order_row(page, "#000201").get_by_role("button", name="Ver").click()
        dlg = page.get_by_role("dialog").filter(has_text="Itens do Pedido")
        await expect(dlg.get_by_text("Aroma: Açaí")).to_be_visible()
        subtotals = lambda: dlg.evaluate("d=>Array.from(d.querySelectorAll('p.font-semibold')).map(p=>p.textContent.replace('R$ ',''))")
        assert await subtotals() == INSERTION, await subtotals()
        await choose_sort(page, dlg, "Produto"); assert await subtotals() == PRODUCT, await subtotals()
        await page.screenshot(path=str(OUT / "1-view-product.png"))
        await choose_sort(page, dlg, "Código"); assert await subtotals() == CODE, await subtotals()
        assert await dlg.locator("p.font-semibold").count() == 5
        print("PASS view: Inserção/Produto/Código as specified; three soap lines stay separate and consecutive")
        await page.keyboard.press("Escape")
        await order_row(page, "#000150").get_by_role("button", name="Ver").click()
        dlg = page.get_by_role("dialog").filter(has_text="Itens do Pedido")
        await expect(dlg.get_by_text("Óleo de Copaíba")).to_be_visible()
        assert await dlg.get_by_role("combobox", name="Ordenar itens por").count() == 0
        assert await subtotals() == ["60.00", "8.00"]
        print("PASS legacy view: no sort selector, items kept exactly in their original fetched order")
        await page.keyboard.press("Escape")

        # ---------- Editar Pedido ----------
        await order_row(page, "#000201").get_by_title("Editar pedido").click()
        modal = page.get_by_role("dialog").filter(has_text="Editar Pedido")
        await expect(modal.get_by_text("Aroma: Açaí", exact=False)).to_be_visible()
        cells = lambda: modal.evaluate("d=>Array.from(d.querySelectorAll('.col-span-2.text-right.font-medium')).map(p=>p.textContent.replace('R$ ',''))")
        assert await cells() == INSERTION, await cells()
        await choose_sort(page, modal, "Produto"); assert await cells() == PRODUCT, await cells()
        await choose_sort(page, modal, "Código"); assert await cells() == CODE, await cells()
        await choose_sort(page, modal, "Inserção")
        await modal.get_by_placeholder("Buscar produto...").fill("Mel")
        await modal.get_by_text("Mel", exact=True).click()
        assert await cells() == INSERTION + ["20.00"], await cells()
        print("PASS edit: same rule in all three modes; a newly added line is shown at the end")
        await modal.get_by_role("button", name="Atualizar Pedido").click()
        await expect(modal).to_be_hidden()
        rpc = [e for e in await page.evaluate("window.__log") if e["kind"] == "rpc" and e["name"] == "update_manual_order"][-1]
        sent = [(i.get("product_name"), i.get("item_position"), i["quantity"], i["subtotal"]) for i in rpc["args"]["p_items"]]
        assert sent == [("Chá", 4, 1, 8), ("Sabonete", 1, 1, 12), ("Sabonete", 5, 2, 24), ("Óleo de Copaíba", 2, 2, 60), ("Sabonete", 3, 3, 36), ("Mel", None, 1, 20)], sent
        assert rpc["args"]["p_order"]["total_amount"] == 160 and rpc["args"]["p_order"]["subtotal"] == 160
        print("PASS edit save: existing lines keep their positions, new line has none (server assigns), quantities/totals untouched")
        await order_row(page, "#000150").get_by_title("Editar pedido").click()
        modal = page.get_by_role("dialog").filter(has_text="Editar Pedido")
        await expect(modal.get_by_text("Óleo de Copaíba")).to_be_visible()
        assert await modal.get_by_role("combobox", name="Ordenar itens por").count() == 0
        assert await cells() == ["60.00", "8.00"]
        await page.keyboard.press("Escape")
        print("PASS legacy edit: no sort selector, original order")

        # ---------- PDF A4 ----------
        for label, expected in (("Inserção", INSERTION), ("Produto", PRODUCT), ("Código", CODE)):
            txt = await pdf_text(page, "#000201", label)
            seq = pdf_sequence(txt, PDF_TOKENS.values())
            assert seq == [PDF_TOKENS[v] for v in expected], (label, seq)
        print("PASS PDF A4: the mode chosen in the print dialog is applied, identical to the screen")
        await order_row(page, "#000150").get_by_title("Imprimir pedido").click()
        dialog = page.get_by_role("dialog").filter(has_text="Imprimir pedido")
        assert await dialog.get_by_role("combobox", name="Ordenar itens por").count() == 0
        async with page.expect_download() as dl:
            await dialog.get_by_role("button", name="PDF A4").click()
        path = OUT / "legacy.pdf"; await (await dl.value).save_as(path)
        assert pdf_sequence(path.read_bytes().decode("latin-1"), ["Óleo de Copaíba", "Chá"]) == ["Óleo de Copaíba", "Chá"]
        print("PASS legacy PDF: no selector, items in the legacy order")

        names = [f"Produto {n:02d}" for n in range(1, 41)]
        txt = await pdf_text(page, "#000202", "Inserção")
        pages = txt.count("/Type /Page\n") or len(re.findall(r"/Type /Page[^s]", txt))
        assert pages >= 2, pages
        assert pdf_sequence(txt, names) == list(reversed(names))
        txt = await pdf_text(page, "#000202", "Produto"); assert pdf_sequence(txt, names) == names
        txt = await pdf_text(page, "#000202", "Código"); assert pdf_sequence(txt, names) == names
        nums = re.findall(r"\((\d{2})\) Tj", txt)
        assert [int(n) for n in nums[:40]] == list(range(1, 41)) or len(set(nums)) >= 40
        print(f"PASS multipage PDF ({pages} pages): one continuous sequence across pages in all three modes")

        # ---------- Thermal receipt ----------
        for label, expected in (("Inserção", INSERTION), ("Produto", PRODUCT), ("Código", CODE)):
            seq = await thermal_sequence(page, "#000201", label)
            assert seq == expected, (label, seq)
            await page.wait_for_timeout(900)
        print("PASS thermal receipt: same rule and chosen mode")

        log = await page.evaluate("window.__log")
        assert not [e for e in log if e["kind"] == "write"], "no direct table writes"
        assert not errors, errors
        assert not [b for b in blocked if "supabase" in b], blocked
        print("PASS no page errors; no hosted reads/writes")
        print("ALL PASS")
        await browser.close()

asyncio.run(main())
