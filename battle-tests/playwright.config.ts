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
    command: "node battle-tests/browser/assert-fresh.mjs && node scripts/serve-static.mjs battle-tests/.tmp-browser 4399",
    url: "http://127.0.0.1:4399/index.html",
    cwd: "..",
    // **Never reused, locally included.** The freshness guard runs as the first half of the command
    // above, so reusing a listening server skips it — and what is listening may be serving another
    // tree's bundle entirely. That is not hypothetical: a server left up by one checkout has already
    // answered a run started from another, and the suite reported on a page nobody in that run built.
    // Restarting costs about a second; not restarting costs a whole run's meaning.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
