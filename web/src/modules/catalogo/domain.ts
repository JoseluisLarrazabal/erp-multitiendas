import { parsearMonto as parsearMontoBase } from "@/lib/format/moneda";

export type Lista = "contado" | "credito" | "mayorista" | "minimo" | "normal" | "express";
export type Moneda = "BOB" | "USD";

const LISTAS_TIENDA: readonly Lista[] = ["contado", "credito", "mayorista", "minimo"];
const LISTAS_LAVANDERIA: readonly Lista[] = ["normal", "express"];

export const ETIQUETA_LISTA: Record<Lista, string> = {
  contado: "Contado",
  credito: "Crédito",
  mayorista: "Mayorista",
  minimo: "Mínimo",
  normal: "Normal",
  express: "Express",
};

export const listasDelNegocio = (tipoNegocio: string): readonly Lista[] =>
  tipoNegocio === "lavanderia" ? LISTAS_LAVANDERIA : LISTAS_TIENDA;

// La lista que se muestra en la lista de productos y se vende por defecto.
export const listaPrincipal = (tipoNegocio: string): Lista => listasDelNegocio(tipoNegocio)[0]!;

export const ETIQUETA_TIPO_PRODUCTO: Record<string, string> = {
  producto: "Producto",
  servicio: "Servicio",
  insumo: "Insumo",
};

export const tiposDeProducto = (tipoNegocio: string): readonly string[] =>
  tipoNegocio === "lavanderia" ? ["servicio", "insumo"] : ["producto"];

export const ETIQUETA_UNIDAD: Record<string, string> = { unidad: "Unidad", kg: "Kilogramo" };

export const PAGINA_PRODUCTOS = 25;
export const PAGINA_PRECIOS = 50;
// El enlace "Siguiente" del paginador: la grilla le pasa el foco tras guardar.
export const ID_PAGINA_SIGUIENTE = "pagina-siguiente";

export const MOTIVO_COSTOS = "Carga de costos";
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FOTO_TIPOS: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Valida tipo y tamaño antes de subir; Storage también lo impone, pero así el aviso es inmediato y en español.
export function errorDeFoto(archivo: { type: string; size: number }): string | null {
  if (!(archivo.type in FOTO_TIPOS)) return "La foto debe ser JPG, PNG o WebP.";
  if (archivo.size > FOTO_MAX_BYTES) return "La foto pesa más de 5 MB.";
  return null;
}

// <negocio_id>/<producto_id>.<ext>: el formato que exige la regex de guardar_producto.
export const rutaDeFoto = (negocioId: string, productoId: string, tipoMime: string) =>
  `${negocioId}/${productoId}.${FOTO_TIPOS[tipoMime]}`;

const MENSAJES_CATALOGO: Record<string, string> = {
  ERP_CATEGORIA_DUPLICADA: "Ya hay una categoría con ese nombre.",
  ERP_CODIGO_DUPLICADO: "Ya hay un producto con ese código.",
  ERP_CODIGO_BARRAS_DUPLICADO: "Ya hay un producto con ese código de barras.",
  ERP_LOTE_GRANDE: "Son demasiados cambios a la vez. Guarda en lotes más chicos.",
  ERP_MONEDA_MIXTA: "Todas las listas de un producto deben estar en la misma moneda.",
  ERP_PRODUCTO_CON_MOVIMIENTOS:
    "Este producto ya tiene movimientos de inventario: no se puede cambiar su tipo ni su unidad, ni quitarle el control de series.",
  ERP_SERIE_CON_STOCK:
    "Este producto tiene stock sin series: no se puede activar el control de series hasta que el stock sea cero.",
};

// Solo los códigos propios del catálogo; el resto lo traduce usuarios/domain (ERP_SIN_PERMISO, ERP_INTERNO...).
// Se separa para que domain.ts no arrastre código de servidor a los componentes de cliente.
export const mensajeDeCatalogo = (codigo: string | undefined) =>
  codigo ? MENSAJES_CATALOGO[codigo] : undefined;

export const MENSAJE_DATOS = "Revisa los datos: hay algo incompleto o inválido.";

export const MENSAJE_MILES = "Escribe el monto con coma, sin puntos de miles. Ej.: 1500,50";

// Texto de un monto -> número en Bs (el parseo es el de lib/format/moneda). Mayor a 0, o desde 0 si `admiteCero`
// (costos). No adivina miles: "1.500" es ambiguo (¿1,5 o 1500?) y se rechaza. null si no vale.
export function parsearMonto(texto: string, decimales = 2, admiteCero = false): number | null {
  const u = parsearMontoBase(texto, decimales);
  if (u === null) return null;
  return u > 0 || admiteCero ? u / 10 ** decimales : null;
}

// Precio -> texto para editar: coma decimal y siempre 2 decimales ("12,50").
export const precioATexto = (n: number | null | undefined): string =>
  n == null ? "" : n.toFixed(2).replace(".", ",");

// Costo -> texto para editar: coma decimal, hasta 4 decimales y sin ceros de más (12.5 -> "12,5").
export const costoATexto = (n: number | null | undefined): string =>
  n == null ? "" : String(Number(n.toFixed(4))).replace(".", ",");

// Peso del paquete (hasta 3 decimales) -> texto con coma y sin ceros de más (0.5 -> "0,5").
export const pesoATexto = (n: number): string => String(Number(n.toFixed(3))).replace(".", ",");

// Cualquier fila de la grilla compara por número, no por texto: "12,50" y "12,5" son lo mismo. Si alguno no
// parsea ("abc", o "0" frente a una celda vacía) se compara el texto, para que no se pierda como "sin cambio".
export const mismoMonto = (a: string, b: string): boolean => {
  const x = parsearMonto(a, 4, true);
  const y = parsearMonto(b, 4, true);
  return x === null || y === null ? a.trim() === b.trim() : x === y;
};

// Costo de un producto a partir del costo promedio de cada ubicación con costo. Distintos = varía: la grilla
// deja la celda vacía y escribir un costo los reemplaza a todos.
export function costoUnico(costos: readonly number[]): { costo: number | null; varia: boolean } {
  const primero = costos[0];
  if (primero === undefined) return { costo: null, varia: false };
  return costos.every((c) => c === primero)
    ? { costo: primero, varia: false }
    : { costo: null, varia: true };
}

// Un tipo de cambio que se aleja más de este margen del vigente pide confirmación: un dedazo cambia todos los Bs.
export const MARGEN_TIPO_CAMBIO = 0.2;
export const cambioBruscoDeTipoCambio = (vigente: number | null, nuevo: number): boolean =>
  vigente !== null && vigente > 0 && Math.abs(nuevo - vigente) / vigente > MARGEN_TIPO_CAMBIO;

const FORMATO_TIPO_CAMBIO = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
export const formatearTipoCambio = (n: number) => FORMATO_TIPO_CAMBIO.format(n);

// El valor va dentro de un filtro .or() de PostgREST: la coma separa condiciones y los paréntesis agrupan; las
// comillas y la barra rompen el valor; `*` y `%` son comodines; `_` es comodín de LIKE. Cada uno se vuelve el
// comodín `*` (así "Cable 2,5mm" y "AB_12" aparecen), se colapsan repetidos y se quitan los de los bordes: la
// consulta ya envuelve el valor en `*…*`, y un valor solo de comodines queda vacío en vez de coincidir con todo.
export function sanearBusqueda(texto: string): string {
  return texto
    .replace(/[,()"\\*%_:]/g, "*")
    .replace(/\s+/g, " ")
    .replace(/ ?\*[ *]*/g, "*")
    .slice(0, 80)
    .replace(/^[\s*]+|[\s*]+$/g, "");
}

export type ProductoLista = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  tipo: string;
  activo: boolean;
  fotoPath: string | null;
  conPrecio: boolean;
  // Lista principal (contado o normal): null si el producto no tiene precio en ella.
  monedaPrincipal: Moneda | null;
  montoPrincipal: number | null;
  principalBs: number | null;
  // Paquete de peso fijo (frial).
  pesoPaqueteKg: number | null;
};

export type ProductoDetalle = {
  id: string;
  codigo: string;
  codigoBarras: string;
  nombre: string;
  marca: string;
  modelo: string;
  categoriaId: string;
  tipo: string;
  unidad: string;
  controlaSerie: boolean;
  garantiaMeses: string;
  stockMinimo: string;
  pesoPaqueteKg: string;
  fotoPath: string | null;
  activo: boolean;
};

export type Categoria = { id: string; nombre: string };

export type TipoCambio = { id: string; valor: number; vigenteDesde: string; usuario: string };

export type FilaPrecios = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  moneda: Moneda | null;
  precios: Partial<Record<Lista, number>>;
  costo: number | null;
  // Las ubicaciones tienen costos promedio distintos: no hay un costo único que mostrar.
  costoVaria: boolean;
};

export type Filtros = {
  q: string;
  categoria: string;
  marca: string;
  sinPrecio: boolean;
  inactivos: boolean;
  pagina: number;
};

export const FILTROS_VACIOS: Filtros = {
  q: "",
  categoria: "",
  marca: "",
  sinPrecio: false,
  inactivos: false,
  pagina: 1,
};

// Querystring de una página con los filtros activos; omite lo que está en su valor por defecto.
export function hrefConFiltros(base: string, f: Filtros, cambios: Partial<Filtros> = {}): string {
  const x = { ...f, ...cambios };
  const p = new URLSearchParams();
  if (x.q) p.set("q", x.q);
  if (x.categoria) p.set("categoria", x.categoria);
  if (x.marca) p.set("marca", x.marca);
  if (x.sinPrecio) p.set("sinPrecio", "1");
  if (x.inactivos) p.set("inactivos", "1");
  if (x.pagina > 1) p.set("pagina", String(x.pagina));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

const FORMATO_FECHA = new Intl.DateTimeFormat("es-BO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/La_Paz",
});

// dd/mm/aaaa hh:mm en hora de Bolivia. Sin dependencia de la zona del servidor.
export function formatearFecha(iso: string): string {
  const partes = Object.fromEntries(
    FORMATO_FECHA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}
