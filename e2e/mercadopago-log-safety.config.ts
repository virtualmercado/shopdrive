import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "mercadopago-log-safety.spec.ts",
  outputDir: "/tmp/browser/mercadopago-log-safety/results",
  timeout: 45_000, workers: 1, reporter: "list",
  use: { headless: true, viewport: { width: 1280, height: 1800 } },
});