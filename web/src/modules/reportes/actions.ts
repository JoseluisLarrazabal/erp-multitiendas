"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { etiquetaMovimiento, type Movimiento } from "@/modules/inventario";
import { leerKardex } from "@/modules/inventario/panel";
import {
  falla,
  listarUbicaciones,
  obtenerContexto,
  validar,
  type Resultado,
} from "@/modules/usuarios/panel";
import { tablaKardex, type TablaDatos } from "./tabla";

const MAX_MOVIMIENTOS_EXCEL = 5000;
// kardex_producto devuelve hasta 500 filas por llamada y leerKardex pide una de más.
const FILAS_POR_LLAMADA = 499;

const kardexExcelSchema = z.object({
  productoId: z.guid(),
  ubicacionId: z.union([z.guid(), z.literal("")]),
});

// El kardex completo del producto (mismos filtros de ubicación que la pantalla), paginando con el cursor de la RPC.
export async function kardexExcelAccion(entrada: unknown): Promise<Resultado<TablaDatos>> {
  const datos = validar(kardexExcelSchema, entrada);
  if (!datos) return falla("Revisa los datos: hay algo incompleto o inválido.");
  const contexto = await obtenerContexto();
  if (!contexto?.activo) return falla("No tienes permiso para esta operación.");
  const supabase = await createClient();
  const ubicaciones = await listarUbicaciones(supabase, contexto.activo.negocioId);
  if (!ubicaciones.ok) return ubicaciones;

  const movimientos: Movimiento[] = [];
  let cursor = "";
  do {
    const pagina = await leerKardex(
      supabase,
      datos.productoId,
      { ubicacionId: datos.ubicacionId, desde: cursor },
      FILAS_POR_LLAMADA,
    );
    if (!pagina.ok) return pagina;
    movimientos.push(...pagina.data.filas);
    if (movimientos.length > MAX_MOVIMIENTOS_EXCEL)
      return falla(
        `El kardex tiene más de ${MAX_MOVIMIENTOS_EXCEL.toLocaleString("es-BO")} movimientos: filtra por ubicación.`,
      );
    cursor = pagina.data.siguiente ?? "";
  } while (cursor);

  return {
    ok: true,
    data: tablaKardex(
      movimientos.map((m) => ({
        fecha: m.fecha,
        etiqueta: etiquetaMovimiento(m.tipo),
        ubicacion: ubicaciones.data.find((u) => u.id === m.ubicacionId)?.nombre ?? "—",
        cantidad: m.tipo === "ajuste_costo" ? null : m.cantidad,
        costoUnitario: m.costoUnitario,
        usuario: m.usuario,
        motivo: m.motivo,
        referencia: m.refTipo,
      })),
      contexto.permisos.includes("ver_costos"),
    ),
  };
}
