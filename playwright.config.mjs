import fs from "node:fs";
import { chromium, defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the end-to-end suite.
 *
 * There is deliberately no `webServer` block here: the app needs a database
 * that only exists after the temporary MongoDB is up, and Playwright starts
 * `webServer` before any setup hook could create it. `scripts/e2e.mjs` boots
 * the whole stack and points this config at it through E2E_BASE_URL.
 */

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";

/**
 * Prefer Playwright's own Chromium (what CI installs). Where that download is
 * not available — a locked-down network, for example — fall back to an already
 * installed Google Chrome so the suite can still run.
 *
 * Override explicitly with E2E_BROWSER_CHANNEL=chromium|chrome|msedge.
 */
function resolveBrowser() {
  const explicit = process.env.E2E_BROWSER_CHANNEL;

  if (explicit) {
    return explicit === "chromium" ? {} : { channel: explicit };
  }

  try {
    if (fs.existsSync(chromium.executablePath())) return {};
  } catch {
    // executablePath() throws when no browser is installed at all.
  }

  console.warn(
    "[playwright] Bundled Chromium is not installed — falling back to the system Chrome channel.\n" +
      "             Run `npx playwright install chromium` (or set E2E_BROWSER_CHANNEL) to change this.\n"
  );

  return { channel: "chrome" };
}

const browser = resolveBrowser();

export default defineConfig({
  testDir: "./e2e",
  outputDir: "e2e-artifacts",

  // The suite shares one seeded database and the app rate-limits by account and
  // IP, so the specs run one at a time rather than racing each other.
  fullyParallel: false,
  workers: 1,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  // A retry makes a single flaky navigation visible instead of fatal.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),

  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]]
    : [["list"]],

  use: {
    baseURL,
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The app is RTL and Persian; the specs assert on Persian labels, so the
    // browser is told the same language a real user would have.
    extraHTTPHeaders: { "accept-language": "fa-IR,fa;q=0.9" },
  },

  projects: [
    {
      name: browser.channel || "chromium",
      use: { ...devices["Desktop Chrome"], ...browser },
    },
  ],
});
