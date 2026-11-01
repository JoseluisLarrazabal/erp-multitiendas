import { formatearBs } from "@/lib/format/moneda";

// "100", "100,50", "" (= 0) -> centavos; null si no es un monto válido.
export function parsearMontoInicial(texto: string): number | null {
  if (texto.trim() === "") return 0;
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(texto.trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0")) : null;
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
