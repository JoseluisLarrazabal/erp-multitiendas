export type DiaVentas = { dia: string; monto: number };

// "2026-11-10" menos n días, sin pasar por la zona horaria (son fechas de calendario).
export function restarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

// Los 7 días que terminan en `hoy`, del más antiguo al más reciente. Un día sin ventas no viene del reporte: vale 0.
export function serieSieteDias(
  filas: { clave: string | null; neto: number }[],
  hoy: string,
): DiaVentas[] {
  const porDia = new Map(filas.map((f) => [f.clave, f.neto]));
  return Array.from({ length: 7 }, (_, i) => {
    const dia = restarDias(hoy, 6 - i);
    return { dia, monto: porDia.get(dia) ?? 0 };
  });
}

// Alto de la barra en 0..1 respecto del día más alto; con todo en 0 las barras quedan en el piso.
export function alturaRelativa(monto: number, maximo: number): number {
  return maximo > 0 ? Math.max(0, monto) / maximo : 0;
}
