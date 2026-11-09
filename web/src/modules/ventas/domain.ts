import { formatearBs } from "@/lib/format/moneda";

// Aritmética de la venta en centavos enteros. Debe coincidir con registrar_venta (20261101190100):
// por línea round(cantidad * precio, 2) - descuento; total = suma de líneas - descuento de la venta.
// Cantidades en milésimas (3 decimales, como numeric(12,3)). Sin float acumulado.

export const LISTAS = ["contado", "mayorista", "minimo", "normal", "express"] as const;
// `credito` no es una lista elegible por línea (LISTAS): toda una venta a crédito va en esa lista (RF-CRE-01).
export type Lista = (typeof LISTAS)[number] | "credito";
export type Unidad = "unidad" | "kg";
export type PreciosCentavos = Record<Lista, number | null>;

export const ETIQUETA_LISTA: Record<Lista, string> = {
  contado: "Contado",
  credito: "Crédito",
  mayorista: "Mayorista",
  minimo: "Mínimo",
  normal: "Normal",
  express: "Exprés",
};

export const aCentavos = (bolivianos: number) => Math.round(bolivianos * 100);
export const aBolivianos = (centavos: number) => centavos / 100;
export const bs = (centavos: number) => formatearBs(centavos / 100);
export const aMilesimas = (cantidad: number) => Math.round(cantidad * 1000);

// round() de Postgres redondea .5 hacia arriba (lejos de cero); todo aquí es positivo.
export const brutoLinea = (cantidadMilesimas: number, precioCentavos: number) =>
  Math.floor((cantidadMilesimas * precioCentavos + 500) / 1000);

export type EntradaLinea = {
  cantidadMilesimas: number;
  precio: number;
  descuento: number;
  pisoUnitario: number;
};

// Piso unitario = least(minimo, lista elegida); sin precio mínimo, la lista misma.
export const pisoUnitario = (minimo: number | null, lista: number) =>
  minimo === null ? lista : Math.min(minimo, lista);

export type Totales = {
  subtotal: number;
  sumaLineas: number;
  total: number;
  base: number;
  descuentoTotal: number;
  pideDescuento: boolean;
  excedeTope: boolean;
};

// topePorcentaje: negocios.tope_descuento (numeric(5,2)). Comparación entera: desc*100 > base*tope.
export function calcularTotales(
  lineas: readonly EntradaLinea[],
  descuentoVenta: number,
  topePorcentaje: number,
): Totales {
  let subtotal = 0;
  let sumaLineas = 0;
  let base = 0;
  let descuentoTotal = descuentoVenta;
  let pideDescuento = descuentoVenta > 0;
  for (const l of lineas) {
    const bruto = brutoLinea(l.cantidadMilesimas, l.precio);
    const piso = brutoLinea(l.cantidadMilesimas, l.pisoUnitario);
    subtotal += bruto;
    sumaLineas += bruto - l.descuento;
    base += Math.max(bruto, piso);
    descuentoTotal += l.descuento + Math.max(piso - bruto, 0);
    if (l.descuento > 0 || l.precio < l.pisoUnitario) pideDescuento = true;
  }
  const topeCentesimas = Math.round(topePorcentaje * 100);
  return {
    subtotal,
    sumaLineas,
    total: sumaLineas - descuentoVenta,
    base,
    descuentoTotal,
    pideDescuento,
    excedeTope: descuentoTotal * 10000 > base * topeCentesimas,
  };
}

export { parsearMonto } from "@/lib/format/moneda";

export const ETIQUETA_MEDIO: Record<"efectivo" | "qr" | "anticipo", string> = {
  efectivo: "Efectivo",
  qr: "QR",
  anticipo: "Anticipo de reserva",
};

// Entera en `unidad`, hasta 3 decimales en `kg`. Devuelve milésimas, o null si es inválida o cero.
export function parsearCantidad(texto: string, unidad: Unidad): number | null {
  const m = /^(\d{1,6})(?:[.,](\d{1,3}))?$/.exec(texto.trim());
  if (!m) return null;
  if (unidad === "unidad" && m[2] !== undefined) return null;
  const milesimas = Number(m[1]) * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
  return milesimas > 0 ? milesimas : null;
}

// Signo aparte: con negativos (stock en RN-04) `-500 % 1000` y `trunc(-0,5)` perderían el "-" o los decimales.
export function formatearCantidad(milesimas: number): string {
  const signo = milesimas < 0 ? "-" : "";
  const abs = Math.abs(milesimas);
  const entera = Math.trunc(abs / 1000);
  const resto = String(abs % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${signo}${resto ? `${entera},${resto}` : entera}`;
}

export const textoMonto = (centavos: number) =>
  `${Math.trunc(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`;

// Pago: QR parcial o total, el resto en efectivo. El vuelto es solo de pantalla.
export type ResultadoCobro =
  { ok: true; efectivo: number; qr: number; vuelto: number } | { ok: false; error: string };

export function calcularCobro(
  total: number,
  qr: number,
  efectivoRecibido: number,
  qrConfirmado: boolean,
): ResultadoCobro {
  if (qr > total) return { ok: false, error: "El QR no puede superar el total." };
  if (qr > 0 && !qrConfirmado) return { ok: false, error: "Confirma que recibiste el QR." };
  const efectivo = total - qr;
  if (efectivoRecibido < efectivo)
    return { ok: false, error: "El efectivo recibido no alcanza para el saldo." };
  return { ok: true, efectivo, qr, vuelto: efectivoRecibido - efectivo };
}

// Numeración: `prefijo-000123`. El contador guarda el último número usado.
export const formatearNumero = (prefijo: string, secuencia: number) =>
  `${prefijo}-${String(secuencia).padStart(6, "0")}`;

// El número de nota admite 6 dígitos (000001-999999). Pasado ese tope el equipo no puede numerar más notas.
export const MAX_SECUENCIA = 999_999;
export const secuenciaAgotada = (secuencia: number) => secuencia > MAX_SECUENCIA;

// Veces que una venta se renumera ante ERP_NUMERO_DUPLICADO antes de rechazarla.
export const MAX_NUMERO_DUPLICADO = 25;

// Siguiente número a probar: sobre el mayor contador visto (memoria, almacenamiento local, intento anterior), porque
// otra pestaña del mismo equipo pudo avanzarlo.
export const siguienteSecuencia = (...vistos: number[]) => Math.max(0, ...vistos) + 1;

// Búsqueda local (RF-VEN-08, RNF-01). Se normaliza una vez al indexar; por tecla solo la consulta.
export type ProductoPos = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  unidad: Unidad;
  tipo: string;
  controlaSerie: boolean;
  garantiaMeses: number | null;
  precios: PreciosCentavos;
  stockPorUbicacion: Record<string, number>;
  stockTotal: number;
};

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export type Indice = {
  productos: readonly ProductoPos[];
  textos: readonly string[];
  exactos: ReadonlyMap<string, number>;
};

export function crearIndice(
  productos: readonly ProductoPos[],
  marcas: ReadonlyMap<string, string>,
): Indice {
  const exactos = new Map<string, number>();
  const textos = productos.map((p, i) => {
    exactos.set(normalizar(p.codigo), i);
    if (p.codigoBarras) exactos.set(normalizar(p.codigoBarras), i);
    return normalizar(`${p.codigo} ${p.codigoBarras ?? ""} ${p.nombre} ${marcas.get(p.id) ?? ""}`);
  });
  return { productos, textos, exactos };
}

export const LIMITE_RESULTADOS = 50;

export function buscar(
  indice: Indice,
  consulta: string,
  limite = LIMITE_RESULTADOS,
): ProductoPos[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const salida: ProductoPos[] = [];
  for (let i = 0; i < indice.textos.length && salida.length < limite; i++) {
    const texto = indice.textos[i]!;
    if (palabras.every((p) => texto.includes(p))) salida.push(indice.productos[i]!);
  }
  return salida;
}

export function porCodigoExacto(indice: Indice, consulta: string): ProductoPos | null {
  const i = indice.exactos.get(normalizar(consulta));
  return i === undefined ? null : (indice.productos[i] ?? null);
}

// Lista con la que se vende por defecto: la tienda y el frial venden a contado; la lavandería, por orden, en normal o
// express (sus servicios no llevan precio de contado).
export const listaBase = (tipoNegocio: string): Lista =>
  tipoNegocio === "lavanderia" ? "normal" : "contado";
// Una línea de lista normal, express o crédito exige ese precio; cualquier otra, el de contado.
export const listaBaseDe = (lista: Lista): Lista =>
  lista === "normal" || lista === "express" || lista === "credito" ? lista : "contado";

export const vendible = (p: ProductoPos, lista: Lista = "contado") => p.precios[lista] !== null;

// Por qué un producto no se puede agregar a la venta (null = sí se puede). Los servicios solo se venden en
// lavandería: fuera de ella el servidor los rechaza con un mensaje genérico, así que ni se ofrecen.
export function motivoNoVendible(
  p: ProductoPos,
  tipoNegocio: string,
  lista: Lista = listaBase(tipoNegocio),
): string | null {
  if (p.tipo === "servicio" && tipoNegocio !== "lavanderia")
    return "Servicio: solo se vende en lavandería";
  // crear_orden rechaza lo que no es servicio.
  if (tipoNegocio === "lavanderia" && p.tipo !== "servicio")
    return "En lavandería solo se venden servicios";
  if (vendible(p, lista)) return null;
  return lista === "contado"
    ? "Sin precio de contado"
    : `Sin precio ${ETIQUETA_LISTA[lista].toLowerCase()}`;
}

// Stock local tras una venta propia: resta por producto en la ubicación del equipo y rehace `stockTotal` (suma de
// todas las ubicaciones). Devuelve los mismos objetos para los productos que no se vendieron.
export function descontarStock(
  productos: readonly ProductoPos[],
  ubicacionId: string,
  vendido: readonly { producto_id: string; cantidad: number }[],
): ProductoPos[] {
  const porProducto = new Map<string, number>();
  for (const v of vendido)
    porProducto.set(v.producto_id, (porProducto.get(v.producto_id) ?? 0) + aMilesimas(v.cantidad));
  return productos.map((p) => {
    const milesimas = porProducto.get(p.id);
    if (milesimas === undefined) return p;
    const stockPorUbicacion = {
      ...p.stockPorUbicacion,
      [ubicacionId]: (aMilesimas(p.stockPorUbicacion[ubicacionId] ?? 0) - milesimas) / 1000,
    };
    const total = Object.values(stockPorUbicacion).reduce((t, n) => t + aMilesimas(n), 0);
    return { ...p, stockPorUbicacion, stockTotal: total / 1000 };
  });
}
