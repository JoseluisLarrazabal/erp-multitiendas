"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { parsearMonto } from "@/lib/format/moneda";
import { createClient } from "@/lib/supabase/server";
import {
  codigoDeMensaje,
  mensajeDeError as mensajeBase,
  validar,
  type Resultado,
} from "@/modules/usuarios/panel";
import { aNumero, mensajeDeCompras, totalCentavos, type UltimoPago } from "./domain";
import {
  anularCompraSchema,
  anularPagoSchema,
  compraSchema,
  pagoSchema,
  pagoVivoSchema,
  proveedorSchema,
  ultimoPagoSchema,
} from "./schemas";

const mensaje = (codigo?: string) => mensajeDeCompras(codigo) ?? mensajeBase(codigo);
const fallo = (codigo?: string): Resultado<never> => ({ ok: false, error: mensaje(codigo) });
const invalido = () => fallo("ERP_DATOS_INVALIDOS");
const listo = (): Resultado<null> => {
  revalidatePath("/panel/proveedores");
  revalidatePath("/panel/compras");
  return { ok: true, data: null };
};

// ERP_OPERACION_REPETIDA en una anulación: ese id ya anuló esto (el id va ligado a recurso y motivo). Queda hecho:
// se cierra el diálogo y la lista se refresca, igual que con ya_anulada / ya_anulado.
const falloAnulacion = (mensajeRpc: string) => {
  const codigo = codigoDeMensaje(mensajeRpc);
  return codigo === "ERP_OPERACION_REPETIDA" ? listo() : fallo(codigo);
};

export async function guardarProveedor(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(proveedorSchema, entrada);
  if (!d) return invalido();
  const { error } = await (
    await createClient()
  ).rpc("guardar_proveedor", {
    p_negocio_id: d.negocioId,
    p_datos: {
      ...(d.id ? { id: d.id } : {}),
      nombre: d.nombre,
      contacto: d.contacto,
      activo: d.activo,
    },
  });
  return error ? fallo(codigoDeMensaje(error.message)) : listo();
}

export async function pagarProveedor(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(pagoSchema, entrada);
  const centavos = d && parsearMonto(d.monto);
  if (!d || !centavos) return invalido();
  const { error } = await (
    await createClient()
  ).rpc("pagar_proveedor", {
    p_pago: {
      id: d.operacionId,
      negocio_id: d.negocioId,
      proveedor_id: d.proveedorId,
      monto: centavos / 100,
      medio: d.medio,
    },
  });
  return error ? fallo(codigoDeMensaje(error.message)) : listo();
}

export async function registrarCompra(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(compraSchema, entrada);
  const total = d && totalCentavos(d.items);
  if (!d || total === null) return invalido();
  const { error } = await (
    await createClient()
  ).rpc("registrar_compra", {
    p_compra: {
      id: d.operacionId,
      negocio_id: d.negocioId,
      proveedor_id: d.proveedorId,
      ubicacion_id: d.ubicacionId,
      condicion: d.condicion,
      ...(d.condicion === "contado" ? { medio: d.medio } : {}),
      total: total / 100,
      items: d.items.map((i) => ({
        producto_id: i.productoId,
        cantidad: aNumero(i.cantidad),
        costo_unitario: aNumero(i.costo),
        ...(i.lote && i.vence ? { lote: i.lote, vence: i.vence } : {}),
      })),
    },
  });
  return error ? fallo(codigoDeMensaje(error.message)) : listo();
}

// Reversos (M-2): la barrera real es la RPC (gestionar_compras y anular); el motivo de 1 a 200 caracteres es obligatorio.
export async function anularCompra(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(anularCompraSchema, entrada);
  if (!d) return invalido();
  const { error } = await (
    await createClient()
  ).rpc("anular_compra", {
    p_operacion_id: d.operacionId,
    p_compra_id: d.compraId,
    p_motivo: d.motivo,
  });
  return error ? falloAnulacion(error.message) : listo();
}

export async function anularPagoProveedor(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(anularPagoSchema, entrada);
  if (!d) return invalido();
  const { error } = await (
    await createClient()
  ).rpc("anular_pago_proveedor", {
    p_operacion_id: d.operacionId,
    p_pago_id: d.pagoId,
    p_motivo: d.motivo,
  });
  return error ? falloAnulacion(error.message) : listo();
}

// El monto del pago no se lee por columna: sale de esta RPC. null = el proveedor no tiene pagos vivos.
export async function ultimoPagoProveedor(entrada: unknown): Promise<Resultado<UltimoPago | null>> {
  const d = validar(ultimoPagoSchema, entrada);
  if (!d) return invalido();
  const { data, error } = await (
    await createClient()
  ).rpc("ultimo_pago_proveedor", { p_proveedor_id: d.proveedorId });
  if (error) return fallo(codigoDeMensaje(error.message));
  const p = pagoVivoSchema.safeParse(data);
  if (!p.success) return fallo("ERP_INTERNO");
  return {
    ok: true,
    data: p.data && { id: p.data.id, monto: p.data.monto, creadoEn: p.data.created_at },
  };
}
