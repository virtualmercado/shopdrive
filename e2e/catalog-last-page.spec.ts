import { expect, test } from "@playwright/test";

// Mount the real configurator and PDF engines with fictitious local data only.
// No account credentials, real backend requests, uploads or publication are allowed.
test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://localhost:8080") {
      await route.abort();
      return;
    }
    if (url.pathname === "/__catalog-navigation-test") {
      await route.fulfill({ contentType: "text/html", body: `
        <html><body style="margin:0"><div id="root"></div>
        <script type="module">
          import RefreshRuntime from '/@react-refresh';
          RefreshRuntime.injectIntoGlobalHook(window);
          window.$RefreshReg$ = () => {};
          window.$RefreshSig$ = () => type => type;
          window.__vite_plugin_react_preamble_installed__ = true;
        </script>
        <script type="module">
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
          import Configurator from '/src/components/catalog/editorial/EditorialCatalogConfigurator.tsx';
          import '/src/index.css';
          ReactDOM.createRoot(document.getElementById('root')).render(
            React.createElement(TooltipProvider, null, React.createElement(Configurator))
          );
        </script></body></html>` });
      return;
    }
    if (url.pathname === "/src/hooks/useAuth.tsx") {
      await route.fulfill({ contentType: "application/javascript", body: `
        const user = {id:'fixture-store-b'};
        export const useAuth = () => ({user});
      ` });
      return;
    }
    if (url.pathname === "/src/lib/catalog-v2/catalogLoader.ts") {
      await route.fulfill({ contentType: "application/javascript", body: `
        import {fixtureStoreB} from '/src/lib/catalog-v2/editorial/editorialFixtures.ts';
        export async function loadCatalogSource() {
          const source = fixtureStoreB(216);
          source.profile.store_logo_url = null;
           const imageProducts = Number(new URLSearchParams(window.location.search).get('imageProducts') ?? 30);
           source.products.forEach((p,i) => {p.image_url = i < imageProducts ? '/placeholder.svg' : null;});
          return source;
        }
      ` });
      return;
    }
    if (url.pathname === "/src/integrations/supabase/client.ts") {
      await route.fulfill({ contentType: "application/javascript", body: `
        let seq=0,pending=null;
        export const supabase = {
          rpc: async (name,args) => {
            if(name==='begin_my_catalog_preview'){pending={id:'local-'+(++seq),path:'fixture-store-b/local-'+seq+'.pdf',publication_baseline:{updatedAt:null,hasCurrent:false}};return {data:pending,error:null};}
            if(name==='complete_my_catalog_preview')return {data:{preview:{...pending,page_count:args._page_count,generated_at:new Date().toISOString()},stale:false},error:null};
            if(name==='discard_my_catalog_preview')return {data:null,error:null};
            throw new Error('Test forbids production/publication calls');
          },
          storage: {from: () => ({upload:async()=>({error:null}),list:async()=>({data:[]}),remove:async()=>({error:null})})}
        };
      ` });
      return;
    }
    if (url.pathname === "/src/components/catalog/editorial/useCatalogDraftPersistence.ts") {
      // Navigation regression tests isolate persistence; dedicated persistence
      // tests below exercise the real hook with a local per-store server double.
      await route.fulfill({ contentType: "application/javascript", body: `
        import {useState} from '/node_modules/.vite/deps/react.js';
        export function useCatalogDraftPersistence(storeId, config) {
          const [record,setRecord]=useState(null);
          const result=()=>({config,draft_revision:0,source_revision:0,preview:record?.preview??null,stale:false});
          return {ready:true,record,status:'saved',loadError:false,flush:async()=>true,checkCurrent:async()=>result(),getRevision:()=>0,setRecord,retryLoad:()=>{}};
        }` });
      return;
    }
    if (url.pathname === "/src/lib/catalog-v2/editorial/pdfPreview.ts") {
      const response = await route.fetch();
      const body = (await response.text()).replace("function renderPdfPreview(", "function renderUnderlyingPreview(");
      await route.fulfill({ response, body: body + `
        export async function renderPdfPreview(bytes, opts) {
          (window.catalogRenderedPages ??= []).push(opts.pages);
          return renderUnderlyingPreview(bytes, opts);
        }
      ` });
      return;
    }
    await route.continue();
  });
});

const canvasPage = (page: import("@playwright/test").Page, current: number, total: number) =>
  expect(page.locator("canvas")).toHaveAttribute("aria-label", `Página ${current} de ${total}`);

test("jumps 1 → 74 and 5 → 74; returns, zooms, downloads and uses a regenerated total", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8080/__catalog-navigation-test");
  const last = page.getByRole("button", { name: "Ir para a última página", exact: true });
  await expect(page.getByRole("button", { name: "Gerar prévia", exact: true })).toBeVisible();
  await expect(last).toHaveCount(0);
  await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
  await canvasPage(page, 1, 74);
  await page.evaluate("window.catalogRenderedPages = []");
  await last.focus();
  await expect(page.getByRole("tooltip")).toContainText("Ir para a última página");
  await page.keyboard.press("Enter");
  await canvasPage(page, 74, 74);
  expect(await page.evaluate("window.catalogRenderedPages")).toEqual([[74]]);
  await expect(last).toBeDisabled();
  await expect(page.getByRole("button", { name: "Próxima página", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Página anterior", exact: true }).click();
  await canvasPage(page, 73, 74);
  await page.getByRole("button", { name: "Ampliar", exact: true }).click();
  await canvasPage(page, 73, 74);
  await page.getByRole("button", { name: "Reduzir", exact: true }).click();
  await canvasPage(page, 73, 74);
  await page.getByRole("button", { name: "Atualizar prévia", exact: true }).click();
  await canvasPage(page, 1, 74);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Próxima página", exact: true }).click();
    await canvasPage(page, i + 2, 74);
  }
  await last.click();
  await canvasPage(page, 74, 74);
  await page.getByRole("checkbox", { name: /Deixar esses produtos fora/ }).check();
  await page.getByRole("button", { name: "Atualizar prévia", exact: true }).click();
  await canvasPage(page, 1, 12);
  await last.click();
  await canvasPage(page, 12, 12);
  await expect(last).toBeDisabled();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  await expect(page.getByRole("button", { name: "Publicar catálogo", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("jumps 49 → 1 and 74 → 1 directly; preserves keyboard, zoom, adjacent pages and a new 68-page total", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8080/__catalog-navigation-test?imageProducts=198");
  const first = page.getByRole("button", { name: "Ir para a primeira página", exact: true });
  const last = page.getByRole("button", { name: "Ir para a última página", exact: true });
  const previous = page.getByRole("button", { name: "Página anterior", exact: true });
  const next = page.getByRole("button", { name: "Próxima página", exact: true });
  await expect(first).toHaveCount(0);
  await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
  await canvasPage(page, 1, 74);
  await expect(first).toBeDisabled();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(last).toBeEnabled();
  await last.click();
  await canvasPage(page, 74, 74);
  await expect(first).toBeEnabled();
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();
  await expect(last).toBeDisabled();
  await page.evaluate("window.catalogRenderedPages = []");
  await first.focus();
  await expect(page.getByRole("tooltip")).toContainText("Ir para a primeira página");
  await page.keyboard.press("Enter");
  await canvasPage(page, 1, 74);
  expect(await page.evaluate("window.catalogRenderedPages")).toEqual([[1]]);

  await last.click();
  await canvasPage(page, 74, 74);
  for (let current = 73; current >= 49; current--) {
    await previous.click();
    await canvasPage(page, current, 74);
  }
  await page.evaluate("window.catalogRenderedPages = []");
  await first.click();
  await canvasPage(page, 1, 74);
  expect(await page.evaluate("window.catalogRenderedPages")).toEqual([[1]]);
  for (let current = 2; current <= 10; current++) {
    await next.click();
    await canvasPage(page, current, 74);
  }
  await previous.click();
  await canvasPage(page, 9, 74);
  await next.click();
  await canvasPage(page, 10, 74);
  await last.click();
  await canvasPage(page, 74, 74);
  await page.getByRole("button", { name: "Ampliar", exact: true }).click();
  await canvasPage(page, 74, 74);
  await first.click();
  await canvasPage(page, 1, 74);
  await page.getByRole("button", { name: "Reduzir", exact: true }).click();
  await canvasPage(page, 1, 74);
  await page.getByRole("checkbox", { name: /Deixar esses produtos fora/ }).check();
  await page.getByRole("button", { name: "Atualizar prévia", exact: true }).click();
  await canvasPage(page, 1, 68);
  await expect(first).toBeDisabled();
  await last.click();
  await canvasPage(page, 68, 68);
  await first.click();
  await canvasPage(page, 1, 68);
  await expect(previous).toBeDisabled();
  await expect(page.getByRole("button", { name: "Baixar PDF", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Publicar catálogo", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("a one-page PDF disables all navigation without errors", async ({ page }) => {
  // A real single-page jsPDF document tests this boundary without changing the catalog composer.
  await page.route("**/src/lib/catalog-v2/editorial/generateEditorialPdf.ts", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `
      import {jsPDF} from '/node_modules/.vite/deps/jspdf.js';
      export async function generateEditorialPdf() {
        const pdf = new jsPDF();
        pdf.text('Single page navigation fixture', 20, 20);
        return {bytes:pdf.output('arraybuffer'),pageCount:pdf.getNumberOfPages(),issues:[]};
      }
    ` });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8080/__catalog-navigation-test");
  await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
  await canvasPage(page, 1, 1);
  for (const name of ["Ir para a primeira página", "Página anterior", "Próxima página", "Ir para a última página"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  expect(errors).toEqual([]);
});

for (const width of [1280, 1024, 768, 390, 320]) {
  test(`navigation fits ${width}px without overflow, preserving touch targets and zoom`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1800 });
    await page.goto("http://localhost:8080/__catalog-navigation-test");
    await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
    await canvasPage(page, 1, 74);
    const first = page.getByRole("button", { name: "Ir para a primeira página", exact: true });
    const last = page.getByRole("button", { name: "Ir para a última página", exact: true });
    await last.click();
    await canvasPage(page, 74, 74);
    await page.getByRole("button", { name: "Página anterior", exact: true }).click();
    await canvasPage(page, 73, 74);
    await page.getByRole("button", { name: "Ampliar", exact: true }).click();
    await canvasPage(page, 73, 74);
    await page.getByRole("button", { name: "Reduzir", exact: true }).click();
    await canvasPage(page, 73, 74);
    await first.click();
    await canvasPage(page, 1, 74);
    await page.getByRole("button", { name: "Próxima página", exact: true }).click();
    await canvasPage(page, 2, 74);
    await page.getByRole("button", { name: "Página anterior", exact: true }).click();
    await canvasPage(page, 1, 74);
    const geometry = await first.evaluate((element) => {
      const toolbar = element.parentElement?.parentElement;
      const rect = element.getBoundingClientRect();
      const controls = toolbar ? Array.from(toolbar.querySelectorAll("button, span.text-sm")) : [];
      const bounds = controls.map((control) => control.getBoundingClientRect());
      const overlaps = bounds.some((a, i) => bounds.slice(i + 1).some((b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
      const firstAfterPrevious = element.nextElementSibling?.getAttribute("aria-label") !== "Página anterior";
      return { width: rect.width, height: rect.height, overlaps, firstAfterPrevious,
        overflow: toolbar ? toolbar.scrollWidth > toolbar.clientWidth : true,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(40);
    expect(geometry.height).toBeGreaterThanOrEqual(40);
    expect(geometry.firstAfterPrevious).toBe(false);
    expect(geometry.overlaps).toBe(false);
    expect(geometry.overflow).toBe(false);
    expect(geometry.pageOverflow).toBe(false);
    await page.getByRole("heading", { name: "7. Pré-visualização" }).locator("../..").screenshot({
      path: `/tmp/browser/catalog-first-page/preview-${width}.png`,
    });
  });
}