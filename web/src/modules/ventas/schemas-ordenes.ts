import { z } from "zod";
import { leerFiltros } from "@/lib/filtros";

export const PAGINA_ORDENES = 25;
// RN-09: ropa `lista` sin recoger tras 30 días.
export const DIAS_SIN_RECOGER = 30;

export const ESTADOS_ORDEN = ["recibida", "en_lavado", "lista", "entregada", "cancelada"] as const;
export const ACTIVAS = ["recibida", "en_lavado", "lista"] as const;
export const ETIQUETA_ESTADO_ORDEN: Record<string, string> = {
  recibida: "Recibida",
  en_lavado: "En lavado",
  lista: "Lista",
  entregada: "Entregada",
  cancelada: "Cancelada",
};
// Estados desde los que anular_orden actúa.
export const ANULABLES: readonly string[] = ACTIVAS;

export const umbralSinRecoger = (ahora: number) =>
  new Date(ahora - DIAS_SIN_RECOGER * 86_400_000).toISOString();

// Letras, dígitos, espacio, guion y punto: lo demás (`% _ , ( ) " \ *` ...) tocaría el LIKE o la sintaxis de `.or()`
// de PostgREST. shortcut: se descartan en vez de escaparse; un nombre con esos signos se busca sin ellos.
export const limpiarBusqueda = (q: string) =>
  q
    .replace(/[^\p{L}\p{N} .-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// Cursor keyset: `<estado_en>_<id>` de la última fila de la página anterior.
const FECHA = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})`;
const CURSOR = new RegExp(
  `^(${FECHA})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
  "i",
);
export const cursorOrden = (estadoEn: string, id: string) => `${estadoEn}_${id}`;
export const partirCursor = (c: string) => {
  const m = CURSOR.exec(c);
  return m ? { estadoEn: m[1]!, id: m[2]! } : null;
};

const camposFiltros = {
  q: z.string().trim().max(40),
  estado: z.enum(["", ...ESTADOS_ORDEN, "sin_recoger"]),
  desde: z.string().regex(CURSOR),
};
export type FiltrosOrdenes = {
  [K in keyof typeof camposFiltros]: z.output<(typeof camposFiltros)[K]>;
};
const FILTROS_VACIOS: FiltrosOrdenes = { q: "", estado: "", desde: "" };
export const leerFiltrosOrdenes = (crudo: Parameters<typeof leerFiltros>[2]) =>
  leerFiltros(camposFiltros, FILTROS_VACIOS, crudo);

export function hrefOrdenes(f: Partial<FiltrosOrdenes>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.estado) p.set("estado", f.estado);
  if (f.desde) p.set("desde", f.desde);
  const s = p.toString();
  return `/panel/ordenes${s ? `?${s}` : ""}`;
}

export const anularOrdenSchema = z.object({
  ordenId: z.guid(),
  motivo: z.string().trim().min(1).max(200),
});
