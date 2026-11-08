export const MEDIOS_PAGO = ["efectivo", "qr", "transferencia"] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];
export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  qr: "QR",
  transferencia: "Transferencia",
};

// "12", "12,5", "12.125" -> entero escalado por 10^decimales (BigInt: cantidad × costo desborda un number). null si no es válido.
export function parsearDecimal(texto: string, decimales: number, enteros: number): bigint | null {
  const m = new RegExp(`^(\\d{1,${enteros}})(?:[.,](\\d{1,${decimales}}))?$`).exec(texto.trim());
  if (!m) return null;
  return BigInt(m[1]! + (m[2] ?? "").padEnd(decimales, "0"));
}

export const parsearCantidadCompra = (texto: string) => parsearDecimal(texto, 3, 9);
export const parsearCostoCompra = (texto: string) => parsearDecimal(texto, 4, 8);

// Total de una línea en centavos: round(cantidad × costo, 2), igual que la RPC (positivos: mitad hacia arriba).
export function lineaCentavos(cantidad: string, costo: string): number | null {
  const c = parsearCantidadCompra(cantidad);
  const k = parsearCostoCompra(costo);
  if (c === null || k === null) return null;
  return Number((c * k + 50_000n) / 100_000n);
}

// null si alguna línea no es válida.
export function totalCentavos(
  items: readonly { cantidad: string; costo: string }[],
): number | null {
  let total = 0;
  for (const i of items) {
    const l = lineaCentavos(i.cantidad, i.costo);
    if (l === null) return null;
    total += l;
  }
  return total;
}

const MENSAJES_COMPRAS: Record<string, string> = {
  ERP_DATOS_INVALIDOS: "Revisa los datos: hay algo incompleto o inválido.",
  ERP_OPERACION_REPETIDA: "La compra ya se registró con otros datos; recarga la página.",
  ERP_SIN_PERMISO: "No tienes permiso para gestionar compras.",
  ERP_PAGO_EXCEDE_DEUDA: "El pago supera lo que se le debe al proveedor.",
};

// Solo los códigos propios de compras; el resto lo traduce usuarios/domain (ERP_INTERNO...). Un fallo de red lo
// muestra useAccion en el cliente: la action corre en el servidor y no distingue red.
export const mensajeDeCompras = (codigo: string | undefined) =>
  codigo ? MENSAJES_COMPRAS[codigo] : undefined;

export const aNumero = (texto: string) => Number(texto.trim().replace(",", "."));
