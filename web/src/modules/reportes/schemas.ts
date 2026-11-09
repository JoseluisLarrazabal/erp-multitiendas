import { z } from "zod";
import { leerFiltros } from "@/lib/filtros";
import { limitesDelDia } from "@/lib/format/fecha";
import {
  AGRUPAR,
  AGRUPAR_INSUMOS,
  DIAS_SIN_MOVIMIENTO,
  FILTROS_STOCK,
  IDS_REPORTE,
  MAX_DIAS_RANGO,
  reportesDe,
  type Agrupar,
  type FiltroStock,
  type IdReporte,
} from "./domain";

export type FiltrosReporte = {
  r: IdReporte;
  desde: string;
  hasta: string;
  agrupar: Agrupar;
  dias: number;
  filtro: FiltroStock;
};

const fecha = z.string().refine((t) => limitesDelDia(t) !== null);
const campos = {
  r: z.enum(IDS_REPORTE),
  desde: fecha,
  hasta: fecha,
  agrupar: z.enum([...AGRUPAR, ...AGRUPAR_INSUMOS]),
  dias: z.enum(DIAS_SIN_MOVIMIENTO.map(String) as [string, ...string[]]).transform(Number),
  filtro: z.enum(FILTROS_STOCK),
};

const diasEntre = (desde: string, hasta: string) =>
  (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;

// Parámetros de /panel/reportes. Un campo inválido, un reporte que el negocio no tiene o un rango al revés o de más
// de 366 días toma su valor por defecto (hoy, el primer reporte) y marca `invalido`.
export function leerFiltrosReporte(
  crudo: Parameters<typeof leerFiltros>[2],
  tipo: string,
  hoy: string,
  verCostos: boolean,
): { filtros: FiltrosReporte; invalido: boolean } {
  const lista = reportesDe(tipo, verCostos);
  const defectos: FiltrosReporte = {
    r: lista[0]!.id,
    desde: hoy,
    hasta: hoy,
    agrupar: "dia",
    dias: 30,
    filtro: "todo",
  };
  const { filtros, invalido: esMalo } = leerFiltros(campos, defectos, crudo);
  let invalido = esMalo;
  const def = lista.find((d) => d.id === filtros.r);
  if (!def) {
    invalido = true;
    filtros.r = defectos.r;
  }
  const { agrupar } = lista.find((d) => d.id === filtros.r)!;
  if (agrupar && !agrupar.includes(filtros.agrupar)) {
    // Solo es un error si la URL lo pidió; si no, es el valor por defecto de otro reporte.
    if (crudo.agrupar) invalido = true;
    filtros.agrupar = "dia";
  }
  const dias = diasEntre(filtros.desde, filtros.hasta);
  if (dias < 1 || dias > MAX_DIAS_RANGO) {
    invalido = true;
    filtros.desde = defectos.desde;
    filtros.hasta = defectos.hasta;
  }
  return { filtros, invalido };
}

export function hrefReportes(f: Partial<FiltrosReporte>): string {
  const q = new URLSearchParams(
    Object.entries(f).map(([k, v]) => [k, String(v)] as [string, string]),
  ).toString();
  return `/panel/reportes${q ? `?${q}` : ""}`;
}

// Atajos de rango: hoy, el mes en curso hasta hoy y el mes anterior completo.
export function rangosRapidos(hoy: string) {
  const [anio, mes] = hoy.split("-").map(Number) as [number, number];
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  const ultimoAnterior = new Date(Date.UTC(anio, mes - 1, 0));
  return {
    hoy: { desde: hoy, hasta: hoy },
    mes: { desde: `${anio}-${dosDigitos(mes)}-01`, hasta: hoy },
    anterior: {
      desde: `${ultimoAnterior.getUTCFullYear()}-${dosDigitos(ultimoAnterior.getUTCMonth() + 1)}-01`,
      hasta: ultimoAnterior.toISOString().slice(0, 10),
    },
  };
}

// Respuestas de las RPC de reportes (jsonb): se validan en el borde. Los numeric llegan como number.
const numero = z.number();
const numeroONulo = z.number().nullable();
const textoONulo = z.string().nullable();
const totalesVentas = z.object({
  ventas: numero,
  cantidad: numero,
  kg: numero,
  bruto: numero,
  devuelto: numero,
  neto: numero,
  costo: numeroONulo,
  ganancia: numeroONulo,
  lineas_sin_costo: numero,
});

export const respuestaVentasSchema = z.object({
  filas: z.array(totalesVentas.extend({ clave: textoONulo, etiqueta: z.string() })),
  totales: totalesVentas,
});

export const respuestaStockSchema = z.object({
  filas: z.array(
    z.object({
      codigo: z.string(),
      nombre: z.string(),
      categoria: textoONulo,
      marca: textoONulo,
      unidad: z.enum(["unidad", "kg"]),
      stock: numero,
      stock_minimo: numeroONulo,
      stock_bajo: z.boolean(),
      ultima_salida: textoONulo,
      sin_movimiento: z.boolean(),
      valor: numeroONulo,
    }),
  ),
  totales: z.object({
    productos: numero,
    stock_bajo: numero,
    sin_movimiento: numero,
    valor: numeroONulo,
    productos_sin_costo: numeroONulo,
  }),
});

export const respuestaCajaSchema = z.object({
  filas: z.array(
    z.object({
      sesion_id: z.string(),
      equipo: z.string(),
      prefijo: z.string(),
      cajero: z.string(),
      abierta_en: z.string(),
      cerrada_en: textoONulo,
      monto_inicial: numero,
      ventas_efectivo: numero,
      ventas_qr: numero,
      ingresos: numero,
      egresos: numero,
      devoluciones_efectivo: numero,
      reservas_efectivo: numero,
      cuotas_efectivo: numero,
      reservas_qr: numero,
      cuotas_qr: numero,
      esperado: numero,
      contado: numeroONulo,
      diferencia: numeroONulo,
    }),
  ),
  totales: z.object({
    sesiones: numero,
    monto_inicial: numero,
    ventas_efectivo: numero,
    ventas_qr: numero,
    ingresos: numero,
    egresos: numero,
    devoluciones_efectivo: numero,
    reservas_efectivo: numero,
    cuotas_efectivo: numero,
    reservas_qr: numero,
    cuotas_qr: numero,
    esperado: numero,
    contado: numero,
    diferencia: numero,
    sesiones_abiertas: numero,
  }),
});

export const respuestaInsumosSchema = z.object({
  filas: z.array(
    z.object({
      clave: textoONulo,
      etiqueta: z.string(),
      consumos: numero,
      gasto: numero,
      sin_costo: numero,
      cantidad: numero.optional(),
      unidad: z.enum(["unidad", "kg"]).optional(),
    }),
  ),
  totales: z.object({ consumos: numero, gasto: numero, sin_costo: numero }),
});
