import { defineConfig, devices } from "@playwright/test";

// Explicit local/staging server supplied by the operator; no dotenv or automatic app start.
const baseURL = process.env.EVAL_BASE_URL ?? "http://127.0.0.1:3001";
const origin = new URL(baseURL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) || origin.protocol !== "http:") throw new Error("Browser evaluations require a local isolated server");

export default defineConfig({
  testDir: "./browser",
  outputDir: "../output/playwright/evaluation-results",
  reporter: [["list"]],
  timeout: 120000,
  retries: 0,
  workers: 1,
  forbidOnly: true,
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "firefox", use: { ...devices["Desktop Firefox"] } }],
});
