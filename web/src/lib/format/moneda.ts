// "12", "12,5", "12.50" -> centavos. null si no es un monto válido (más de 2 decimales, vacío, negativo).
export function parsearMonto(texto: string): number | null {
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(texto.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

// Recibe el valor numeric(12,2) de Postgres en bolivianos; trabaja en centavos enteros.
export function formatearBs(bolivianos: number): string {
  if (!Number.isFinite(bolivianos)) throw new RangeError("bolivianos debe ser un número finito");
  const centavos = Math.round(bolivianos * 100);
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.trunc(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = String(absoluto % 100).padStart(2, "0");
  return `${centavos < 0 ? "-" : ""}Bs ${enteros},${resto}`;
}
