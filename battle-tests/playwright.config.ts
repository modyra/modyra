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
  /**
   * Eight of this machine's ten cores. Playwright's default is half, which left the suite
   * worker-bound rather than floor-bound: measured, 5 workers took 405s and 8 took 277s for the same
   * 850 tests and the same 20 reds — the set compared name by name, not counted. Above eight the
   * return falls off (7.3 of 8 were busy) and the races a fuller machine exposes are not worth it.
   *
   * A run on a contended machine took 472s and flipped one load-sensitive test; that is the cost of
   * sharing the machine, not of this number, and it is why the two waits that test depends on are
   * generous rather than tight.
   */
  workers: 8,
  /**
   * A ceiling, not a budget. The slowest single test is 33.5s, so this accuses nothing today — it is
   * here for the next one: a spec that waits for something that cannot happen, once per item of a
   * list, is how a four-minute test got written and stayed unnoticed until someone asked why the
   * suite was slow. A test that needs longer says so and says why.
   */
  timeout: 60_000,
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
