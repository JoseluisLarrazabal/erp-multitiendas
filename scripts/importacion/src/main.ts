import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  escribir,
  leerEstado,
  type Cliente,
  type EstadoBase,
  type ResultadoEscritura,
} from "./escribir.ts";
import { leerProductos } from "./leer.ts";
import { construirPlan } from "./plan.ts";
import { armarReporte, escribirReporte, resumenConsola, type Reporte } from "./reporte.ts";

export type Opciones = {
  archivo: string;
  negocioId: string;
  /** Sin cliente (corrida seca) no se toca la base. */
  cliente: Cliente | null;
  rutaReporte: string;
};

export async function importar({
  archivo,
  negocioId,
  cliente,
  rutaReporte,
}: Opciones): Promise<Reporte> {
  const plan = construirPlan(await leerProductos(archivo));
  let escritura: ResultadoEscritura | null = null;
  let estado: EstadoBase | null = null;
  if (cliente) {
    escritura = await escribir(cliente, negocioId, plan);
    estado = await leerEstado(cliente, negocioId);
  }
  const reporte = armarReporte(plan, cliente ? "real" : "seco", escritura, estado);
  escribirReporte(rutaReporte, reporte);
  return reporte;
}

const LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const esUrlLocal = (url: string): boolean => LOCALES.has(new URL(url).hostname);

const Entorno = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

async function cli(): Promise<number> {
  const { values } = parseArgs({
    options: {
      archivo: { type: "string" },
      negocio: { type: "string" },
      seco: { type: "boolean", default: false },
      reporte: { type: "string" },
      produccion: { type: "boolean", default: false },
    },
    strict: true,
  });
  const negocio = z.guid().safeParse(values.negocio);
  if (!values.archivo || !negocio.success) {
    console.error(
      "Uso: node src/main.ts --archivo <xlsx> --negocio <uuid> [--seco] [--reporte <ruta>] [--produccion]",
    );
    return 1;
  }
  const rutaReporte =
    values.reporte ?? `reporte-importacion-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  let cliente: Cliente | null = null;
  if (!values.seco) {
    // Los mensajes de error de Zod no incluyen los valores: ni la URL ni la clave llegan a la consola.
    const entorno = Entorno.safeParse(process.env);
    if (!entorno.success) {
      console.error(
        "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno, o no son válidas",
      );
      return 1;
    }
    if (!esUrlLocal(entorno.data.SUPABASE_URL) && !values.produccion) {
      console.error(
        "La URL no es local. Para escribir en un proyecto remoto hace falta --produccion",
      );
      return 1;
    }
    cliente = createClient(entorno.data.SUPABASE_URL, entorno.data.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const reporte = await importar({
    archivo: values.archivo,
    negocioId: negocio.data,
    cliente,
    rutaReporte,
  });
  for (const linea of resumenConsola(reporte)) console.log(linea);
  console.log("Reporte escrito en el archivo indicado");
  return reporte.conciliacion.every((c) => c.ok) ? 0 : 2;
}

if (import.meta.main) {
  cli().then(
    (codigo) => process.exit(codigo),
    (error: unknown) => {
      // Solo el mensaje: un objeto de error de red puede arrastrar cabeceras con la clave.
      console.error(`Error: ${error instanceof Error ? error.message : "desconocido"}`);
      process.exit(1);
    },
  );
}
