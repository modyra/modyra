import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4324",
    browserName: "chromium",
  },
  webServer: {
    command: "node server.mjs",
    url: "http://127.0.0.1:4324",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
