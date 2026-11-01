import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

// Crea `cantidad` productos (sin precio) por PostgREST con la sesión guardada de la cuenta: llenar una segunda página
// de la grilla por la UI tardaría minutos. Código y nombre: `<prefijo>-<n>`, con n de 3 dígitos (orden estable).
export async function crearProductosEnLote(
  cuenta: keyof typeof CUENTAS,
  negocioId: string,
  prefijo: string,
  cantidad: number,
) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // En CI las variables ya están en el entorno.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !apikey)
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const estado = JSON.parse(readFileSync(rutaAuth(cuenta), "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  // @supabase/ssr guarda la sesión como "base64-<json>", partida en trozos .0, .1...
  const valor = estado.cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
  const { access_token } = JSON.parse(
    Buffer.from(decodeURIComponent(valor).replace(/^base64-/, ""), "base64url").toString(),
  ) as { access_token: string };
  const crear = async (n: number) => {
    const sufijo = String(n).padStart(3, "0");
    const r = await fetch(`${url}/rest/v1/rpc/guardar_producto`, {
      method: "POST",
      headers: {
        apikey,
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_negocio_id: negocioId,
        p_datos: {
          codigo: `${prefijo}-${sufijo}`,
          nombre: `${prefijo} ${sufijo}`,
          tipo: "producto",
        },
      }),
    });
    if (!r.ok) throw new Error(`No se creó el producto ${sufijo}: ${r.status}`);
  };
  for (let n = 1; n <= cantidad; n += 10) {
    await Promise.all(
      Array.from({ length: Math.min(10, cantidad - n + 1) }, (_, i) => crear(n + i)),
    );
  }
}
