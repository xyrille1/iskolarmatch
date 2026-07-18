import { defineConfig, devices } from "@playwright/test";

// e2e smoke coverage for pages that don't require a live Supabase project --
// this repo's dev/CI environment doesn't always have Docker/a linked project,
// so DB-backed flows (/s/[slug], /saved, /admin) are out of scope here. See
// tests/e2e/smoke.spec.ts for what's actually covered and why.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
