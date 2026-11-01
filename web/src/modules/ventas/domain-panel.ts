import { parsearCantidad, type Unidad } from "./domain";

// Lo que solo usa el panel (ventas, detalle, anulación y devolución). Sin server actions.

export const PAGINA_VENTAS = 25;
export const PLAZO_HORAS = 24;

export const ETIQUETA_ESTADO: Record<string, string> = {
  completada: "Completada",
  anulada: "Anulada",
};
export const ETIQUETA_MEDIO: Record<string, string> = { efectivo: "Efectivo", qr: "QR" };
export const ETIQUETA_ORIGEN: Record<string, string> = {
  online: "Con conexión",
  offline: "Sin conexión",
};

// RN-08: pasadas 24 h solo con `devolver_fuera_plazo`. La RPC decide; esto solo avisa antes.
export const fueraDePlazo = (recibidaEn: string, ahora: number) =>
  ahora - new Date(recibidaEn).getTime() > PLAZO_HORAS * 3_600_000;

// Códigos de anular_venta, devolver_venta y fijar_tope_descuento, en palabras del panel y según la acción. Los que no
// estén aquí caen en lib/erp-errores (única fuente de los demás, p. ej. ERP_CLIENTE_DUPLICADO de clientes).
export type AccionVentas = "anular" | "devolver" | "tope";

const COMUNES: Record<string, string> = {
  ERP_SIN_PERMISO:
    "No tienes permiso para esto. Pasadas 24 horas de la venta, anular o devolver exige el permiso de devolución fuera de plazo.",
  ERP_OPERACION_REPETIDA:
    "Esta operación ya se registró con otros datos. Recarga la página y revisa el estado de la venta.",
  ERP_CAJA_CERRADA:
    "La caja está cerrada. Una venta de una caja cerrada solo se devuelve, con la caja abierta de un equipo.",
};

const PROPIOS: Record<AccionVentas, Record<string, string>> = {
  anular: {
    ERP_DATOS_INVALIDOS: "Escribe el motivo de la anulación (hasta 200 caracteres).",
    ERP_EFECTIVO_INSUFICIENTE:
      "La caja de la venta no tiene efectivo suficiente para reponer lo cobrado. Repón efectivo con un ingreso.",
    ERP_VENTA_CON_DEVOLUCIONES:
      "La venta ya tiene devoluciones y no se puede anular. Devuelve lo que falte.",
  },
  devolver: {
    ERP_DATOS_INVALIDOS:
      "Revisa los datos: hay algo incompleto o inválido (motivo, cantidades o caja elegida).",
    ERP_EFECTIVO_INSUFICIENTE:
      "La caja no tiene efectivo suficiente para esta devolución. Repón efectivo con un ingreso o usa otra caja.",
    ERP_VENTA_ANULADA: "La venta está anulada: no admite devolución.",
  },
  tope: {
    ERP_DATOS_INVALIDOS: "El tope debe ser un porcentaje entre 0 y 100 con hasta 2 decimales",
  },
};

export const mensajeDeVentas = (accion: AccionVentas, codigo: string | null | undefined) =>
  codigo ? (PROPIOS[accion][codigo] ?? COMUNES[codigo]) : undefined;

// Texto crudo de una cantidad a devolver -> cantidad (unidades, no milésimas). null si no es válida, es cero o supera
// lo que queda por devolver (milésimas).
export function cantidadADevolver(
  texto: string,
  unidad: Unidad,
  quedaMilesimas: number,
): number | null {
  const m = parsearCantidad(texto, unidad);
  return m === null || m > quedaMilesimas ? null : m / 1000;
}
