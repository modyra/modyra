import { defineConfig } from "@playwright/test";

/**
 * Browser battles, served from a host page built out of published entry points.
 *
 * Separate from the repository's root Playwright config on purpose: that one serves the demos and
 * owns screenshot baselines recorded under a particular load profile. This one answers a different
 * question — what a renderer leaves in a real DOM after a structural change — and must be free to
 * run alone, on one engine, without touching those baselines.
 *
 * Build the host first: `node battle-tests/browser/build.mjs` (or `npm run battle:browser`).
 */
export default defineConfig({
  testDir: "./browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4399",
    trace: "retain-on-failure",
  },
  projects: [{ name: "plain-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node scripts/serve-static.mjs battle-tests/.tmp-browser 4399",
    url: "http://127.0.0.1:4399/index.html",
    cwd: "..",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
