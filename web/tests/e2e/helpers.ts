import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

// Cuentas del seed (supabase/seed.sql). Contraseña común de desarrollo local.
export const CLAVE = "Prueba-ERP-2026";
export const CUENTAS = {
  dueno: "dueno@erp.test",
  vendedor: "vendedor.tienda@erp.test",
  encargadoTienda: "encargado.tienda@erp.test",
  encargadoLavanderia: "encargado.lavanderia@erp.test",
  multi: "multi@erp.test",
  // Solo la usa la prueba de cuenta desactivada: nadie más debe depender de ella.
  contador: "contador.tienda@erp.test",
} as const;
export const NEGOCIOS = {
  tienda: { id: "a0000000-0000-0000-0000-000000000001", nombre: "Tienda Demo" },
  lavanderia: { id: "a0000000-0000-0000-0000-000000000002", nombre: "Lavandería Demo" },
} as const;

export const rutaAuth = (cuenta: keyof typeof CUENTAS) => `tests/e2e/.auth/${cuenta}.json`;

export async function iniciarSesionUI(page: Page, correo: string, clave = CLAVE) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

// Recoge violaciones de CSP (aparecen como errores de consola y como evento del documento).
export function vigilarCsp(page: Page): () => void {
  const violaciones: string[] = [];
  page.on("console", (m) => {
    if (/content security policy/i.test(m.text())) violaciones.push(m.text());
  });
  return () => expect(violaciones).toEqual([]);
}

// Desactiva (banea) o reactiva una cuenta. La clave admin la maneja un script fuera de web/;
// aquí no se lee. Siempre restaurar en finally.
export async function fijarBaneo(correo: string, baneada: boolean) {
  execFileSync(
    "bash",
    [
      resolve(process.cwd(), "..", "scripts/e2e/banear-cuenta.sh"),
      correo,
      baneada ? "24h" : "none",
    ],
    { stdio: "inherit" },
  );
}
