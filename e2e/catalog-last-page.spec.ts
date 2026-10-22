import { expect, test } from "@playwright/test";

// Mount the real configurator and PDF engines with fictitious local data only.
// No account credentials, backend requests, uploads or publication are allowed.
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
        export const useAuth = () => ({user:{id:'fixture-store-b'}});
      ` });
      return;
    }
    if (url.pathname === "/src/lib/catalog-v2/catalogLoader.ts") {
      await route.fulfill({ contentType: "application/javascript", body: `
        import {fixtureStoreB} from '/src/lib/catalog-v2/editorial/editorialFixtures.ts';
        export async function loadCatalogSource() {
          const source = fixtureStoreB(216);
          source.profile.store_logo_url = null;
          source.products.forEach((p,i) => {p.image_url = i < 30 ? '/placeholder.svg' : null;});
          return source;
        }
      ` });
      return;
    }
    if (url.pathname === "/src/integrations/supabase/client.ts") {
      await route.fulfill({ contentType: "application/javascript", body: `
        export const supabase = {
          rpc: async name => {
            if (name !== 'get_my_current_catalog_state') throw new Error('Test forbids writes');
            return {data:{updated_at:null,has_current:false},error:null};
          },
          storage: {from: () => {throw new Error('Test forbids uploads');}}
        };
      ` });
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

for (const width of [1280, 1024, 768, 390, 320]) {
  test(`navigation fits ${width}px without overflow, preserving touch targets and zoom`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1800 });
    await page.goto("http://localhost:8080/__catalog-navigation-test");
    await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
    await canvasPage(page, 1, 74);
    const last = page.getByRole("button", { name: "Ir para a última página", exact: true });
    await last.click();
    await canvasPage(page, 74, 74);
    await page.getByRole("button", { name: "Página anterior", exact: true }).click();
    await canvasPage(page, 73, 74);
    await page.getByRole("button", { name: "Ampliar", exact: true }).click();
    await canvasPage(page, 73, 74);
    await page.getByRole("button", { name: "Reduzir", exact: true }).click();
    await canvasPage(page, 73, 74);
    const geometry = await last.evaluate((element) => {
      const toolbar = element.parentElement?.parentElement;
      const rect = element.getBoundingClientRect();
      const controls = toolbar ? Array.from(toolbar.querySelectorAll("button, span.text-sm")) : [];
      const bounds = controls.map((control) => control.getBoundingClientRect());
      const overlaps = bounds.some((a, i) => bounds.slice(i + 1).some((b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
      return { width: rect.width, height: rect.height, overlaps,
        overflow: toolbar ? toolbar.scrollWidth > toolbar.clientWidth : true,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(40);
    expect(geometry.height).toBeGreaterThanOrEqual(40);
    expect(geometry.overlaps).toBe(false);
    expect(geometry.overflow).toBe(false);
    expect(geometry.pageOverflow).toBe(false);
    await page.getByRole("heading", { name: "7. Pré-visualização" }).locator("../..").screenshot({
      path: `/tmp/browser/catalog-last-page/preview-${width}.png`,
    });
  });
}