import { defineConfig } from "vitest/config";

// Contra Supabase local. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY vienen del entorno (nunca por argumento).
export default defineConfig({
  test: {
    include: ["tests/integracion/**/*.test.ts"],
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
