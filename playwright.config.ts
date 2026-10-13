import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: { baseURL: "http://localhost:4100", trace: "retain-on-failure" },
  webServer: {
    command: "node --import tsx tests/browser-server.ts",
    url: "http://localhost:4100/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
