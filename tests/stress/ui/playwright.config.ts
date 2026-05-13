/**
 * tests/stress/ui/playwright.config.ts
 *
 * Anti-flake-first Playwright config for the pipeline stress harness Tier 3a.
 *
 * Encodes every applicable rule from STRESS_HARNESS_DIRECTIVE §ANTI-FLAKE:
 *   - rule 5: single worker, explicit viewport/tz/locale, no retries
 *   - rule 10: zero retry budget in CI
 *   - rule 11: one run per row (default Playwright behavior with retries=0)
 *
 * Dev server: started by the CI workflow before `npm run pipeline:stress:ui`.
 * Locally, the user is expected to run `npm run dev` in another shell.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.STRESS_UI_PORT ?? "3002");
const BASE_URL = process.env.STRESS_UI_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: ["scenarios.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["json", { outputFile: "../../../stress-results/ui/playwright-results.json" }]],
  outputDir: "../../../stress-results/ui",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "UTC",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
