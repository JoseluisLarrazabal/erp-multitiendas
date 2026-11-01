import {
  mismoMonto,
  montoATexto,
  parsearMonto,
  type FilaPrecios,
  type Lista,
  type Moneda,
} from "./domain";

// Lo que la persona escribió en una fila: texto crudo de cada celda.
export type Borrador = { moneda: Moneda; precios: Record<string, string>; costo: string };

export const borradorBase = (fila: FilaPrecios, listas: readonly Lista[]): Borrador => ({
  moneda: fila.moneda ?? "BOB",
  precios: Object.fromEntries(listas.map((l) => [l, montoATexto(fila.precios[l])])),
  costo: montoATexto(fila.costo),
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

// Celdas que no son un monto válido (texto escrito que no parsea).
export const celdasInvalidas = (b: Borrador, listas: readonly Lista[]): string[] => [
  ...listas.filter((l) => !vacio(b.precios[l] ?? "") && parsearMonto(b.precios[l]!) === null),
  ...(!vacio(b.costo) && parsearMonto(b.costo, 4) === null ? ["costo"] : []),
];

// Bs de un precio en USD, para mostrar junto al monto. Aritmética en centavos enteros y tipo de cambio en
// diezmilésimas, como round(monto * tc, 2) de Postgres. El valor definitivo lo calcula la vista producto_precios_bs.
export function bsDeUsd(texto: string, tipoCambio: number | null): number | null {
  const monto = parsearMonto(texto);
  if (monto === null || tipoCambio === null) return null;
  return Math.round((Math.round(monto * 100) * Math.round(tipoCambio * 10000)) / 10000) / 100;
}
