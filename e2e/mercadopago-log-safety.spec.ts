import { expect, test } from "@playwright/test";
import { mountRuntimeFixture, PRODUCT_A, ORDER_A } from "./public-store-runtime.fixture";

const origin = "http://localhost:8080";
const tokenSentinel = "fixture-sdk-token-sentinel";
const errorSentinel = "fixture-sensitive-error-sentinel";

function cardFixture(source: string) {
  return source
    .replace("pix_enabled:false,credit_card_enabled:false,boleto_enabled:false", "pix_enabled:true,pix_provider:'mercado_pago',credit_card_enabled:true,credit_card_provider:'mercado_pago',mercadopago_enabled:true,mercadopago_accepts_pix:true,mercadopago_accepts_credit:true,mercadopago_public_key:'fixture-public-key',boleto_enabled:true")
    .replace("window.__createdOrder=args;", "window.__orderCalls=(window.__orderCalls||0)+1;window.__createdOrder=args;")
    .replace("functions:{invoke:async()=>{throw new Error('Fixture forbids external functions');}}", `functions:{invoke:async(name,opts)=>{
      if(name!=='process-credit-card')throw new Error('Fixture forbids external functions');
      window.__paymentCalls=(window.__paymentCalls||0)+1;
      window.__transportOk=opts.body.cardToken==='${tokenSentinel}' && !('cardNumber' in opts.body) && !('securityCode' in opts.body) && !('cvv' in opts.body);
      if(window.__cardMode==='backend-error')return {data:null,error:{message:'${errorSentinel} ${tokenSentinel}',token:'${tokenSentinel}'}};
      if(window.__cardMode==='rejected')return {data:{status:'rejected',success:false,error:'${errorSentinel}',token:'${tokenSentinel}'},error:null};
      return {data:{status:'approved',success:true,token:'${tokenSentinel}'},error:null};
    }}`);
}

for (const mode of ["approved", "sdk-error", "backend-error", "rejected"]) {
  test(`controlled card ${mode}: no sensitive logging, no live payment`, async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on("console", msg => consoleMessages.push(msg.text()));
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await mountRuntimeFixture(page, origin, "valid", cardFixture);
    await page.goto(`${origin}/loja-a/produto/${PRODUCT_A}`);
    await page.getByRole("button", { name: "Adicionar ao Carrinho", exact: true }).click();
    await page.getByRole("button", { name: "Finalizar Compra", exact: true }).click();
    await page.evaluate(({ mode, token, sensitive }) => {
      (window as any).__cardMode = mode;
      window.MercadoPago = class {
        constructor(key: string) { (window as any).__sdkInitialized = key === "fixture-public-key"; }
        async createCardToken() {
          if (mode === "sdk-error") throw { message: sensitive, token, cause: [{ description: token }] };
          return { id: token };
        }
      };
    }, { mode, token: tokenSentinel, sensitive: errorSentinel });
    await page.getByLabel("Nome completo *", { exact: true }).fill("Cliente Fictício");
    await page.getByLabel("Telefone/WhatsApp *", { exact: true }).fill("00000000000");
    await expect(page.getByRole("radio", { name: "Pix", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Boleto bancário", exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Cartão de crédito", exact: true }).click();
    // Synthetic invalid card data: the SDK is mocked and all external requests are blocked.
    await page.getByPlaceholder("0000 0000 0000 0000", { exact: true }).fill("4000000000000000");
    await page.getByPlaceholder("MM/AA", { exact: true }).fill("1299");
    await page.getByPlaceholder("123", { exact: true }).fill("000");
    await page.getByPlaceholder("NOME COMO ESTÁ NO CARTÃO", { exact: true }).fill("FICTICIO");
    await page.getByRole("button", { name: "Pagar e finalizar", exact: true }).click();
    if (mode === "approved") {
      await expect(page).toHaveURL(`${origin}/loja-a/pedido-confirmado/${ORDER_A}`);
      expect(await page.evaluate(() => (window as any).__orderCalls)).toBe(1);
    } else {
      const message = mode === "sdk-error" ? "Erro ao processar cartão. Verifique os dados." : mode === "backend-error" ? "Erro ao processar pagamento" : "Pagamento recusado pelo banco emissor";
      await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => (window as any).__orderCalls || 0)).toBe(0);
    }
    expect(await page.evaluate(() => (window as any).__sdkInitialized)).toBe(true);
    expect(await page.evaluate(() => (window as any).__paymentCalls || 0)).toBe(mode === "sdk-error" ? 0 : 1);
    if (mode !== "sdk-error") expect(await page.evaluate(() => (window as any).__transportOk)).toBe(true);
    const localState = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(localState).not.toContain(tokenSentinel);
    expect(await page.locator("body").innerText()).not.toContain(tokenSentinel);
    expect(await page.locator("body").innerText()).not.toContain(errorSentinel);
    expect(consoleMessages.join("\n")).not.toContain(tokenSentinel);
    expect(consoleMessages.join("\n")).not.toContain(errorSentinel);
    expect(pageErrors).toEqual([]);
    // Clear synthetic form values before saving any visual evidence.
    await page.locator("input").evaluateAll(inputs => inputs.forEach(input => { (input as HTMLInputElement).value = ""; }));
    await page.screenshot({ path: `/tmp/browser/mercadopago-log-safety/${mode}.png` });
  });
}