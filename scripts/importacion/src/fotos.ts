import ExcelJS from "exceljs";
import { z } from "zod";
import { leerTodo, type Cliente } from "./escribir.ts";
import { HOJA_PRODUCTOS } from "./leer.ts";
import type { Evento, Plan } from "./plan.ts";

const LIMITE_BYTES = 5 * 1024 * 1024; // el del bucket `productos`
const LOTE = 200;
const SIMULTANEAS = 8;

export type Tipo = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Ancla de una imagen en la hoja: fila como en Sheets (la 1 es el encabezado), columna base 0. */
export type Ancla = { fila: number; columna: number; imagen: number };
export type Imagen = { datos: Buffer; tipo: Tipo | null };
export type FotosLeidas = { anclas: Ancla[]; imagenes: Map<number, Imagen> };

export type Asociada = { fila: number; codigo: string; imagen: number; tipo: Tipo };
export type PlanFotos = {
  anclas: number;
  asociadas: Asociada[];
  /** Un ancla sin foto por: fila excluida, rechazada, sin producto, o segunda ancla de la misma fila. */
  avisos: Evento[];
  /** Una foto de un producto aceptado que el bucket no admite: tipo o tamaño. */
  rechazadas: Evento[];
};

/** Tipo por los primeros bytes: el nombre o el MIME que declare el archivo no cuentan. */
export function detectarTipo(b: Buffer): Tipo | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

// Las fotos son dibujos de la hoja, no valores de celda: exceljs resuelve hoja -> drawing -> media por nombre de hoja.
// Carga el libro entero (los 35 MB de la planilla real caben); si crece mucho, pasar a leer el zip por partes.
export async function leerFotos(ruta: string): Promise<FotosLeidas> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const hoja = libro.getWorksheet(HOJA_PRODUCTOS);
  if (!hoja) throw new Error(`No existe la hoja ${HOJA_PRODUCTOS}`);
  const anclas: Ancla[] = [];
  const imagenes = new Map<number, Imagen>();
  for (const img of hoja.getImages()) {
    const id = Number(img.imageId);
    if (!imagenes.has(id)) {
      const datos = libro.getImage(id)?.buffer as unknown as Buffer | undefined; // el tipo de exceljs es un Buffer viejo
      // Sin datos el ancla se cuenta igual: planificarFotos la rechaza como foto_sin_datos.
      if (datos) imagenes.set(id, { datos, tipo: detectarTipo(datos) });
    }
    anclas.push({ fila: Math.floor(img.range.tl.nativeRow) + 1, columna: Math.floor(img.range.tl.nativeCol), imagen: id });
  }
  return { anclas, imagenes };
}

/** Asocia cada ancla con el producto aceptado de su fila. Puro: no toca la base. */
export function planificarFotos(plan: Plan, { anclas, imagenes }: FotosLeidas): PlanFotos {
  const aceptadas = new Map(plan.aceptadas.map((p) => [p.fila, p.codigo]));
  const excluidas = new Set(plan.excluidas.map((e) => e.fila));
  const rechazadas = new Set(plan.rechazadas.map((e) => e.fila));
  const resultado: PlanFotos = { anclas: anclas.length, asociadas: [], avisos: [], rechazadas: [] };

  const porFila = new Map<number, Ancla[]>();
  for (const a of anclas) porFila.set(a.fila, [...(porFila.get(a.fila) ?? []), a]);

  for (const [fila, lista] of [...porFila].sort((x, y) => x[0] - y[0])) {
    const codigo = aceptadas.get(fila);
    if (codigo === undefined) {
      const regla = excluidas.has(fila) ? "foto_fila_excluida" : rechazadas.has(fila) ? "foto_fila_rechazada" : "foto_fila_sin_producto";
      for (let i = 0; i < lista.length; i++) resultado.avisos.push({ fila, regla });
      continue;
    }
    // Más de un ancla: gana la primera VÁLIDA por columna (a igual columna, imagen de menor id); las demás avisan.
    // Si ninguna es válida, se rechaza con el motivo de la primera.
    const ordenadas = [...lista].sort((x, y) => x.columna - y.columna || x.imagen - y.imagen);
    const evaluadas = ordenadas.map((a) => {
      const imagen = imagenes.get(a.imagen);
      const motivo = !imagen
        ? "foto_sin_datos"
        : !imagen.tipo
          ? "foto_tipo_invalido"
          : imagen.datos.length > LIMITE_BYTES
            ? "foto_muy_grande"
            : null;
      return { a, imagen, motivo };
    });
    const ganadora = evaluadas.find((e) => e.motivo === null);
    for (let i = 1; i < ordenadas.length; i++) resultado.avisos.push({ fila, regla: "foto_varias_en_fila" });
    if (ganadora?.imagen?.tipo) resultado.asociadas.push({ fila, codigo, imagen: ganadora.a.imagen, tipo: ganadora.imagen.tipo });
    else resultado.rechazadas.push({ fila, regla: evaluadas[0]!.motivo! });
  }
  return resultado;
}

export type ResultadoFotos = { subidas: number; asignadas: number; yaExistian: number };

const ProductoFoto = z.object({ id: z.guid(), codigo: z.string(), foto_path: z.string().nullable() });
const ResultadoAsignar = z.object({ asignadas: z.number().int(), ya_existian: z.number().int() });

/**
 * Sube cada foto a `<negocio>/<producto>.<ext>` (la ruta del panel, `rutaDeFoto`) y la asigna por RPC.
 * Idempotente: un producto con foto no se toca. Si una corrida se corta tras subir y antes de asignar, la siguiente
 * vuelve a subir encima (upsert) y asigna.
 */
export async function escribirFotos(
  cliente: Cliente,
  negocioId: string,
  fotos: PlanFotos,
  imagenes: Map<number, Imagen>,
): Promise<ResultadoFotos> {
  const productos = new Map(
    (
      await leerTodo(
        (d, h) =>
          cliente.from("productos").select("id, codigo, foto_path").eq("negocio_id", negocioId).order("id").range(d, h),
        ProductoFoto,
      )
    ).map((p) => [p.codigo, p]),
  );
  const resultado: ResultadoFotos = { subidas: 0, asignadas: 0, yaExistian: 0 };
  const pendientes: { producto_id: string; foto_path: string; imagen: Imagen; tipo: Tipo }[] = [];
  for (const a of fotos.asociadas) {
    const producto = productos.get(a.codigo);
    const imagen = imagenes.get(a.imagen);
    if (!producto || !imagen) throw new Error("Producto o imagen sin resolver");
    if (producto.foto_path) resultado.yaExistian++;
    else pendientes.push({ producto_id: producto.id, foto_path: `${negocioId}/${producto.id}.${a.tipo.ext}`, imagen, tipo: a.tipo });
  }

  // Por lote de la RPC: subir y asignar antes de pasar al siguiente. Si uno falla, lo ya asignado queda consistente.
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const lote = pendientes.slice(i, i + LOTE);
    for (let j = 0; j < lote.length; j += SIMULTANEAS) {
      await Promise.all(
        lote.slice(j, j + SIMULTANEAS).map(async (p) => {
          // shortcut: carrera panel-vs-import (se lee foto_path y luego se sube con upsert); se acepta porque la carga
          // inicial corre antes de dar acceso al panel; arreglar si el import se vuelve a correr con usuarios activos.
          const { error } = await cliente.storage
            .from("productos")
            .upload(p.foto_path, p.imagen.datos, { upsert: true, contentType: p.tipo.mime });
          if (error) throw new Error(`No se pudo subir una foto: ${error.message}`);
          resultado.subidas++;
        }),
      );
    }
    const items = lote.map(({ producto_id, foto_path }) => ({ producto_id, foto_path }));
    const { data, error } = await cliente.rpc("asignar_fotos_importacion", { p_negocio_id: negocioId, p_items: items });
    if (error) throw new Error(error.message);
    const r = ResultadoAsignar.parse(data);
    resultado.asignadas += r.asignadas;
    resultado.yaExistian += r.ya_existian;
  }
  return resultado;
}
