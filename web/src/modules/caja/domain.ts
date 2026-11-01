import { formatearBs, parsearMonto } from "@/lib/format/moneda";

// Tope de los schemas de caja (9_999_999 Bs) en centavos.
const MAX_CENTAVOS_CAJA = 999_999_999;

// "100", "100,50", "" (= 0) -> centavos; null si no es un monto válido o pasa el tope de caja.
export function parsearMontoInicial(texto: string): number | null {
  if (texto.trim() === "") return 0;
  const c = parsearMonto(texto);
  return c === null || c > MAX_CENTAVOS_CAJA ? null : c;
}

// "50", "50,5" -> centavos; null si no es un monto válido o es cero (un movimiento exige monto > 0).
export function parsearMontoPositivo(texto: string): number | null {
  const c = texto.trim() === "" ? null : parsearMontoInicial(texto);
  return c === null || c === 0 ? null : c;
}

// Bs (o null) -> texto; "—" si no hay dato.
export const bsONulo = (n: number | null) => (n === null ? "—" : formatearBs(n));

export type TipoMovimiento = "ingreso" | "gasto" | "retiro";
export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  retiro: "Retiro",
};

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  motivo: string;
  creadoEn: string;
};
