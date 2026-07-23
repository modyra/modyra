import { defineConfig } from "@playwright/test";

/**
 * P4 gate (.modyra/modyra-studio-caveman-plan.md section 14): keyboard-only
 * structure building + a11y. Separate config from the root's Angular-demo
 * one (different webServer/port) — build first (`npm run build`), then
 * `npx playwright test -c apps/studio/playwright.config.ts`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4322",
    browserName: "chromium",
  },
  webServer: {
    command: "node server.mjs",
    url: "http://127.0.0.1:4322",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
