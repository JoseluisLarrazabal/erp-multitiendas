import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
import { escribirFotos, leerFotos, planificarFotos, type ResultadoFotos } from "./fotos.ts";
import { leerProductos } from "./leer.ts";
import { construirPlan } from "./plan.ts";
import {
  armarReporte,
  escribirReporte,
  resumenConsola,
  rutaDentroDeRepo,
  type Reporte,
} from "./reporte.ts";

export type Opciones = {
  archivo: string;
  negocioId: string;
  /** Sin cliente (corrida seca) no se toca la base. */
  cliente: Cliente | null;
  rutaReporte: string;
  /** Filas que debería dar la planilla (aceptadas + rechazadas): si no cuadra, la conciliación da DIF. */
  esperadas?: number;
};

export async function importar({
  archivo,
  negocioId,
  cliente,
  rutaReporte,
  esperadas,
}: Opciones): Promise<Reporte> {
  const plan = construirPlan(await leerProductos(archivo));
  const leidas = await leerFotos(archivo);
  const planFotos = planificarFotos(plan, leidas);
  let escritura: ResultadoEscritura | null = null;
  let escrituraFotos: ResultadoFotos | null = null;
  let estado: EstadoBase | null = null;
  if (cliente) {
    escritura = await escribir(cliente, negocioId, plan);
    escrituraFotos = await escribirFotos(cliente, negocioId, planFotos, leidas.imagenes);
    estado = await leerEstado(
      cliente,
      negocioId,
      plan.aceptadas.map((p) => p.codigo),
      planFotos.asociadas.map((a) => a.codigo),
    );
  }
  const reporte = armarReporte(plan, cliente ? "real" : "seco", escritura, estado, esperadas, {
    plan: planFotos,
    escritura: escrituraFotos,
  });
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
      esperadas: { type: "string" },
      produccion: { type: "boolean", default: false },
    },
    strict: true,
  });
  const negocio = z.guid().safeParse(values.negocio);
  const esperadas =
    values.esperadas === undefined ? undefined : /^\d+$/.test(values.esperadas) ? Number(values.esperadas) : NaN;
  if (!values.archivo || !negocio.success || !values.reporte || Number.isNaN(esperadas)) {
    console.error(
      "Uso: node src/main.ts --archivo <xlsx> --negocio <uuid> --reporte <ruta.json> [--esperadas <n>] [--seco] [--produccion]",
    );
    return 1;
  }
  // Antes de tocar la base: el reporte lista filas del cliente y no puede acabar en un repo.
  if (rutaDentroDeRepo(values.reporte)) {
    console.error("--reporte queda dentro de un repo git. Indica una ruta fuera del repo");
    return 1;
  }

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
    rutaReporte: values.reporte,
    esperadas,
  });
  for (const linea of resumenConsola(reporte)) console.log(linea);
  console.log("Reporte escrito en el archivo indicado");
  return reporte.conciliacion.every((c) => c.ok) ? 0 : 2;
}

// Ejecución directa (`node src/main.ts`), no al importarlo desde las pruebas.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().then(
    (codigo) => process.exit(codigo),
    (error: unknown) => {
      // Solo el mensaje: un objeto de error de red puede arrastrar cabeceras con la clave.
      console.error(`Error: ${error instanceof Error ? error.message : "desconocido"}`);
      process.exit(1);
    },
  );
}
