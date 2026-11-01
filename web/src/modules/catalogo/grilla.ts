import {
  costoATexto,
  MENSAJE_MILES,
  mismoMonto,
  parsearMonto,
  precioATexto,
  type FilaPrecios,
  type Lista,
  type Moneda,
} from "./domain";

// Lo que la persona escribió en una fila: texto crudo de cada celda.
export type Borrador = { moneda: Moneda; precios: Record<string, string>; costo: string };

export const borradorBase = (fila: FilaPrecios, listas: readonly Lista[]): Borrador => ({
  moneda: fila.moneda ?? "BOB",
  precios: Object.fromEntries(listas.map((l) => [l, precioATexto(fila.precios[l])])),
  // Con costos distintos por ubicación la celda queda vacía: no hay un valor que mostrar ni que "no cambiar".
  costo: costoATexto(fila.costo),
});

export type Cambios = { precios: boolean; costo: boolean };

const vacio = (t: string) => t.trim() === "";
const igual = (a: string, b: string) =>
  (vacio(a) && vacio(b)) || mismoMonto(a, b) || a.trim() === b.trim();

// Compara contra lo guardado. Cambiar solo la moneda de una fila sin precios no cambia nada.
export function cambiosDeFila(fila: FilaPrecios, b: Borrador, listas: readonly Lista[]): Cambios {
  const base = borradorBase(fila, listas);
  const algunTexto = listas.some((l) => !vacio(b.precios[l] ?? ""));
  const precios =
    listas.some((l) => !igual(b.precios[l] ?? "", base.precios[l] ?? "")) ||
    (b.moneda !== base.moneda && (algunTexto || fila.moneda !== null));
  // Un costo en blanco no se puede "borrar": se ignora, no se envía.
  const costo = !vacio(b.costo) && !igual(b.costo, base.costo);
  return { precios, costo };
}

// Celdas cambiadas cuyo texto no es un monto válido: precios > 0, costo >= 0. Las que no se tocaron no se validan.
export function celdasInvalidas(
  fila: FilaPrecios,
  b: Borrador,
  listas: readonly Lista[],
): string[] {
  const base = borradorBase(fila, listas);
  const cambiada = (nuevo: string, antes: string) => !vacio(nuevo) && !igual(nuevo, antes);
  return [
    ...listas.filter((l) => {
      const t = b.precios[l] ?? "";
      return cambiada(t, base.precios[l] ?? "") && parsearMonto(t) === null;
    }),
    ...(cambiada(b.costo, base.costo) && parsearMonto(b.costo, 4, true) === null ? ["costo"] : []),
  ];
}

// "1.500" se explica aparte: la causa no es el monto sino el punto de miles.
export const mensajeDeMontoInvalido = (texto: string) =>
  /^\d+\.\d{3}$/.test(texto.trim()) ? MENSAJE_MILES : "Monto inválido";

// Resultado por fila de guardarGrilla: qué partes (precios, costo) no se guardaron y por qué.
export type FilaFallida = { productoId: string; error: string; campos: ("precios" | "costo")[] };

// Texto del aviso tras guardar. `conPrecios`: se mandó algún precio (si ninguno falló, quedaron guardados).
export function mensajeDeGuardado(
  guardadas: number,
  fallidas: readonly FilaFallida[],
  conPrecios: boolean,
): string {
  const sinPrecios = fallidas.filter((f) => f.campos.includes("precios")).length;
  const sinCostos = fallidas.filter((f) => f.campos.includes("costo")).length;
  const costos = (n: number) => `${n} ${n === 1 ? "costo no se guardó" : "costos no se guardaron"}`;
  if (fallidas.length === 0)
    return `Se guardaron ${guardadas} ${guardadas === 1 ? "fila" : "filas"}.`;
  if (sinPrecios === 0 && conPrecios)
    return `Precios guardados. ${costos(sinCostos)}: ${sinCostos === 1 ? "está señalada" : "están señaladas"}, con lo que escribiste.`;
  const faltan = [
    sinPrecios > 0 && `${sinPrecios} ${sinPrecios === 1 ? "precio" : "precios"}`,
    sinCostos > 0 && `${sinCostos} ${sinCostos === 1 ? "costo" : "costos"}`,
  ].filter(Boolean);
  return `Se guardaron ${guardadas} ${guardadas === 1 ? "fila" : "filas"}. No se guardaron ${faltan.join(" y ")}: están señaladas, con lo que escribiste.`;
}

// Bs de un precio en USD, para mostrar junto al monto. Aritmética en centavos enteros y tipo de cambio en
// diezmilésimas, como round(monto * tc, 2) de Postgres. El valor definitivo lo calcula la vista producto_precios_bs.
export function bsDeUsd(texto: string, tipoCambio: number | null): number | null {
  const monto = parsearMonto(texto);
  if (monto === null || tipoCambio === null) return null;
  return Math.round((Math.round(monto * 100) * Math.round(tipoCambio * 10000)) / 10000) / 100;
}
