import { defineConfig } from "vitest/config";

// Pruebas por HTTP contra Supabase local con `functions serve`. Solo claves públicas: la URL y la anon.
// En CI las variables ya vienen del entorno; en local salen de .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: valen las del entorno
}

export default defineConfig({
  test: {
    include: ["tests/integracion/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
