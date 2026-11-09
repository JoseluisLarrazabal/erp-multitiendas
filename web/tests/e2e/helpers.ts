import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

// Cuentas del seed (supabase/seed.sql). Contraseña común de desarrollo local.
export const CLAVE = "Prueba-ERP-2026";
export const CUENTAS = {
  dueno: "dueno@erp.test",
  vendedor: "vendedor.tienda@erp.test",
  encargadoTienda: "encargado.tienda@erp.test",
  encargadoLavanderia: "encargado.lavanderia@erp.test",
  multi: "multi@erp.test",
  contador: "contador.tienda@erp.test",
} as const;
// La cuenta que auth.spec desactiva un rato. Ninguna otra prueba la usa ni guarda su sesión: así el baneo no
// interfiere con nada y no hace falta serializar proyectos.
export const CUENTA_DESACTIVABLE = "baneable@erp.test";
export const NEGOCIOS = {
  tienda: { id: "a0000000-0000-0000-0000-000000000001", nombre: "Tienda Demo" },
  lavanderia: { id: "a0000000-0000-0000-0000-000000000002", nombre: "Lavandería Demo" },
  frial: { id: "a0000000-0000-0000-0000-000000000003", nombre: "Frial Demo" },
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

// Corre un script de scripts/e2e/ (fuera de web/ a propósito). La raíz del repo sale de la ubicación de este archivo,
// no de process.cwd(), que cambia según desde dónde se lance Playwright.
function correrScript(nombre: string, ...args: string[]) {
  execFileSync("bash", [resolve(__dirname, "../../../scripts/e2e", nombre), ...args], {
    stdio: "inherit",
  });
}

// Desactiva (banea) o reactiva una cuenta. La clave admin la maneja un script fuera de web/;
// aquí no se lee. Siempre restaurar en finally.
export async function fijarBaneo(correo: string, baneada: boolean) {
  correrScript("banear-cuenta.sh", correo, baneada ? "24h" : "none");
}

// Retrocede `estado_en` de una orden de lavandería (RF-LAV-07). Solo el Supabase local; ver scripts/e2e/envejecer-orden.sh.
export function envejecerOrden(ordenId: string, dias: number) {
  correrScript("envejecer-orden.sh", ordenId, String(dias));
}

// Llamada a PostgREST con la sesión guardada de la cuenta (sin login nuevo). Devuelve el estado y el JSON.
export async function apiComo(
  cuenta: keyof typeof CUENTAS,
  ruta: string,
  opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {},
): Promise<{ status: number; json: unknown }> {
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
  const r = await fetch(`${url}/rest/v1/${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: {
      apikey,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

// Crea `cantidad` productos (sin precio) por PostgREST con la sesión guardada de la cuenta: llenar una segunda página
// de la grilla por la UI tardaría minutos. Código y nombre: `<prefijo>-<n>`, con n de 3 dígitos (orden estable).
export async function crearProductosEnLote(
  cuenta: keyof typeof CUENTAS,
  negocioId: string,
  prefijo: string,
  cantidad: number,
) {
  const crear = async (n: number) => {
    const sufijo = String(n).padStart(3, "0");
    const r = await apiComo(cuenta, "rpc/guardar_producto", {
      metodo: "POST",
      cuerpo: {
        p_negocio_id: negocioId,
        p_datos: {
          codigo: `${prefijo}-${sufijo}`,
          nombre: `${prefijo} ${sufijo}`,
          tipo: "producto",
        },
      },
    });
    if (r.status >= 300) throw new Error(`No se creó el producto ${sufijo}: ${r.status}`);
  };
  for (let n = 1; n <= cantidad; n += 10) {
    await Promise.all(
      Array.from({ length: Math.min(10, cantidad - n + 1) }, (_, i) => crear(n + i)),
    );
  }
}

// Espera a que hidrate: con la carga de varios workers, un clic o un archivo antes de la hidratación se
// pierde. React marca con __reactProps$ cada nodo que hidrata, así que se espera a que todos los controles de
// `alcance` (por defecto `main`; un elemento ajeno a React, de una extensión, no cuenta) lo tengan (networkidle no
// lo garantizaba y tapó una falla de hidratación).
export async function esperarHidratacion(page: Page, alcance?: Locator) {
  const raiz = await (alcance ?? page.locator("main").first()).elementHandle();
  await page.waitForFunction((r) => {
    const base = r ?? document;
    const controles = [...base.querySelectorAll("input, select, button, form")];
    if (r) controles.push(r);
    return controles.every((c) => Object.keys(c).some((k) => k.startsWith("__reactProps$")));
  }, raiz);
}

export async function ir(page: Page, url: string) {
  await page.goto(url);
  await esperarHidratacion(page);
}

export type Equipo = { id: string; prefijo: string; ultimo_numero: number };

// Equipo (dispositivo) propio de un spec, para no compartir caja con otros. Si ya existe de una corrida anterior,
// la RPC falla y se ignora.
export async function equipoPropio(
  negocio: string,
  ubicacion: string,
  prefijo: string,
  nombre = `Caja de prueba ${prefijo}`,
): Promise<Equipo> {
  await apiComo("dueno", "rpc/registrar_dispositivo", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: negocio,
      p_ubicacion_id: ubicacion,
      p_nombre: nombre,
      p_prefijo: prefijo,
    },
  });
  const r = await apiComo(
    "dueno",
    `dispositivos?select=id,prefijo,ultimo_numero&negocio_id=eq.${negocio}&prefijo=eq.${prefijo}`,
  );
  const e = (r.json as Equipo[])[0];
  if (!e) throw new Error(`No se pudo crear el equipo ${prefijo}.`);
  return e;
}

export async function cerrarCaja(sesion: string) {
  await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: sesion, p_monto_contado: 0 },
  });
}

// Abre una caja nueva en el equipo (cierra la que hubiera abierta) y devuelve el id de la sesión.
export async function abrirCaja(negocio: string, equipo: Equipo): Promise<string> {
  const abierta = await apiComo("dueno", "rpc/caja_sesion_abierta", {
    metodo: "POST",
    cuerpo: { p_dispositivo_id: equipo.id },
  });
  const previa = (abierta.json as { id: string }[])[0]?.id;
  if (previa) await cerrarCaja(previa);
  const sesion = crypto.randomUUID();
  const r = await apiComo("dueno", "rpc/abrir_caja", {
    metodo: "POST",
    cuerpo: {
      p_id: sesion,
      p_negocio_id: negocio,
      p_dispositivo_id: equipo.id,
      p_monto_inicial: 100,
    },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  return sesion;
}

export const elegirNegocio = (context: BrowserContext, negocio: string) =>
  context.addCookies([{ name: "negocio_activo", value: negocio, domain: "localhost", path: "/" }]);

/** Último dígito del índice del worker (hay menos de 10): separa los datos únicos de workers que cargan a la vez. */
export const worker = (process.env.TEST_PARALLEL_INDEX ?? "0").slice(-1);
