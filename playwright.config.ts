import { defineConfig, devices } from "@playwright/test";

// Playwright's failure DOM snapshot can include the once-only recovery code.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const baseURL = process.env.PANTRY_E2E_BASE_URL ?? "http://localhost:8787";
const browserName = process.env.PANTRY_E2E_BROWSER ?? "chromium";
if (browserName !== "chromium" && browserName !== "webkit") throw new Error("Choose chromium or webkit for browser regression.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Browser regression fixtures are local-only. Start the local Worker and use its localhost URL.");
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: "./tests/local-fixture.mjs",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["iPhone 13"],
    browserName,
    baseURL,
    // Runners with a system-provided Chromium (a sandbox that forbids `playwright install`)
    // can point at it instead of downloading; unset means Playwright's own browser.
    ...(process.env.PANTRY_E2E_CHROMIUM ? { launchOptions: { executablePath: process.env.PANTRY_E2E_CHROMIUM } } : {}),
    serviceWorkers: "allow",
    // Auth and guest recovery credentials can appear in DOM/request payloads.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
