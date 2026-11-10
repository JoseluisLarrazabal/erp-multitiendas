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

// Marcas de caja_movimientos.motivos_revision (enviados sin conexión), en palabras del encargado.
export const ETIQUETA_REVISION_MOVIMIENTO: Record<string, string> = {
  caja_cerrada: "Enviado después de que se cerró la caja",
  efectivo_insuficiente: "Salida mayor al efectivo esperado",
  usuario_sin_permiso: "Quien la hizo ya no tiene permiso de caja",
  fecha_fuera_de_rango: "Hora de más de 30 días atrás: se guardó con el límite",
};

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  motivo: string;
  creadoEn: string;
};

// Aviso de una caja cerrada a la que llegó algo después del cierre; nombra solo lo que llegó.
export function textoTardias(ventas: number, totalVentas: number, movimientos: number): string {
  const v = `${ventas} ${ventas === 1 ? "venta" : "ventas"} sin conexión por ${formatearBs(totalVentas)}`;
  const m = `${movimientos} ${movimientos === 1 ? "movimiento" : "movimientos"} de caja sin conexión`;
  const que =
    ventas > 0 && movimientos > 0
      ? `${v} y ${movimientos} ${movimientos === 1 ? "movimiento" : "movimientos"} de caja`
      : ventas > 0
        ? v
        : movimientos > 0
          ? m
          : null;
  return que
    ? `Después del cierre llegaron ${que}. El arqueo del cierre no cambia.`
    : "Después del cierre hubo cambios que modificaron el esperado. El arqueo del cierre no cambia.";
}
