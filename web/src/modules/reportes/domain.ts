// Qué reportes tiene cada tipo de negocio (RF-REP-01 a 03) y la forma de lo que devuelven las RPC de reportes.
export type TipoNegocio = "tienda" | "lavanderia" | "frial";
export type IdReporte = "ventas" | "masvendidos" | "ingresos" | "stock" | "caja" | "insumos";
export type Agrupar = "dia" | "vendedor" | "producto" | "categoria" | "marca" | "insumo";
export type FiltroStock = "todo" | "bajo" | "sin";

export const IDS_REPORTE = [
  "ventas",
  "masvendidos",
  "ingresos",
  "stock",
  "caja",
  "insumos",
] as const;
export const AGRUPAR = ["dia", "vendedor", "producto", "categoria", "marca"] as const;
export const AGRUPAR_INSUMOS = ["dia", "insumo"] as const;
export const FILTROS_STOCK = ["todo", "bajo", "sin"] as const;
export const DIAS_SIN_MOVIMIENTO = [30, 60, 90] as const;
// El rango máximo de la RPC: 366 días con ambos extremos.
export const MAX_DIAS_RANGO = 366;

export type DefReporte = { id: IdReporte; etiqueta: string; agrupar?: readonly Agrupar[] };

const CAJA: DefReporte = { id: "caja", etiqueta: "Caja" };
const STOCK: DefReporte = { id: "stock", etiqueta: "Stock" };

// El reporte de insumos es de costos: sin ver_costos no se ofrece (la RPC lo exige también).
export function reportesDe(tipo: string, verCostos = true): readonly DefReporte[] {
  if (tipo === "lavanderia")
    return [
      { id: "ingresos", etiqueta: "Ingresos", agrupar: ["dia", "producto"] },
      ...(verCostos
        ? [{ id: "insumos", etiqueta: "Insumos", agrupar: AGRUPAR_INSUMOS } as DefReporte]
        : []),
      CAJA,
    ];
  if (tipo === "frial")
    return [{ id: "ventas", etiqueta: "Ventas", agrupar: ["dia", "producto"] }, STOCK, CAJA];
  return [
    { id: "ventas", etiqueta: "Ventas", agrupar: AGRUPAR },
    { id: "masvendidos", etiqueta: "Más vendidos" },
    STOCK,
    CAJA,
  ];
}

const ETIQUETA_AGRUPAR: Record<Agrupar, string> = {
  dia: "Día",
  vendedor: "Vendedor",
  producto: "Producto",
  categoria: "Categoría",
  marca: "Marca",
  insumo: "Insumo",
};

// "producto" se llama Servicio en la lavandería y Corte en el frial.
export function etiquetaAgrupar(a: Agrupar, tipo: string): string {
  if (a === "producto")
    return tipo === "lavanderia" ? "Servicio" : tipo === "frial" ? "Corte" : "Producto";
  return ETIQUETA_AGRUPAR[a];
}

export type FilaVentas = {
  clave: string | null;
  etiqueta: string;
  ventas: number;
  cantidad: number;
  kg: number;
  bruto: number;
  devuelto: number;
  neto: number;
  costo: number | null;
  ganancia: number | null;
  lineas_sin_costo: number;
};
export type TotalesVentas = Omit<FilaVentas, "clave" | "etiqueta">;

export type FilaStockReporte = {
  codigo: string;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  unidad: "unidad" | "kg";
  stock: number;
  stock_minimo: number | null;
  stock_bajo: boolean;
  ultima_salida: string | null;
  sin_movimiento: boolean;
  valor: number | null;
};
export type TotalesStock = {
  productos: number;
  stock_bajo: number;
  sin_movimiento: number;
  valor: number | null;
  productos_sin_costo: number | null;
};

export type FilaCaja = {
  sesion_id: string;
  equipo: string;
  prefijo: string;
  cajero: string;
  abierta_en: string;
  cerrada_en: string | null;
  monto_inicial: number;
  ventas_efectivo: number;
  ventas_qr: number;
  ingresos: number;
  egresos: number;
  devoluciones_efectivo: number;
  esperado: number;
  contado: number | null;
  diferencia: number | null;
};
export type TotalesCaja = {
  sesiones: number;
  monto_inicial: number;
  ventas_efectivo: number;
  ventas_qr: number;
  ingresos: number;
  egresos: number;
  devoluciones_efectivo: number;
  esperado: number;
  contado: number;
  diferencia: number;
  sesiones_abiertas: number;
};

export type FilaInsumos = {
  clave: string | null;
  etiqueta: string;
  consumos: number;
  cantidad: number;
  gasto: number;
  sin_costo: number;
};
export type TotalesInsumos = Omit<FilaInsumos, "clave" | "etiqueta">;

export type DatosReporte =
  | { tipo: "insumos"; filas: FilaInsumos[]; totales: TotalesInsumos }
  | { tipo: "ventas"; filas: FilaVentas[]; totales: TotalesVentas }
  | { tipo: "stock"; filas: FilaStockReporte[]; totales: TotalesStock }
  | { tipo: "caja"; filas: FilaCaja[]; totales: TotalesCaja };
