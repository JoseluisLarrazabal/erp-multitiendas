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

export type DefReporte = {
  id: IdReporte;
  etiqueta: string;
  agrupar?: readonly Agrupar[];
  // Qué cuenta el reporte y por qué día; se muestra bajo la barra de reportes.
  criterio?: string;
};

const CRITERIO_VENTAS =
  "Cuenta lo vendido, por el día en que la venta llegó al sistema: una venta hecha sin conexión cuenta el día en que se envió. Una venta a crédito entra entera el día de la venta y una reserva, cuando se completa; los anticipos y las cuotas no entran aquí sino en Caja. Las devoluciones restan el día en que se hacen.";

const CAJA: DefReporte = {
  id: "caja",
  etiqueta: "Caja",
  criterio:
    "Cuenta lo cobrado en cada caja, por el día en que se abrió: efectivo y QR de ventas, anticipos de reservas y cuotas de crédito. Una venta sin conexión cuenta en la caja donde se hizo, aunque llegue después. En una caja cerrada, esperado, contado y diferencia son los del cierre; lo que llegó después se ve en el detalle de esa caja.",
};
// Sin créditos, reservas ni cuotas; la orden se cobra al recibirla. reporte_ventas solo cuenta las completadas: una orden
// anulada no entra; las devoluciones restan el día en que se hacen.
const CRITERIO_INGRESOS_LAVANDERIA =
  "Cuenta las órdenes recibidas, por el día en que la orden llegó al sistema: una orden hecha sin conexión cuenta el día en que se envió. La orden se cobra al recibirla. Una orden anulada no cuenta y las devoluciones restan el día en que se hacen.";
const CAJA_LAVANDERIA: DefReporte = {
  ...CAJA,
  criterio:
    "Cuenta lo cobrado en cada caja, por el día en que se abrió: efectivo y QR de las órdenes. Una orden sin conexión cuenta en la caja donde se hizo, aunque llegue después. En una caja cerrada, esperado, contado y diferencia son los del cierre; lo que llegó después se ve en el detalle de esa caja.",
};
const STOCK: DefReporte = { id: "stock", etiqueta: "Stock" };

// El reporte de insumos es de costos: sin ver_costos no se ofrece (la RPC lo exige también).
export function reportesDe(tipo: string, verCostos: boolean): readonly DefReporte[] {
  if (tipo === "lavanderia")
    return [
      {
        id: "ingresos",
        etiqueta: "Ingresos",
        agrupar: ["dia", "producto"],
        criterio: CRITERIO_INGRESOS_LAVANDERIA,
      },
      ...(verCostos
        ? [{ id: "insumos", etiqueta: "Insumos", agrupar: AGRUPAR_INSUMOS } as DefReporte]
        : []),
      CAJA_LAVANDERIA,
    ];
  if (tipo === "frial")
    return [
      {
        id: "ventas",
        etiqueta: "Ventas",
        agrupar: ["dia", "producto"],
        criterio: CRITERIO_VENTAS,
      },
      STOCK,
      CAJA,
    ];
  return [
    { id: "ventas", etiqueta: "Ventas", agrupar: AGRUPAR, criterio: CRITERIO_VENTAS },
    { id: "masvendidos", etiqueta: "Más vendidos", criterio: CRITERIO_VENTAS },
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
  // Anticipos menos devoluciones de reservas, en efectivo.
  reservas_efectivo: number;
  // Cuotas de crédito cobradas por caja, en efectivo.
  cuotas_efectivo: number;
  // QR de reservas (anticipos menos devoluciones) y de cuotas: ventas_qr es solo QR de ventas.
  reservas_qr: number;
  cuotas_qr: number;
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
  // Anticipos menos devoluciones de reservas, en efectivo.
  reservas_efectivo: number;
  // Cuotas de crédito cobradas por caja, en efectivo.
  cuotas_efectivo: number;
  // QR de reservas (anticipos menos devoluciones) y de cuotas: ventas_qr es solo QR de ventas.
  reservas_qr: number;
  cuotas_qr: number;
  esperado: number;
  contado: number;
  diferencia: number;
  sesiones_abiertas: number;
};

// Por día no hay cantidad (insumos de unidades distintas no se suman); por insumo sí, con su unidad.
export type FilaInsumos = {
  clave: string | null;
  etiqueta: string;
  consumos: number;
  gasto: number;
  sin_costo: number;
  cantidad?: number;
  unidad?: "unidad" | "kg";
};
export type TotalesInsumos = { consumos: number; gasto: number; sin_costo: number };

// Enlace entre pestañas de reportes: conserva la agrupación si la pestaña destino no tiene lista (la guarda oculta)
// o la admite; si no, vuelve a "dia".
export const agruparAlCambiar = (def: DefReporte, actual: Agrupar): Agrupar =>
  !def.agrupar || def.agrupar.includes(actual) ? actual : "dia";

export type DatosReporte =
  | { tipo: "insumos"; filas: FilaInsumos[]; totales: TotalesInsumos }
  | { tipo: "ventas"; filas: FilaVentas[]; totales: TotalesVentas }
  | { tipo: "stock"; filas: FilaStockReporte[]; totales: TotalesStock }
  | { tipo: "caja"; filas: FilaCaja[]; totales: TotalesCaja };
