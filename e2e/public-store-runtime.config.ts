import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "public-store-runtime.spec.ts",
  outputDir: "/tmp/browser/hostname-runtime/results",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { headless: true, viewport: { width: 1280, height: 1800 } },
});