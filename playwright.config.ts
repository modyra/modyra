import { defineConfig } from "@playwright/test";

/**
 * Browser checks over the packaged demos, on three engines.
 *
 * Three renderers, three servers. Some questions only a real browser can answer — focus, native key
 * defaults, computed accessible names, layout at 200% text — and the answer can differ per renderer,
 * which is exactly why more than one is served.
 *
 * - `e2e/shared/**` runs against **all three**. Those specs assert on contract classes, which are
 *   the same everywhere by definition, so a difference between projects is a real divergence rather
 *   than a fixture detail. This is where a renderer-agnostic browser question belongs.
 * - `e2e/plain/**` and `e2e/lit/**` are that renderer's own.
 * - everything else at the top level is the Angular demo's, which is the richest fixture and the
 *   only one with a full page around the form.
 *
 * Build first: `npm run build:demo` for Angular, `npm run build:examples` for the other two.
 */
const RENDERERS = [
  /**
   * `fullyParallel` is per renderer, not global. The plain and lit files are stacks of independent
   * screenshot-and-assert tests — one theme, one widget each — that parallelise safely and carry
   * most of the suite's wall time. The Angular specs are the heavy ones, and two of them are
   * load-sensitive in a way the suite documents but has not isolated (see the fixme in
   * e2e/demo.spec.ts); running their file-mates concurrently is exactly the load that tips them.
   */
  {
    name: "angular", port: 4173, command: "node scripts/serve-static.mjs dist/demo/browser 4173",
    match: { testIgnore: ["plain/**", "lit/**"] }, fullyParallel: false,
  },
  {
    name: "plain", port: 4307, command: "node scripts/serve-example.mjs plain 4307",
    match: { testMatch: ["plain/**/*.spec.ts", "shared/**/*.spec.ts", "record-table/**/*.spec.ts", "conditional/**/*.spec.ts"] },
    // Not parallel: the plain demo's full-page height oscillates by 1px between consecutive
    // captures under CPU contention (actual 4502, previous 4501, contents byte-identical), so the
    // screenshot stabilisation loop never converges. Measured on the runner, 2026-08-13. Until the
    // fractional-height source is found, this project keeps the load profile its baselines were
    // recorded under.
    fullyParallel: false,
  },
  {
    name: "lit", port: 4303, command: "node scripts/serve-example.mjs lit 4303",
    match: { testMatch: ["lit/**/*.spec.ts", "shared/**/*.spec.ts", "record-table/**/*.spec.ts", "conditional/**/*.spec.ts"] },
    fullyParallel: true,
  },
] as const;

/**
 * The engines, and the naming rule.
 *
 * Chromium keeps the bare renderer name — `plain`, `lit`, `angular` — so every existing invocation
 * and every recorded result still means what it did. The other two suffix the engine, which is what
 * a failure has to say to be actionable: a contract that only holds on Blink is a finding about the
 * contract, and it is unreadable if the report cannot name the engine that disagreed.
 */
const ENGINES = [
  { browserName: "chromium", suffix: "" },
  { browserName: "firefox", suffix: "-firefox" },
  { browserName: "webkit", suffix: "-webkit" },
] as const;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: process.env.CI ? "100%" : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  /**
   * What a screenshot is allowed to differ by, and what it is not allowed to depend on.
   *
   * `animations: "disabled"` is not a nicety. A transform sampled mid-flight measures the animation
   * rather than the layout, which was demonstrated here before any baseline existed: three icons
   * compared unequal between engines and became equal the moment animation was stopped.
   *
   * The tolerance is deliberately small. A threshold generous enough to absorb flake is generous
   * enough to absorb a regression, so the answer to a flapping baseline is to find the input that
   * moves — a font still loading, an unpinned clock — never to widen this.
   */
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0,
    },
  },
  /** Fixed, because a screenshot of a responsive layout is a screenshot of a viewport. */
  use: { viewport: { width: 1280, height: 900 } },
  projects: RENDERERS.flatMap((renderer) =>
    ENGINES.map((engine) => ({
      name: `${renderer.name}${engine.suffix}`,
      ...renderer.match,
      fullyParallel: renderer.fullyParallel,
      use: {
        baseURL: `http://localhost:${renderer.port}`,
        browserName: engine.browserName,
      },
    })),
  ),
  webServer: RENDERERS.map(({ command, port }) => ({
    command,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // How long a server may take to answer before Playwright gives up on the whole run.
    //
    // 15s is generous on a warm machine with the examples already built, and not on a cold runner
    // starting three servers at once — where exceeding it aborts every project, which reads as the
    // suite failing rather than as a server being slow. The limit exists to catch a server that will
    // never come up, and two minutes still catches that.
    timeout: process.env.CI ? 120_000 : 15_000,
  })),
});
