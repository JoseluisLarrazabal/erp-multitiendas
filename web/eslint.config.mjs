import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Límites de módulos (docs/estandares-codigo.md). `no-restricted-imports` no conoce el archivo
// que importa, así que la regla de lib/ va en su propio bloque `files`.
// shortcut: cubre imports con alias, con `modules/` y relativos a un módulo hermano solo en los
// niveles src/modules/*/*.ts y src/modules/*/components/**; no cubre subcarpetas más profundas
// (p. ej. components/a/b/ con ../../../otro) ni ciclos entre módulos. Si aparecen, agregar
// dependency-cruiser.
const soloIndex = {
  // panel.ts y servidor.ts son las únicas segundas entradas permitidas: ver sus cabeceras.
  group: ["@/modules/*/*", "**/modules/*/*", "!@/modules/*/panel", "!@/modules/*/servidor"],
  message: "Un módulo solo se importa por su index.ts (@/modules/<nombre>).",
};
const libNoImportaModulos = {
  group: ["@/modules", "@/modules/**", "**/modules", "**/modules/**"],
  message: "lib/ no importa modules/.",
};

const noSalirDelModulo = (patron) => ({
  group: [patron],
  message: "Un módulo no importa relativo fuera de su carpeta; usar @/modules/<nombre>.",
});

// /pos se precachea y un ID de server action es por build: ningún archivo de /pos importa actions.
// panel.ts reexporta las acciones y servidor.ts trae cookies(): tampoco se importan desde /pos.
const sinActions = ["**/actions", "./actions", "@/modules/*/panel", "@/modules/*/servidor"].map(
  (patron) => ({
    group: [patron],
    message: "/pos no usa server actions (precache).",
  }),
);

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [soloIndex] }] },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [soloIndex, libNoImportaModulos] }] },
  },
  {
    files: ["src/modules/*/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [soloIndex, noSalirDelModulo("../*")] }],
    },
  },
  {
    files: ["src/modules/*/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [soloIndex, noSalirDelModulo("../../*")] }],
    },
  },
  {
    files: ["src/app/(pos)/**/*.{ts,tsx}", "src/sw.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [soloIndex, ...sinActions] }],
    },
  },
  {
    files: ["src/modules/usuarios/use-pos-sesion.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [soloIndex, noSalirDelModulo("../*"), ...sinActions] },
      ],
    },
  },
  {
    files: ["src/modules/usuarios/components/pos-sesion.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [soloIndex, noSalirDelModulo("../../*"), ...sinActions] },
      ],
    },
  },
]);
