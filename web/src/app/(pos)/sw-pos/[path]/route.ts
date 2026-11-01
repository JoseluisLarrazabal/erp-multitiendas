import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

// Se sirve en /sw-pos/sw.js (fuera de /pos para que el matcher de auth lo excluya) con scope "/pos".
// Precache: estáticos de .next/static + el HTML de /pos. Este route handler corre en paralelo al
// prerender, así que pos.html aún no existe en disco: "/pos" se agrega a mano con una revisión por
// build, que garantiza HTML nuevo aun si los chunks no cambian.
// shortcut: el glob precachea también chunks del panel; mejorar cuando el panel supere lo razonable
// para datos móviles.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/sw.ts",
    useNativeEsbuild: true,
    globPatterns: [".next/static/**/*.{js,css,woff2}"],
    additionalPrecacheEntries: [{ url: "/pos", revision: randomUUID() }],
  },
);
