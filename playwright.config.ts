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
  {
    name: "angular", port: 4173, command: "node scripts/serve-static.mjs dist/demo/browser 4173",
    match: { testIgnore: ["plain/**", "lit/**"] },
  },
  {
    name: "plain", port: 4307, command: "node scripts/serve-example.mjs plain 4307",
    match: { testMatch: ["plain/**/*.spec.ts", "shared/**/*.spec.ts"] },
  },
  {
    name: "lit", port: 4303, command: "node scripts/serve-example.mjs lit 4303",
    match: { testMatch: ["lit/**/*.spec.ts", "shared/**/*.spec.ts"] },
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
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  projects: RENDERERS.flatMap((renderer) =>
    ENGINES.map((engine) => ({
      name: `${renderer.name}${engine.suffix}`,
      ...renderer.match,
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
    timeout: 15_000,
  })),
});
