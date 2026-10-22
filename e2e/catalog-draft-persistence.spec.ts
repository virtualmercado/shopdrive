import { test, expect } from "@playwright/test";
import { installDraftFixture } from "./catalogDraftFixture";

test.setTimeout(90000);
test("real editor saves, restores across menu/reload/new browser, retains 74-page PDF and only explicitly publishes", async ({ page, context, browser }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  const s = await installDraftFixture(context);
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8080/__catalog-draft-test");
  await expect(page.getByRole("heading", { name: "Configurar catálogo Editorial" })).toBeVisible();
  await page.getByRole("button", { name: "2. Capa", exact: true }).click();
  await page.locator("#ed-title").fill("Persistência teste 20");
  await expect(page.getByRole("status")).toContainText("Alterações salvas");
  expect(s.saves).toBeLessThan(4);
  await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 1 de 74");
  expect(s.generations).toBe(1); expect(s.published).toBe("A"); expect(s.publications).toBe(0);
  await page.getByRole("button", { name: "Ir para a última página", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 74 de 74");
  await page.getByRole("link", { name: "Outro menu", exact: true }).click();
  await page.getByRole("link", { name: "Voltar ao catálogo", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 1 de 74");
  expect(s.generations).toBe(1);
  await page.reload();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 1 de 74");
  await page.getByRole("button", { name: "2. Capa", exact: true }).click();
  await expect(page.locator("#ed-title")).toHaveValue("Persistência teste 20");
  await expect(page.getByRole("button", { name: "Publicar catálogo", exact: true })).toBeEnabled();
  // No browser storage transfer; the server double supplies the saved draft/PDF.
  const other = await browser.newContext({ viewport: { width: 390, height: 1800 } });
  await installDraftFixtureShared(other, s);
  await other.close();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
  expect(await (await download).failure()).toBeNull(); expect(s.published).toBe("A");
  s.failUpload = true;
  await page.getByRole("button", { name: "Atualizar prévia", exact: true }).click();
  await expect(page.getByText("Não foi possível atualizar a prévia.", { exact: false })).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 1 de 74");
  expect(s.generations).toBe(1); expect(s.published).toBe("A");
  s.failUpload = false;
  await page.getByRole("button", { name: "Publicar catálogo", exact: true }).click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Catálogo publicado!", { exact: false })).toBeVisible();
  expect(s.published).toBe("B"); expect(s.publications).toBe(1); expect(errors).toEqual([]);
  await page.getByRole("heading", { name: "7. Pré-visualização" }).locator("../..").screenshot({ path: "/tmp/browser/catalog-persistence/desktop.png" });
});

async function installDraftFixtureShared(context: import("@playwright/test").BrowserContext, source: Awaited<ReturnType<typeof installDraftFixture>>) {
  const remote = await installDraftFixture(context);
  Object.assign(remote, source);
  const page = await context.newPage();
  await page.goto("http://localhost:8080/__catalog-draft-test");
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 1 de 74");
  await page.getByRole("button", { name: "2. Capa", exact: true }).click();
  await expect(page.locator("#ed-title")).toHaveValue("Persistência teste 20");
  await page.getByRole("button", { name: "Ir para a última página", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", "Página 74 de 74");
  await page.getByRole("heading", { name: "7. Pré-visualização" }).locator("../..").screenshot({ path: "/tmp/browser/catalog-persistence/mobile.png" });
}

test("save failure keeps local edit and preview; retry saves; concurrent revision never overwrites", async ({ page, context }) => {
  const s = await installDraftFixture(context);
  await page.goto("http://localhost:8080/__catalog-draft-test");
  await expect(page.getByRole("heading", { name: "Configurar catálogo Editorial" })).toBeVisible();
  await page.getByRole("button", { name: "2. Capa", exact: true }).click();
  s.failSave = true;
  await page.locator("#ed-title").fill("Local preservado");
  await expect(page.getByRole("status")).toContainText("Não foi possível salvar");
  await expect(page.locator("#ed-title")).toHaveValue("Local preservado");
  s.failSave = false;
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Alterações salvas");
  expect((s.config as { title: string }).title).toBe("Local preservado");
  s.draft_revision++;
  await page.locator("#ed-title").fill("Conflito preservado");
  await expect(page.getByRole("status")).toContainText("outra aba");
  expect((s.config as { title: string }).title).toBe("Local preservado");
  await expect(page.locator("#ed-title")).toHaveValue("Conflito preservado");
});