import { defineConfig } from "@playwright/test";

/**
 * Browser checks over the packaged demos. Chromium only: a smoke check, not a cross-browser matrix.
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
  { name: "angular", port: 4173, command: "node scripts/serve-static.mjs dist/demo/browser 4173" },
  { name: "plain", port: 4307, command: "node scripts/serve-example.mjs plain 4307" },
  { name: "lit", port: 4303, command: "node scripts/serve-example.mjs lit 4303" },
];

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { browserName: "chromium" },
  projects: [
    {
      name: "angular",
      testIgnore: ["plain/**", "lit/**"],
      use: { baseURL: "http://localhost:4173" },
    },
    {
      name: "plain",
      testMatch: ["plain/**/*.spec.ts", "shared/**/*.spec.ts"],
      use: { baseURL: "http://localhost:4307" },
    },
    {
      name: "lit",
      testMatch: ["lit/**/*.spec.ts", "shared/**/*.spec.ts"],
      use: { baseURL: "http://localhost:4303" },
    },
  ],
  webServer: RENDERERS.map(({ command, port }) => ({
    command,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  })),
});
