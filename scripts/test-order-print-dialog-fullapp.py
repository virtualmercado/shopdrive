"""Full real app (AuthProvider, MerchantRoute, DashboardLayout, Orders) on the local dev server.
Every backend request is answered locally by a PostgREST emulator that honours ?select= columns.
Nothing leaves the sandbox; writes are rejected."""
import asyncio, json, re, base64, time, sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from playwright.async_api import async_playwright, expect

ORIGIN = "http://localhost:8080"
OUT = Path("/tmp/browser/order-print-fullapp"); OUT.mkdir(parents=True, exist_ok=True)
A = "11111111-1111-4111-8111-111111111111"
REF = "nkoogfznnqlnragbauez"
def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
EXP = int(time.time()) + 3600
JWT = b64({"alg":"HS256","typ":"JWT"}) + "." + b64({"sub":A,"role":"authenticated","exp":EXP,"aud":"authenticated","email":"m@example.invalid"}) + ".sig"
USER = {"id":A,"aud":"authenticated","role":"authenticated","email":"m@example.invalid","app_metadata":{},"user_metadata":{},"created_at":"2026-01-01T00:00:00Z"}
SESSION = {"access_token":JWT,"refresh_token":"synthetic","token_type":"bearer","expires_in":3600,"expires_at":EXP,"user":USER}

DATA = json.load(open(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "fixtures" / "order-print-v2-shape.json"))
DB = {
  "profiles":[{"id":A,"store_slug":"fixture-a","store_name":"Loja Fixture","is_template_profile":False,"full_name":"Lojista"}],
  **DATA,
}
RPC = {
  "get_my_store_context":{"storeId":A,"storeName":"Loja Fixture","storeSlug":"fixture-a","publicUrl":"https://shopdrive.com.br/loja/fixture-a","plan":"premium","status":"active","storeRole":"owner"},
  "get_my_managed_marca_stores":[],
}
seen = []
def emulate(req):
    u = urlparse(req.url); path = u.path; q = parse_qs(u.query, keep_blank_values=True)
    if "/auth/v1/user" in path: return 200, USER
    if "/auth/v1/token" in path: return 200, SESSION
    if "/auth/v1/" in path: return 200, {}
    if "/rest/v1/rpc/" in path:
        name = path.rsplit("/",1)[1]; seen.append(("rpc",name))
        return 200, RPC.get(name)
    if "/rest/v1/" in path:
        t = path.rsplit("/",1)[1]
        if req.method not in ("GET","HEAD"): seen.append(("WRITE",t)); return 403, {"message":"blocked"}
        rows = [dict(r) for r in DB.get(t, [])]
        for k, vals in q.items():
            if k in ("select","order","limit","offset"): continue
            for v in vals:
                if v.startswith("eq."): rows = [r for r in rows if str(r.get(k)) == v[3:]]
                elif v.startswith("in."): s = v[4:-1].split(","); rows = [r for r in rows if str(r.get(k)) in [x.strip('"') for x in s]]
        sel = q.get("select",["*"])[0]
        cols = [c.strip() for c in re.sub(r"\s+","",sel).split(",") if c.strip()]
        if "*" not in cols:
            rows = [{c: r.get(c) for c in cols if "(" not in c} for r in rows]
        seen.append(("get",t,sel[:80].replace("\n"," ")))
        rng = req.headers.get("range")
        if rng: a,b = map(int,rng.split("-")); rows = rows[a:b+1]
        if "vnd.pgrst.object" in (req.headers.get("accept") or ""):
            return (200, rows[0]) if rows else (406, {"message":"no rows"})
        return 200, rows
    if "/functions/v1/" in path: return 200, {}
    return 200, {}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width":1280,"height":1800}, accept_downloads=True)
        external = []
        async def route(r):
            req = r.request
            if req.url.startswith(ORIGIN + "/"):
                await r.continue_(); return
            if f"{REF}.supabase.co" in req.url:
                if req.method == "OPTIONS":
                    await r.fulfill(status=204, headers={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*"}); return
                st, body = emulate(req)
                await r.fulfill(status=st, content_type="application/json", headers={"access-control-allow-origin":"*","content-range":"0-*/*"}, body=json.dumps(body)); return
            external.append(req.url.split("?")[0]); await r.abort()
        await ctx.route("**/*", route)
        page = await ctx.new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(ORIGIN + "/robots.txt")
        await page.evaluate("([k,v])=>localStorage.setItem(k,v)", [f"sb-{REF}-auth-token", json.dumps(SESSION)])
        await page.add_init_script("window.print=()=>{}")
        await page.goto(ORIGIN + "/lojista/orders")
        try:
            await expect(page.get_by_text("Pedido #001253")).to_be_visible(timeout=30000)
        except AssertionError:
            await page.screenshot(path=str(OUT/"fail.png")); print("errs", errs[:3]); print(seen[-30:]); raise
        async def open_print(num):
            await page.locator("div.p-4").filter(has_text=f"Pedido {num}").get_by_title("Imprimir pedido").click()
            d = page.get_by_role("dialog").filter(has_text="Imprimir pedido"); await expect(d).to_be_visible(); return d
        async def choose(d, label):
            await d.get_by_role("combobox", name="Ordenar itens por").click()
            await page.get_by_role("option", name=label, exact=True).click()
        CODES = ["2446","0719","0714","0760","2038","0755","2258","2859"]
        def pdf_seq(txt):
            hits = sorted((m.start(), m.group(1)) for m in re.finditer(r"C\S{0,6}D: (\d{4})", txt))
            return [h[1] for h in hits]
        d = await open_print("#001253")
        sel = d.get_by_role("combobox", name="Ordenar itens por")
        print("v2 selector:", await sel.count(), "default:", (await sel.inner_text()).strip())
        await d.screenshot(path=str(OUT/"print-dialog.png"))
        await choose(d, "Produto"); await d.screenshot(path=str(OUT/"print-dialog-produto.png"))
        await page.keyboard.press("Escape")
        d = await open_print("#001253"); print("reopen default:", (await d.get_by_role("combobox", name="Ordenar itens por").inner_text()).strip())
        await page.keyboard.press("Escape")
        for label in ["Inserção","Produto","Código"]:
            d = await open_print("#001253")
            if label != "Inserção": await choose(d, label)
            async with page.expect_download() as dl:
                await d.get_by_role("button", name="PDF A4").click()
            f = OUT/f"pdf-{label}.pdf"; await (await dl.value).save_as(f)
            print("PDF", label, pdf_seq(f.read_bytes().decode("latin-1")))
        for label in ["Inserção","Produto","Código"]:
            d = await open_print("#001253")
            if label != "Inserção": await choose(d, label)
            await d.get_by_role("button", name=re.compile("Cupom térmico")).click()
            seq = None
            for _ in range(80):
                for fr in page.frames:
                    try:
                        t = await fr.evaluate("document.querySelector('.thermal-receipt')?.innerText || ''")
                    except Exception: continue
                    if "CÓD" in t: seq = re.findall(r"CÓD: (\d{4})", t)
                if seq: break
                await page.wait_for_timeout(50)
            print("CUPOM", label, seq)
            await page.screenshot(path=str(OUT/f"cupom-{label}.png"))
            await page.keyboard.press("Escape"); await page.wait_for_timeout(900)
            close = page.get_by_role("button", name=re.compile("Fechar|Cancelar"))
            if await close.count(): await close.first.click()
            await page.wait_for_timeout(300)
        d = await open_print("#000150")
        print("legacy selector:", await d.get_by_role("combobox", name="Ordenar itens por").count())
        async with page.expect_download() as dl:
            await d.get_by_role("button", name="PDF A4").click()
        f = OUT/"pdf-legacy.pdf"; await (await dl.value).save_as(f)
        print("PDF legacy", re.findall(r"(Zebra|Abacate) legado", f.read_bytes().decode("latin-1")))
        print("orders reads:", [x for x in seen if x[0]=="get" and x[1]=="orders"][:6])
        print("writes:", [x for x in seen if x[0]=="WRITE"], "errors:", errs[:3], "external:", sorted(set(external))[:5])
        await b.close()
asyncio.run(main())
