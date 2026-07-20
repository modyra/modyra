import { defineConfig } from "@playwright/test";

/**
 * Browser smoke test over the packaged Angular demo.
 * Build the demo first (`npm run build:demo`), then `npx playwright test`.
 * Chromium only: this is a smoke check, not a cross-browser matrix.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
  },
  webServer: {
    command: "node scripts/serve-static.mjs dist/demo/browser 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
