// Errores de las RPC (`raise exception 'ERP_*'`) -> mensajes para el cajero. Un código desconocido da un mensaje
// genérico: el texto crudo de Postgres no se muestra (puede traer datos del negocio o del cliente).
type ErrorRpc = { message?: string; code?: string } | null | undefined;

export const MENSAJE_RED = "Sin conexión con el servidor. Revisa la red y vuelve a intentar.";
export const MENSAJE_GENERICO = "No se pudo completar la operación. Intenta de nuevo.";

const MENSAJES: Record<string, string> = {
  ERP_SIN_PERMISO: "No tienes permiso para esta operación. Pídele a un encargado que la haga.",
  ERP_DATOS_INVALIDOS: "Hay datos inválidos. Revisa el carrito, las cantidades y las series.",
  ERP_OPERACION_REPETIDA: "Esta operación ya se registró con otros datos. Reinicia la venta.",
  ERP_CAJA_CERRADA: "La caja de este equipo está cerrada. Ábrela para vender.",
  ERP_CAJA_ABIERTA: "Este equipo ya tiene una caja abierta.",
  ERP_EFECTIVO_INSUFICIENTE: "No hay efectivo suficiente en la caja para esa operación.",
  ERP_PRODUCTO_SIN_PRECIO: "Un producto del carrito ya no tiene precio de contado.",
  ERP_DESCUENTO_TOPE: "El descuento supera el tope permitido.",
  ERP_NUMERO_DUPLICADO: "El número de nota ya existe.",
  ERP_CLIENTE_DUPLICADO: "Ya existe un cliente con ese documento. Búscalo y selecciónalo.",
  ERP_VENTA_ANULADA: "La venta está anulada.",
  ERP_VENTA_CON_DEVOLUCIONES: "La venta tiene devoluciones.",
  ERP_ORDEN_ESTADO: "La orden no puede pasar a ese estado.",
  ERP_ES_ORDEN: "Esa venta es una orden de lavandería: anúlala desde la orden.",
};

export function codigoErp(error: ErrorRpc): string | null {
  return /ERP_[A-Z_]+/.exec(error?.message ?? "")?.[0] ?? null;
}

// Sin código de Postgres el fallo fue de transporte (fetch roto, sin red), no de la base.
export function esFalloDeRed(error: ErrorRpc): boolean {
  return !codigoErp(error) && !error?.code;
}

export function mensajeErp(codigo: string | null): string {
  return (codigo && MENSAJES[codigo]) || MENSAJE_GENERICO;
}

// Error de una RPC/consulta -> resultado fallido con mensaje apto para el cajero (red, código ERP o genérico).
export function errorRpc(error: NonNullable<ErrorRpc>): {
  ok: false;
  error: string;
  codigo: string | null;
  red: boolean;
} {
  const codigo = codigoErp(error);
  const red = esFalloDeRed(error);
  return { ok: false, codigo, red, error: red ? MENSAJE_RED : mensajeErp(codigo) };
}
