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
/** Where the bundled host is served from. Overridden to serve a host built from a mutated copy. */
const HOST_DIR = process.env.MDY_HOST_OUT ?? "battle-tests/.tmp-browser";

export default defineConfig({
  testDir: "./browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  /**
   * Four fifths of whatever machine is running, not a count. Playwright's default is half, which
   * left the suite worker-bound rather than floor-bound: measured here, 5 workers took 405s and 8
   * took 277s for the same 850 tests and the same 20 reds — the set compared name by name, not
   * counted. Above that the return falls off: 7.3 of the 8 were busy.
   *
   * **A ratio and not `8`, because eight was measured on ten cores.** The workflow runs on a hosted
   * runner with a fraction of them, and eight browser processes on two cores is slower than two and
   * exposes the races a contended machine already showed once. The ratio is the thing that was
   * measured; the number it resolves to is the machine's business.
   *
   * A run on a contended machine took 472s and flipped one load-sensitive test; that is the cost of
   * sharing the machine, not of this number, and it is why the two waits that test depends on are
   * generous rather than tight.
   */
  workers: "80%",
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
    // The host directory is written into the command rather than left to the environment: the
    // command is a shell line this config composes, and what the server process inherits is not
    // this process's environment.
    command: `MDY_HOST_OUT=${HOST_DIR} node battle-tests/browser/assert-fresh.mjs `
      + `&& node scripts/serve-static.mjs ${HOST_DIR} 4399`,
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
