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
import { aNumero, mensajeDeCompras, totalCentavos } from "./domain";
import { compraSchema, pagoSchema, proveedorSchema } from "./schemas";

const mensaje = (codigo?: string) => mensajeDeCompras(codigo) ?? mensajeBase(codigo);
const fallo = (codigo?: string): Resultado<never> => ({ ok: false, error: mensaje(codigo) });
const invalido = () => fallo("ERP_DATOS_INVALIDOS");
const listo = (): Resultado<null> => {
  revalidatePath("/panel/proveedores");
  revalidatePath("/panel/compras");
  return { ok: true, data: null };
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
