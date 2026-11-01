// "100", "100,50", "" (= 0) -> centavos; null si no es un monto válido.
export function parsearMontoInicial(texto: string): number | null {
  if (texto.trim() === "") return 0;
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(texto.trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0")) : null;
}
