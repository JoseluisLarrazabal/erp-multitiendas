import { formatearBs } from "@/lib/format/moneda";
import { formatearDia, formatearFechaHora } from "@/lib/format/fecha";
import { formatearCantidad, formatearCostoUnitario } from "@/modules/inventario";
import {
  etiquetaAgrupar,
  type Agrupar,
  type DatosReporte,
  type FilaCaja,
  type FilaInsumos,
  type FilaStockReporte,
  type FilaVentas,
  type FiltroStock,
  type TotalesCaja,
  type TotalesInsumos,
  type TotalesStock,
  type TotalesVentas,
} from "./domain";

// Una tabla de reporte = columnas con tipo + filas de valores crudos. La pantalla y el Excel salen de la misma, así
// que lo que se ve y lo que se baja no pueden diferir.
export type TipoColumna =
  "texto" | "monto" | "costo" | "kg" | "entero" | "cantidad" | "dia" | "fechahora";
export type Columna = { titulo: string; tipo: TipoColumna };
export type Celda = string | number | null;
export type TablaDatos = {
  // Nombre de la hoja de Excel (máx. 31 caracteres).
  hoja: string;
  columnas: Columna[];
  filas: Celda[][];
  totales: Celda[] | null;
  avisos: string[];
};

export const esDia = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const esNumerica = (t: TipoColumna) => t !== "texto" && t !== "dia" && t !== "fechahora";

// 1234.5 -> "1.234,500": los kilos siempre con 3 decimales.
export function formatearKg(n: number): string {
  const [enteros, decimales] = Math.abs(n).toFixed(3).split(".");
  const texto = `${enteros!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimales}`;
  return n < 0 && Math.abs(n) >= 0.0005 ? `-${texto}` : texto;
}

// Un solo signo menos en todo el reporte: el "-" de formatearBs (formatearCantidad usa el tipográfico "−").
const conSignoMenos = (texto: string) => texto.replace("−", "-");

// El costo unitario llega a 4 decimales; por debajo de medio décimo de milésima es cero y no lleva signo.
function formatearCosto(n: number): string {
  if (Math.abs(n) < 0.00005) return formatearCostoUnitario(0);
  return n < 0 ? `-${formatearCostoUnitario(-n)}` : formatearCostoUnitario(n);
}

export function textoCelda(tipo: TipoColumna, v: Celda): string {
  if (v === null || v === "") return "—";
  if (tipo === "texto") return String(v);
  if (tipo === "dia") return esDia(v) ? formatearDia(v) : String(v);
  if (tipo === "fechahora") return formatearFechaHora(String(v));
  const n = Number(v);
  if (tipo === "monto") return formatearBs(n);
  if (tipo === "costo") return formatearCosto(n);
  if (tipo === "kg") return formatearKg(n);
  // Hasta 3 decimales sin ceros de más: sirve a unidades enteras y a kilos en una misma columna.
  return conSignoMenos(formatearCantidad(n, "kg"));
}

type OpcionesVentas = {
  tipo: string;
  agrupar: Agrupar;
  puedeVerCostos: boolean;
  esMasVendidos?: boolean;
};

function tablaVentas(filas: FilaVentas[], t: TotalesVentas, o: OpcionesVentas): TablaDatos {
  const tieneKg = o.tipo !== "tienda";
  const tieneCostos = o.puedeVerCostos && o.tipo !== "lavanderia";
  // Más vendidos siempre agrupa por producto, igual que la lectura.
  const agrupar = o.esMasVendidos ? "producto" : o.agrupar;
  const columnas: Columna[] = [
    { titulo: etiquetaAgrupar(agrupar, o.tipo), tipo: agrupar === "dia" ? "dia" : "texto" },
    { titulo: "Ventas", tipo: "entero" },
    { titulo: "Cantidad", tipo: "cantidad" },
    ...(tieneKg
      ? [{ titulo: o.tipo === "lavanderia" ? "Kilos" : "Kg", tipo: "kg" } as Columna]
      : []),
    { titulo: "Bruto", tipo: "monto" },
    { titulo: "Devuelto", tipo: "monto" },
    { titulo: "Neto", tipo: "monto" },
    ...(tieneCostos
      ? ([
          { titulo: "Costo", tipo: "monto" },
          { titulo: "Ganancia", tipo: "monto" },
        ] as Columna[])
      : []),
  ];
  const fila = (x: Pick<FilaVentas, keyof TotalesVentas>, primera: Celda): Celda[] => [
    primera,
    x.ventas,
    x.cantidad,
    ...(tieneKg ? [x.kg] : []),
    x.bruto,
    x.devuelto,
    x.neto,
    ...(tieneCostos ? [x.costo, x.ganancia] : []),
  ];
  const orden = o.esMasVendidos
    ? [...filas].sort((a, b) => b.cantidad - a.cantidad || b.neto - a.neto)
    : filas;
  return {
    hoja: o.esMasVendidos ? "Mas vendidos" : o.tipo === "lavanderia" ? "Ingresos" : "Ventas",
    columnas,
    filas: orden.map((f) => fila(f, f.etiqueta)),
    totales: fila(t, "Total"),
    avisos:
      tieneCostos && t.lineas_sin_costo > 0
        ? [
            `${t.lineas_sin_costo} ${t.lineas_sin_costo === 1 ? "línea sin costo cargado" : "líneas sin costo cargado"}: la ganancia está incompleta.`,
          ]
        : [],
  };
}

function tablaStock(
  filas: FilaStockReporte[],
  t: TotalesStock,
  o: { filtro: FiltroStock; puedeVerCostos: boolean },
): TablaDatos {
  const vistas = filas.filter((f) =>
    o.filtro === "bajo" ? f.stock_bajo : o.filtro === "sin" ? f.sin_movimiento : true,
  );
  const columnas: Columna[] = [
    { titulo: "Código", tipo: "texto" },
    { titulo: "Producto", tipo: "texto" },
    { titulo: "Categoría", tipo: "texto" },
    { titulo: "Marca", tipo: "texto" },
    { titulo: "Unidad", tipo: "texto" },
    { titulo: "Stock", tipo: "cantidad" },
    { titulo: "Mínimo", tipo: "cantidad" },
    { titulo: "Stock bajo", tipo: "texto" },
    { titulo: "Última salida", tipo: "fechahora" },
    { titulo: "Sin movimiento", tipo: "texto" },
    ...(o.puedeVerCostos ? [{ titulo: "Valor", tipo: "monto" } as Columna] : []),
  ];
  // El valor sale del total de la RPC (el dinero no se suma en JS): solo existe para "todo"; con un filtro, la celda va vacía.
  const valorTotal = o.filtro === "todo" ? t.valor : null;
  const avisos: string[] = [];
  if (o.puedeVerCostos && o.filtro === "todo" && (t.productos_sin_costo ?? 0) > 0)
    avisos.push(
      `${t.productos_sin_costo} ${t.productos_sin_costo === 1 ? "producto" : "productos"} con stock y sin costo cargado: el valor está incompleto.`,
    );
  return {
    hoja: "Stock",
    columnas,
    filas: vistas.map((f) => [
      f.codigo,
      f.nombre,
      f.categoria,
      f.marca,
      f.unidad === "kg" ? "kg" : "unidad",
      f.stock,
      f.stock_minimo,
      f.stock_bajo ? "Sí" : "No",
      f.ultima_salida,
      f.sin_movimiento ? "Sí" : "No",
      ...(o.puedeVerCostos ? [f.valor] : []),
    ]),
    totales: ["Total", ...Array<Celda>(9).fill(null), ...(o.puedeVerCostos ? [valorTotal] : [])],
    avisos,
  };
}

function tablaInsumos(filas: FilaInsumos[], t: TotalesInsumos, agrupar: Agrupar): TablaDatos {
  const porInsumo = agrupar === "insumo";
  const columnas: Columna[] = [
    { titulo: porInsumo ? "Insumo" : "Día", tipo: porInsumo ? "texto" : "dia" },
    { titulo: "Consumos", tipo: "entero" },
    ...(porInsumo
      ? [
          { titulo: "Cantidad", tipo: "cantidad" } as Columna,
          { titulo: "Unidad", tipo: "texto" } as Columna,
        ]
      : []),
    { titulo: "Gasto", tipo: "monto" },
  ];
  return {
    hoja: "Insumos",
    columnas,
    filas: filas.map((f) => [
      f.etiqueta,
      f.consumos,
      ...(porInsumo ? [f.cantidad ?? null, f.unidad === "kg" ? "kg" : "unidad"] : []),
      f.gasto,
    ]),
    totales: ["Total", t.consumos, ...(porInsumo ? [null, null] : []), t.gasto],
    avisos:
      t.sin_costo > 0
        ? [
            `${t.sin_costo} ${t.sin_costo === 1 ? "consumo sin costo cargado" : "consumos sin costo cargado"}: el gasto está incompleto.`,
          ]
        : [],
  };
}

function tablaCaja(filas: FilaCaja[], t: TotalesCaja): TablaDatos {
  const monto = (titulo: string): Columna => ({ titulo, tipo: "monto" });
  return {
    hoja: "Caja",
    columnas: [
      { titulo: "Equipo", tipo: "texto" },
      { titulo: "Cajero", tipo: "texto" },
      { titulo: "Apertura", tipo: "fechahora" },
      { titulo: "Cierre", tipo: "fechahora" },
      monto("Inicial"),
      monto("Efectivo"),
      monto("QR"),
      monto("Ingresos"),
      monto("Egresos"),
      monto("Devol. efectivo"),
      monto("Reservas efectivo"),
      monto("Esperado"),
      monto("Contado"),
      monto("Diferencia"),
    ],
    filas: filas.map((f) => [
      `${f.equipo} (${f.prefijo})`,
      f.cajero,
      f.abierta_en,
      f.cerrada_en,
      f.monto_inicial,
      f.ventas_efectivo,
      f.ventas_qr,
      f.ingresos,
      f.egresos,
      f.devoluciones_efectivo,
      f.reservas_efectivo,
      f.esperado,
      f.contado,
      f.diferencia,
    ]),
    totales: [
      "Total",
      null,
      null,
      null,
      t.monto_inicial,
      t.ventas_efectivo,
      t.ventas_qr,
      t.ingresos,
      t.egresos,
      t.devoluciones_efectivo,
      t.reservas_efectivo,
      t.esperado,
      t.contado,
      t.diferencia,
    ],
    avisos:
      t.sesiones_abiertas > 0
        ? [
            `${t.sesiones_abiertas} ${t.sesiones_abiertas === 1 ? "sesión abierta" : "sesiones abiertas"}: no suma${t.sesiones_abiertas === 1 ? "" : "n"} en esperado, contado ni diferencia de los totales.`,
          ]
        : [],
  };
}

export function armarTabla(
  d: DatosReporte,
  o: {
    tipo: string;
    agrupar: Agrupar;
    filtro: FiltroStock;
    puedeVerCostos: boolean;
    esMasVendidos?: boolean;
  },
): TablaDatos {
  if (d.tipo === "ventas") return tablaVentas(d.filas, d.totales, o);
  if (d.tipo === "insumos") return tablaInsumos(d.filas, d.totales, o.agrupar);
  if (d.tipo === "stock") return tablaStock(d.filas, d.totales, o);
  return tablaCaja(d.filas, d.totales);
}

// Kardex de un producto: las filas ya cargadas en la página. El costo solo con ver_costos, como la pantalla.
export function tablaKardex(
  movimientos: readonly {
    fecha: string;
    etiqueta: string;
    ubicacion: string;
    cantidad: number | null;
    costoUnitario: number | null;
    usuario: string | null;
    motivo: string | null;
    referencia: string | null;
  }[],
  puedeVerCostos: boolean,
): TablaDatos {
  return {
    hoja: "Kardex",
    columnas: [
      { titulo: "Fecha", tipo: "fechahora" },
      { titulo: "Movimiento", tipo: "texto" },
      { titulo: "Ubicación", tipo: "texto" },
      { titulo: "Cantidad", tipo: "cantidad" },
      ...(puedeVerCostos ? [{ titulo: "Costo unitario", tipo: "costo" } as Columna] : []),
      { titulo: "Usuario", tipo: "texto" },
      { titulo: "Motivo", tipo: "texto" },
      { titulo: "Referencia", tipo: "texto" },
    ],
    filas: movimientos.map((m) => [
      m.fecha,
      m.etiqueta,
      m.ubicacion,
      m.cantidad,
      ...(puedeVerCostos ? [m.costoUnitario] : []),
      m.usuario,
      m.motivo,
      m.referencia,
    ]),
    totales: null,
    avisos: [],
  };
}
