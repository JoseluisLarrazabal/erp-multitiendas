import {
  aBolivianos,
  aMilesimas,
  brutoLinea,
  parsearCantidad,
  parsearMonto,
  type ProductoPos,
} from "./domain";
import { aCentavos } from "./domain";
import { reservaPayloadSchema, type ReservaPayload } from "./schemas-reservas";

export type MedioReserva = "efectivo" | "qr";

export type ReservaActiva = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  productoId: string;
  productoNombre: string;
  ubicacionId: string;
  cantidad: number;
  precioAcordado: number;
  anticipo: number;
  medio: MedioReserva;
  creadaEn: string;
};

// Total de la reserva en centavos: igual que la línea de venta (round(cantidad x precio, 2)).
export const totalReserva = (r: Pick<ReservaActiva, "cantidad" | "precioAcordado">) =>
  brutoLinea(aMilesimas(r.cantidad), aCentavos(r.precioAcordado));

// Lo que falta cobrar al completarla, en centavos.
export const saldoReserva = (r: ReservaActiva) => totalReserva(r) - aCentavos(r.anticipo);

export type FormReserva = {
  clienteId: string | null;
  producto: ProductoPos | null;
  cantidadTexto: string;
  precioTexto: string;
  anticipoTexto: string;
  medio: MedioReserva;
  // Anticipo por QR: el cajero confirma que llegó, igual que en el cobro de una venta.
  qrConfirmado: boolean;
};

// Un producto con serie o un servicio no se reserva (mismas reglas que crear_reserva).
export const sePuedeReservar = (p: ProductoPos) => p.tipo !== "servicio" && !p.controlaSerie;

// Valida el formulario y arma el payload (lo mismo que comprueba el servidor). `id` es la clave de idempotencia.
export function armarReserva(
  f: FormReserva,
  id: string,
  dispositivoId: string,
  cajaId: string | null,
): { ok: true; payload: ReservaPayload } | { ok: false; error: string } {
  if (!cajaId) return { ok: false, error: "Abre la caja para registrar el anticipo." };
  if (!f.clienteId) return { ok: false, error: "Elige el cliente." };
  if (!f.producto) return { ok: false, error: "Elige el producto." };
  if (!sePuedeReservar(f.producto))
    return { ok: false, error: "Ese producto no se puede reservar." };
  const milesimas = parsearCantidad(f.cantidadTexto, f.producto.unidad);
  if (milesimas === null)
    return {
      ok: false,
      error:
        f.producto.unidad === "kg" ? "Cantidad inválida (hasta 3 decimales)." : "Cantidad entera.",
    };
  const precio = parsearMonto(f.precioTexto);
  if (precio === null || precio <= 0) return { ok: false, error: "Precio acordado inválido." };
  const anticipo = parsearMonto(f.anticipoTexto);
  if (anticipo === null || anticipo <= 0) return { ok: false, error: "Anticipo inválido." };
  if (anticipo > brutoLinea(milesimas, precio))
    return { ok: false, error: "El anticipo no puede superar el total." };
  if (f.medio === "qr" && !f.qrConfirmado)
    return { ok: false, error: "Confirma que recibiste el QR." };
  const r = reservaPayloadSchema.safeParse({
    id,
    dispositivo_id: dispositivoId,
    caja_sesion_id: cajaId,
    cliente_id: f.clienteId,
    producto_id: f.producto.id,
    cantidad: milesimas / 1000,
    precio_acordado: aBolivianos(precio),
    anticipo: aBolivianos(anticipo),
    medio: f.medio,
  });
  return r.success ? { ok: true, payload: r.data } : { ok: false, error: "Revisa los datos." };
}

// ERP_OPERACION_REPETIDA: un intento anterior con ese mismo id SÍ se confirmó, con otros datos. No es un fallo: hay que salir del bucle.
export const MENSAJE_RESERVA_REPETIDA =
  "La reserva ya quedó registrada con los datos del primer intento; revísala en la lista. Si hace falta otra, envía de nuevo.";
export const MENSAJE_CANCELACION_REPETIDA =
  "La cancelación ya quedó registrada con el primer intento; revisa la lista de reservas.";
export const MENSAJE_SIN_PERMISO_CANCELAR = "Para cancelar la reserva, pide a un encargado.";

// Mensaje propio si el servidor dice que la operación ya se resolvió; si no, el error tal cual.
export const mensajeSiRepetida = (
  codigo: string | null | undefined,
  propio: string,
  error: string,
) => (codigo === "ERP_OPERACION_REPETIDA" ? propio : error);
