import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /contador\.spec\.ts/],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    // La cuenta contador se banea un rato en auth.spec: sus pruebas esperan a que termine todo chromium.
    {
      name: "chromium-contador",
      testMatch: /contador\.spec\.ts/,
      dependencies: ["chromium"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Producción: lo que se prueba es lo que se despliega. Requiere `pnpm build` antes.
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
