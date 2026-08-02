import { defineConfig } from "@playwright/test";

/**
 * Browser checks over the packaged demos. Chromium only: a smoke check, not a cross-browser matrix.
 *
 * Two renderers, two servers, because some questions only a real browser can answer and the answer
 * differs per renderer. `e2e/plain/` runs against the framework-free example
 * (`npm run build:examples`); everything else runs against the Angular demo
 * (`npm run build:demo`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { browserName: "chromium" },
  projects: [
    {
      name: "angular",
      testIgnore: "plain/**",
      use: { baseURL: "http://localhost:4173" },
    },
    {
      name: "plain",
      testMatch: "plain/**/*.spec.ts",
      use: { baseURL: "http://localhost:4307" },
    },
  ],
  webServer: [
    {
      command: "node scripts/serve-static.mjs dist/demo/browser 4173",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: "node scripts/serve-example.mjs plain 4307",
      url: "http://localhost:4307",
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
