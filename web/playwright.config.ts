import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  // Un reintento en CI deja la traza del intermitente, pero una prueba que pasa solo al reintentar es un fallo.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    // RNF-15 (Chrome y Edge en PC, Chrome en Android, Safari en iOS para el panel): humo de compatibilidad con las
    // pruebas del panel marcadas @cross. Edge es motor Chromium: lo cubre el proyecto chromium. El POS en Android usa el
    // mismo motor que el escritorio y sigue en la comprobación manual en el equipo real. Lo sin conexión queda en Chromium.
    {
      name: "android",
      grep: /@cross/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "ios",
      grep: /@cross/,
      dependencies: ["setup"],
      use: { ...devices["iPhone 14"] },
    },
  ],
  // Producción: lo que se prueba es lo que se despliega. Requiere `pnpm build` antes.
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
