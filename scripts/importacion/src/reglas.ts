// Una función pura por regla de docs/migracion-datos.md. Sin E/S: se prueban con fixtures sintéticos.
import type { Celda } from "./leer.ts";

export type Ubicacion = "Tienda" | "Depósito";

export const FILAS_EJEMPLO = [2, 3];
export const esFilaEjemplo = (fila: number): boolean => FILAS_EJEMPLO.includes(fila);

/** Fila con un solo valor suelto (p. ej. un "598" perdido al final). Las vacías ni se leen. */
export const esFilaSuelta = (valores: number): boolean => valores === 1;

export const limpiarTexto = (texto: string): string => texto.trim().replace(/\s+/g, " ");

/** "--" es el relleno de la planilla para "sin dato". */
export const limpiarMarcaModelo = (texto: string): string => {
  const limpio = limpiarTexto(texto);
  return limpio === "--" ? "" : limpio;
};

/** Código interno tal cual, como texto (P-05). Solo `trim`: no se reescribe. */
export const limpiarCodigo = (celda: Celda): string => celda.texto.trim();

export const sinAcentos = (texto: string): string =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Barras ------------------------------------------------------------------------------------------------------------

export type AvisoBarras =
  | "barras_notacion_cientifica"
  | "barras_numerico"
  | "barras_alfanumerico"
  | "barras_no_numerico_descartado"
  | "ean13_digito_invalido";
export type CorreccionBarras = "barras_a_modelo";

export type ResultadoBarras = {
  barras: string | null;
  modelo: string;
  correcciones: CorreccionBarras[];
  avisos: AvisoBarras[];
};

const NOTACION_CIENTIFICA = /^[+-]?\d+([.,]\d+)?e[+-]?\d+$/i;

export function digitoEan13Valido(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  const suma = [...codigo.slice(0, 12)].reduce(
    (acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (suma % 10)) % 10 === Number(codigo[12]);
}

/**
 * Decisión (2026-11-01):
 * - Notación científica, o un número de celda con 12 o más dígitos (Sheets y Excel lo muestran así): se rechaza el
 *   código, no el producto. Un código dañado es peor que ninguno; se reescanea.
 * - Una celda numérica corta se conserva como texto, con aviso: los ceros iniciales pudieron perderse antes.
 * - Alfanumérico de una sola palabra, con al menos un dígito ("ab12cd"): puede ser un código 128 o una serie mal puesta.
 *   Se conserva como código, con aviso: descartarlo perdería el dato, y conservarlo no cuesta nada.
 * - Texto con espacios o símbolos ("aro 20/29"): va a `modelo` si está vacío; si no, se descarta con aviso.
 * - Solo dígitos: se conserva tal cual (ceros incluidos). EAN-13 con dígito verificador inválido: aviso y se conserva,
 *   porque el texto viene exacto. Código corto (25, 35): se conserva, no es EAN.
 */
export function normalizarBarras(celda: Celda, modelo: string): ResultadoBarras {
  const texto = celda.texto.trim();
  const resultado: ResultadoBarras = { barras: null, modelo, correcciones: [], avisos: [] };
  if (texto === "") return resultado;

  if (celda.esNumero) {
    if (/^\d{1,11}$/.test(texto))
      return { ...resultado, barras: texto, avisos: ["barras_numerico"] };
    return { ...resultado, avisos: ["barras_notacion_cientifica"] };
  }
  if (NOTACION_CIENTIFICA.test(texto))
    return { ...resultado, avisos: ["barras_notacion_cientifica"] };
  if (/^(?=.*\d)[A-Za-z0-9-]+$/.test(texto) && !/^\d+$/.test(texto)) {
    return { ...resultado, barras: texto, avisos: ["barras_alfanumerico"] };
  }
  if (!/^\d+$/.test(texto)) {
    if (modelo === "")
      return { ...resultado, modelo: limpiarTexto(texto), correcciones: ["barras_a_modelo"] };
    return { ...resultado, avisos: ["barras_no_numerico_descartado"] };
  }
  const avisos: AvisoBarras[] =
    texto.length === 13 && !digitoEan13Valido(texto) ? ["ean13_digito_invalido"] : [];
  return { ...resultado, barras: texto, avisos };
}

// Ubicación ---------------------------------------------------------------------------------------------------------

export type AvisoUbicacion = "sin_ubicacion" | "ubicacion_desconocida";

/** Sin ubicación, o con una que no se reconoce: "Tienda" con aviso. */
export function normalizarUbicacion(texto: string): {
  ubicacion: Ubicacion;
  aviso?: AvisoUbicacion;
} {
  const clave = sinAcentos(limpiarTexto(texto));
  if (clave === "tienda") return { ubicacion: "Tienda" };
  if (clave === "deposito") return { ubicacion: "Depósito" };
  return { ubicacion: "Tienda", aviso: clave === "" ? "sin_ubicacion" : "ubicacion_desconocida" };
}

// Stock -------------------------------------------------------------------------------------------------------------

export type ResultadoStock =
  { ok: true; valor: number } | { ok: false; motivo: "stock_invalido" | "stock_decimal" };

/** Número >= 0; vacío es 0; un decimal solo vale en un producto que no se cuenta por unidad. */
export function parsearStock(texto: string, unidad: "unidad" | "kg" = "unidad"): ResultadoStock {
  const limpio = texto.trim();
  if (limpio === "") return { ok: true, valor: 0 };
  if (!/^\d+([.,]\d+)?$/.test(limpio)) return { ok: false, motivo: "stock_invalido" };
  const valor = Number(limpio.replace(",", "."));
  if (unidad === "unidad" && !Number.isInteger(valor))
    return { ok: false, motivo: "stock_decimal" };
  return { ok: true, valor };
}

// Duplicados y categorías -------------------------------------------------------------------------------------------

/** Unión de categorías: por nombre sin distinguir mayúsculas, igual que el índice único de la base. */
export const claveCategoria = (nombre: string): string => limpiarTexto(nombre).toLowerCase();

/** Mismo nombre, marca y modelo, sin mayúsculas ni acentos. No se unen: solo se avisa. */
export const claveDuplicado = (nombre: string, marca: string, modelo: string): string =>
  [nombre, marca, modelo].map((t) => sinAcentos(limpiarTexto(t))).join("|");

function distancia(a: string, b: string): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(
        (previa[j] ?? 0) + 1,
        (actual[j - 1] ?? 0) + 1,
        (previa[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previa = actual;
  }
  return previa[b.length] ?? 0;
}

/** Pares de categorías que parecen la misma: una abre la otra por palabras, o difieren en una letra. Solo aviso. */
export function categoriasParecidas(nombres: string[]): [string, string][] {
  const pares: [string, string][] = [];
  for (let i = 0; i < nombres.length; i++) {
    for (let j = i + 1; j < nombres.length; j++) {
      const a = nombres[i] as string;
      const b = nombres[j] as string;
      const ka = sinAcentos(a);
      const kb = sinAcentos(b);
      const [corta, larga] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
      if (larga.startsWith(`${corta} `) || (corta.length >= 6 && distancia(ka, kb) <= 1))
        pares.push([a, b]);
    }
  }
  return pares;
}
