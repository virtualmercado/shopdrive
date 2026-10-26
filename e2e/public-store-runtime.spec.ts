import { expect, test } from "@playwright/test";
import { mountRuntimeFixture, STORE_A, STORE_B, PRODUCT_A, PRODUCT_B, ORDER_A } from "./public-store-runtime.fixture";

const external = "http://loja-piloto.exemplo";
const platform = "http://localhost:8080";

test("hostname store navigation → product → cart → checkout → mocked order reads back", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mountRuntimeFixture(page, external);
  await page.goto(`${external}/`);
  await expect(page.getByRole("heading", { name: "Produto A", exact: true })).toBeVisible();
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Produto A", exact: true }) }).click();
  await expect(page).toHaveURL(`${external}/produto/${PRODUCT_A}`);
  await expect(page.getByRole("heading", { name: "Produto A", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao Carrinho", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Carrinho de Compras" })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar Compra", exact: true }).click();
  await expect(page).toHaveURL(`${external}/checkout`);
  await page.getByLabel("Nome completo *", { exact: true }).fill("Cliente Fictício");
  await page.getByLabel("Telefone/WhatsApp *", { exact: true }).fill("00000000000");
  await page.getByText("Combinar via WhatsApp", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Finalizar compra", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Finalizar compra", exact: true }).click();
  await expect(page).toHaveURL(`${external}/pedido-confirmado/${ORDER_A}`);
  await expect(page.getByText("TESTE-001", { exact: true })).toBeVisible();
  await expect(page.getByText("Produto A", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__createdOrder.p_store_owner_id)).toBe(STORE_A);
  expect(await page.evaluate(() => (window as any).__createdOrder.p_items[0].product_id)).toBe(PRODUCT_A);
  const productCalls = await page.evaluate(() => (window as any).__calls.filter((c: any) => c.table === "products"));
  expect(productCalls.some((c: any) => c.filters.some(([k, v]: string[]) => k === "user_id" && v === STORE_A))).toBe(true);
  expect(await page.evaluate(() => (window as any).__forbidden)).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/browser/hostname-runtime/order.png" });
});

test("search ignores previous tenant in state, storage and query", async ({ page }) => {
  await mountRuntimeFixture(page, external);
  await page.goto(`${external}/`);
  await page.evaluate(() => {
    sessionStorage.setItem("vm_active_store_slug", "loja-b");
    history.replaceState({ usr: { storeSlug: "loja-b" } }, "", "/");
  });
  await page.goto(`${external}/buscar?q=produto&storeSlug=loja-b&store_id=${STORE_B}`);
  await expect(page.getByRole("heading", { name: "Produto A", exact: true })).toBeVisible();
  await expect(page.getByText("Produto B", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.rpc === "search_store_products").args.p_store_slug)).toBe("loja-a");
});

test("custom-host slug and other-store product cannot select store B", async ({ page }) => {
  await mountRuntimeFixture(page, external);
  await page.goto(`${external}/loja-b`);
  await expect(page.getByRole("heading", { name: "Página não encontrada." })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.table === "public_store_profiles"))).toEqual([]);
  await page.goto(`${external}/produto/${PRODUCT_B}`);
  await expect(page.getByRole("heading", { name: "Produto não encontrado" })).toBeVisible();
  await expect(page.getByText("Produto B", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.table === "products").filters)).toContainEqual(["user_id", STORE_A]);
});

test("custom order cannot fall back to another store's cached confirmation", async ({ page }) => {
  await mountRuntimeFixture(page, external);
  await page.goto(`${external}/`);
  await page.evaluate(([id, store]) => sessionStorage.setItem(`shopdrive_checkout_order:${id}`, JSON.stringify({ order: { store_owner_id: store, order_number: "OTHER-STORE" } })), [PRODUCT_B, STORE_B]);
  await page.goto(`${external}/pedido-confirmado/${PRODUCT_B}`);
  await expect(page.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.table === "orders").filters)).toContainEqual(["store_owner_id", STORE_A]);
});

for (const resolution of ["zero", "error", "malformed"]) {
  test(`external ${resolution} is neutral without landing or slug fallback`, async ({ page }) => {
    await mountRuntimeFixture(page, external, resolution);
    for (const path of ["/", "/loja-b", "/loja-b/produto/P", "/gestor", "/login"]) {
      await page.goto(`${external}${path}`);
      await expect(page.getByRole("heading", { name: "Esta loja não está disponível neste domínio." })).toBeVisible();
      expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.table))).toEqual([]);
      await expect(page.getByText("private infrastructure details")).toHaveCount(0);
    }
  });
}

test("loading mounts no platform or tenant page", async ({ page }) => {
  await mountRuntimeFixture(page, external, "delay");
  await page.goto(`${external}/loja-b`);
  await expect(page.getByRole("status")).toHaveText("Carregando loja…");
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.table))).toEqual([]);
  await expect(page.getByRole("heading", { name: "Página não encontrada." })).toBeVisible();
});

test("custom institutional pages and auth/account use store A", async ({ page }) => {
  await mountRuntimeFixture(page, external);
  for (const path of ["/produtos", "/categoria/C", "/promocoes", "/marca/M", "/sobre-nos", "/trocas-e-devolucoes", "/auth"]) {
    await page.goto(`${external}${path}`);
    await expect(page.locator("header")).toBeVisible();
    const calls = await page.evaluate(() => (window as any).__calls.filter((c: any) => c.table === "public_store_profiles"));
    expect(calls.some((c: any) => c.filters.some(([k, v]: string[]) => k === "id" && v === STORE_A))).toBe(true);
  }
  await page.goto(`${external}/conta?tab=pedidos`);
  await expect(page).toHaveURL(/\/auth\?redirect=/);
  await page.getByLabel("E-mail", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("fixture-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(`${external}/conta?tab=pedidos`);
  await expect(page.getByRole("heading", { name: "Meus Pedidos", exact: true })).toBeVisible();
});

test("platform route, product, search, legacy redirect, cart and checkout stay slug-based", async ({ page }) => {
  await mountRuntimeFixture(page, platform);
  await page.goto(`${platform}/loja/loja-a?origem=legado`);
  await expect(page).toHaveURL(`${platform}/loja-a?origem=legado`);
  await expect(page.getByRole("heading", { name: "Produto A", exact: true })).toBeVisible();
  await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Produto A", exact: true }) })).toHaveAttribute("href", `/loja-a/produto/${PRODUCT_A}`);
  await page.goto(`${platform}/loja-a/produto/${PRODUCT_A}`);
  await page.getByRole("button", { name: "Adicionar ao Carrinho", exact: true }).click();
  await page.getByRole("button", { name: "Finalizar Compra", exact: true }).click();
  await expect(page).toHaveURL(`${platform}/loja-a/checkout`);
  await expect(page.getByLabel("Nome completo *", { exact: true })).toBeVisible();
  await page.goto(`${platform}/loja-b/checkout`);
  await expect(page.getByRole("heading", { name: "Carrinho vazio" })).toBeVisible();
  await page.goto(`${platform}/buscar?q=produto`);
  await expect(page.getByRole("heading", { name: "Produto A", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.rpc === "resolve_public_store_by_domain"))).toEqual([]);
});

test("custom cart trusts runtime slug, keeps namespace and mobile links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mountRuntimeFixture(page, external);
  await page.goto(`${external}/produto/${PRODUCT_A}`);
  await page.evaluate(() => {
    sessionStorage.setItem("vm_active_store_slug", "loja-b");
    localStorage.setItem("shopdrive-cart-v2:loja-b", JSON.stringify({ version: 2, storeKey: "loja-b", items: [{ id: "OTHER", name: "Produto B", price: 50, quantity: 1 }] }));
  });
  await page.getByRole("button", { name: "Adicionar ao Carrinho", exact: true }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("shopdrive-cart-v2:loja-a") || "null"));
  expect(stored.storeKey).toBe("loja-a");
  expect(stored.items[0].id).toBe(PRODUCT_A);
  await expect(page.getByText("Produto B", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/browser/hostname-runtime/mobile-cart.png" });
  await page.getByRole("button", { name: "Finalizar Compra", exact: true }).click();
  await expect(page).toHaveURL(`${external}/checkout`);
});