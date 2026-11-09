import { defineConfig, devices } from "@playwright/test";

// Capturas del manual de usuario (docs/manual/img). Config aparte: el CI corre `playwright test` con la config por
// defecto y no debe correr esto. Uso: `pnpm build && pnpm manual:capturas` contra el Supabase local con el seed.
export default defineConfig({
  testDir: "tests/manual",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", viewport: { width: 1280, height: 800 } },
  projects: [
    // Reutiliza los logins de E2E (guarda tests/e2e/.auth/*.json).
    { name: "setup", testDir: "tests/e2e", testMatch: /auth\.setup\.ts/ },
    {
      name: "capturas",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
