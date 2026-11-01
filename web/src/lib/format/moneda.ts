// Recibe el valor numeric(12,2) de Postgres en bolivianos; trabaja en centavos enteros.
export function formatearBs(bolivianos: number): string {
  if (!Number.isFinite(bolivianos)) throw new RangeError("bolivianos debe ser un número finito");
  const centavos = Math.round(bolivianos * 100);
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.trunc(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = String(absoluto % 100).padStart(2, "0");
  return `${centavos < 0 ? "-" : ""}Bs ${enteros},${resto}`;
}
