export type Unidad = "unidad" | "kg";

export type Ubicacion = { id: string; nombre: string };

// Producto elegido en un formulario de operación.
export type ProductoElegible = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  unidad: Unidad;
  controlaSerie: boolean;
};

export type FilaStock = ProductoElegible & {
  activo: boolean;
  stockMinimo: number | null;
  total: number;
  bajo: boolean;
  // Cantidad por ubicación; una ubicación sin fila cuenta 0.
  porUbicacion: Record<string, number>;
  // Con ver_costos: suma de cantidad × costo promedio de las ubicaciones con stock. null = sin costo conocido.
  valor: number | null;
};

export type Movimiento = {
  id: string;
  revertido: boolean;
  ubicacionId: string;
  tipo: string;
  cantidad: number;
  costoUnitario: number | null;
  refTipo: string | null;
  usuario: string | null;
  motivo: string | null;
  fecha: string;
};

export const PAGINA_STOCK = 25;
export const PAGINA_KARDEX = 25;
export const PAGINA_CONTEO = 25;
export const MAX_ITEMS_CONTEO = 500;
export const MAX_SERIES = 500;

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  inicial: "Stock inicial",
  compra: "Compra",
  entrada: "Entrada",
  venta: "Venta",
  anulacion_venta: "Anulación de venta",
  ajuste: "Ajuste",
  danado: "Dañado",
  merma: "Merma",
  cambio_garantia: "Cambio por garantía",
  devolucion_cliente: "Devolución de cliente",
  devolucion_proveedor: "Devolución a proveedor",
  traslado_salida: "Traslado (sale)",
  traslado_entrada: "Traslado (entra)",
  reserva: "Reserva",
  reserva_liberada: "Reserva liberada",
  consumo: "Consumo",
  ajuste_costo: "Ajuste de costo",
  anulacion_compra: "Anulación de compra",
};

export const etiquetaMovimiento = (tipo: string) => ETIQUETA_MOVIMIENTO[tipo] ?? tipo;

export type TipoSalida =
  "ajuste" | "danado" | "merma" | "cambio_garantia" | "devolucion_proveedor" | "consumo";

export const TIPOS_SALIDA: { valor: TipoSalida; etiqueta: string }[] = [
  { valor: "ajuste", etiqueta: "Ajuste (con signo)" },
  { valor: "danado", etiqueta: "Dañado" },
  { valor: "merma", etiqueta: "Merma" },
  { valor: "consumo", etiqueta: "Consumo de insumo" },
  { valor: "cambio_garantia", etiqueta: "Cambio por garantía" },
  { valor: "devolucion_proveedor", etiqueta: "Devolución a proveedor" },
];

const MENSAJES_INVENTARIO: Record<string, string> = {
  ERP_OPERACION_REPETIDA: "Esa operación ya se registró con otros datos. Recarga la página.",
  ERP_SERIE_DUPLICADA: "Alguna de las series ya está registrada o está repetida en la lista.",
  ERP_SERIES_EXCEDEN_STOCK:
    "Las series disponibles no pueden superar el stock de esa ubicación. Registra la entrada primero o carga menos series.",
  ERP_LOTE_GRANDE: "Son demasiados ítems a la vez. Divide el lote.",
};

// Solo los códigos propios de inventario; el resto lo traduce usuarios/domain (ERP_SIN_PERMISO, ERP_INTERNO...).
export const mensajeDeInventario = (codigo: string | undefined) =>
  codigo ? MENSAJES_INVENTARIO[codigo] : undefined;

export const FALLA_STOCK_ORIGEN =
  "No se pudo leer el stock del origen. Puedes trasladar igual, pero no se avisará si supera el stock.";

export const MENSAJE_DATOS = "Revisa los datos: hay algo incompleto o inválido.";

const conMiles = (enteros: string) => enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// 1234.5 -> "1.234,5". Hasta 3 decimales con kg (sin ceros de más), enteros con unidad. El signo solo si es negativo,
// con el menos tipográfico: "−3".
export function formatearCantidad(n: number, unidad: Unidad = "unidad"): string {
  if (!Number.isFinite(n)) throw new RangeError("cantidad debe ser un número finito");
  const milesimas = Math.round(Math.abs(n) * (unidad === "kg" ? 1000 : 1));
  const entero = Math.trunc(milesimas / (unidad === "kg" ? 1000 : 1));
  const resto =
    unidad === "kg"
      ? String(milesimas % 1000)
          .padStart(3, "0")
          .replace(/0+$/, "")
      : "";
  const texto = conMiles(String(entero)) + (resto ? `,${resto}` : "");
  return n < 0 && milesimas > 0 ? `−${texto}` : texto;
}

// Igual, con "+" delante de lo positivo (cantidad de un movimiento).
export const formatearCantidadConSigno = (n: number, unidad: Unidad = "unidad") =>
  n > 0 ? `+${formatearCantidad(n, unidad)}` : formatearCantidad(n, unidad);

// Costo unitario (hasta 4 decimales) en Bs: "Bs 12,5". El valor de un stock usa formatearBs (2 decimales).
export function formatearCostoUnitario(n: number): string {
  const [e, d = ""] = n.toFixed(4).split(".");
  const dec = d.replace(/0+$/, "").padEnd(2, "0");
  return `Bs ${conMiles(e!)},${dec}`;
}

// Texto -> cantidad. Coma o punto como decimal; entera si `unidad`, hasta 3 decimales si `kg`. No adivina miles:
// "1.500" es ambiguo y se rechaza. `conSigno` admite "-" o "+" delante; `admiteCero` permite 0 (conteo).
export function parsearCantidad(
  texto: string,
  unidad: Unidad,
  opciones: { conSigno?: boolean; admiteCero?: boolean } = {},
): number | null {
  const t = texto.trim().replace(/^−/, "-");
  const cuerpo = opciones.conSigno ? t.replace(/^[+-]/, "") : t;
  const patron = unidad === "kg" ? /^\d{1,9}([.,]\d{1,3})?$/ : /^\d{1,9}$/;
  if (!patron.test(cuerpo) || /^\d+\.\d{3}$/.test(cuerpo)) return null;
  const n = Number(cuerpo.replace(",", "."));
  if (n === 0 && !opciones.admiteCero) return null;
  return t.startsWith("-") ? -n : n;
}

const PARTES_FECHA = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// ISO -> "dd/mm/aaaa hh:mm" en hora de Bolivia.
export function formatearFechaHora(iso: string): string {
  const p = Object.fromEntries(
    PARTES_FECHA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// Valor de un stock: solo cuenta lo que hay (una cantidad negativa no resta valor) y las ubicaciones con costo.
export function valorDeStock(
  filas: readonly { cantidad: number; costo: number | null }[],
): number | null {
  const conCosto = filas.filter((f) => f.cantidad > 0 && f.costo !== null);
  if (conCosto.length === 0) return null;
  return conCosto.reduce((s, f) => s + f.cantidad * f.costo!, 0);
}

export const diferenciaDeConteo = (sistema: number, contada: number) =>
  Math.round((contada - sistema) * 1000) / 1000;

export type Hrefs = { q?: string; bajo?: boolean; pagina?: number };

// Query string de /panel/inventario sin parámetros vacíos.
export function hrefStock({ q, bajo, pagina }: Hrefs): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (bajo) p.set("bajo", "1");
  if (pagina && pagina > 1) p.set("pagina", String(pagina));
  const s = p.toString();
  return `/panel/inventario${s ? `?${s}` : ""}`;
}

export const ayudaCantidad = (unidad: Unidad | undefined) =>
  unidad === "kg" ? "Con coma, hasta 3 decimales. Ej.: 2,5." : "Número entero.";

export const mensajeCantidad = (unidad: Unidad | undefined, conSigno = false) =>
  `Escribe una cantidad ${conSigno ? "distinta de 0" : "mayor a 0"}${unidad === "kg" ? ", con hasta 3 decimales. Ej.: 2,5." : ", entera."}`;

export const ayudaSalida = (conSigno: boolean, unidad: Unidad | undefined) =>
  `${conSigno ? "Con signo: −2 resta, +2 suma." : "Lo que sale; se descuenta del stock."} ${
    unidad === "kg" ? "Hasta 3 decimales, con coma." : "Entera."
  }`;

export const textoAviso = (
  origen: string,
  enOrigen: number,
  cantidad: number,
  unidad: Unidad | undefined,
) =>
  `${origen} tiene ${formatearCantidad(enOrigen, unidad)} y vas a trasladar ${formatearCantidad(cantidad, unidad)}. Se permite: el stock de ${origen} quedará en ${formatearCantidad(enOrigen - cantidad, unidad)}.`;

export function textoDias(dias: number): string {
  if (dias < 0) return `Vencido hace ${-dias}\u00a0${dias === -1 ? "día" : "días"}`;
  if (dias === 0) return "Vence hoy";
  return `En ${dias}\u00a0${dias === 1 ? "día" : "días"}`;
}
