// Único parser de montos: "12", "12,5", "12.50" -> entero a escala 10^decimales (decimales=2: centavos). null si no es
// válido: vacío, negativo, más de `decimales`, más de 10 enteros (numeric(12,2)) o, con 3 o más decimales admitidos,
// un punto seguido de exactamente 3 dígitos ("1.500" es ambiguo con miles). La coma siempre es decimal.
export function parsearMonto(texto: string, decimales = 2): number | null {
  const m = new RegExp(`^(\\d{1,10})(?:[.,](\\d{1,${decimales}}))?$`).exec(texto.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  if (decimales >= 3 && frac.length === 3 && /^\d+\.\d{3}$/.test(texto.trim())) return null;
  return Number(m[1]) * 10 ** decimales + Number(frac.padEnd(decimales, "0"));
}

// Recibe el valor numeric(12,2) de Postgres en bolivianos; trabaja en centavos enteros.
export function formatearBs(bolivianos: number): string {
  if (!Number.isFinite(bolivianos)) return "—";
  const centavos = Math.round(bolivianos * 100);
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.trunc(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = String(absoluto % 100).padStart(2, "0");
  return `${centavos < 0 ? "-" : ""}Bs ${enteros},${resto}`;
}
