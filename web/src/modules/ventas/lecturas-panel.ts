import type { SupabaseClient } from "@supabase/supabase-js";
import { limitesDelDia } from "@/lib/format/fecha";
import type { Database } from "@/lib/supabase/database.types";
import type { Resultado } from "@/modules/usuarios";
import type { Unidad } from "./domain";
import { fueraDePlazo } from "./domain-panel";
import type { FiltrosVentas } from "./schemas-panel";

// Lecturas de /panel/ventas. Todo select lista columnas: venta_items sin costo_unitario y ventas sin huella (grant por
// columnas; un select * falla).
type Cliente = SupabaseClient<Database>;
const falla = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type EquipoPanel = { id: string; nombre: string; prefijo: string };

export async function listarEquiposPanel(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<EquipoPanel[]>> {
  const { data, error } = await supabase
    .from("dispositivos")
    .select("id, nombre, prefijo")
    .eq("negocio_id", negocioId)
    .order("nombre")
    .order("id");
  if (error) return falla("No se pudieron leer los equipos.");
  return { ok: true, data };
}

// Sesiones de caja abiertas del negocio por equipo: la tabla la lee cualquier miembro (RLS), sin pedir `caja`.
export async function sesionesAbiertas(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<{ id: string; dispositivoId: string }[]>> {
  const { data, error } = await supabase
    .from("caja_sesiones")
    .select("id, dispositivo_id")
    .eq("negocio_id", negocioId)
    .is("cerrada_en", null);
  if (error) return falla("No se pudieron leer las cajas abiertas.");
  return { ok: true, data: data.map((s) => ({ id: s.id, dispositivoId: s.dispositivo_id })) };
}

export type FilaVenta = {
  id: string;
  numero: string;
  recibidaEn: string;
  total: number;
  estado: string;
  dispositivoId: string;
};

export async function listarVentas(
  supabase: Cliente,
  negocioId: string,
  f: FiltrosVentas,
  porPagina: number,
): Promise<Resultado<{ filas: FilaVenta[]; total: number; pagina: number }>> {
  const filtrada = (soloConteo: boolean) => {
    let c = supabase
      .from("ventas")
      .select(
        "id, numero, recibida_en, total, estado, dispositivo_id",
        soloConteo ? { count: "exact", head: true } : undefined,
      )
      .eq("negocio_id", negocioId);
    if (f.estado) c = c.eq("estado", f.estado);
    if (f.equipo) c = c.eq("dispositivo_id", f.equipo);
    // El número solo lleva letras, dígitos y guion: se limpia el resto para no tocar el filtro de PostgREST.
    const q = f.q.replace(/[^A-Za-z0-9-]/g, "");
    if (q) c = c.ilike("numero", `%${q}%`);
    const desde = f.desde ? limitesDelDia(f.desde) : null;
    const hasta = f.hasta ? limitesDelDia(f.hasta) : null;
    if (desde) c = c.gte("recibida_en", desde.inicio);
    if (hasta) c = c.lt("recibida_en", hasta.fin);
    return c;
  };
  const { count, error: errorConteo } = await filtrada(true);
  if (errorConteo) return falla("No se pudieron leer las ventas.");
  const total = count ?? 0;
  const pagina = Math.min(Math.max(1, f.pagina), Math.max(1, Math.ceil(total / porPagina)));
  if (total === 0) return { ok: true, data: { filas: [], total, pagina } };
  const desde = (pagina - 1) * porPagina;
  const { data, error } = await filtrada(false)
    .order("recibida_en", { ascending: false })
    .order("id")
    .range(desde, desde + porPagina - 1);
  if (error) return falla("No se pudieron leer las ventas.");
  return {
    ok: true,
    data: {
      total,
      pagina,
      filas: data.map((v) => ({
        id: v.id,
        numero: v.numero,
        recibidaEn: v.recibida_en,
        total: Number(v.total),
        estado: v.estado,
        dispositivoId: v.dispositivo_id,
      })),
    },
  };
}

export type ItemVenta = {
  id: string;
  linea: number;
  codigo: string;
  nombre: string;
  unidad: Unidad;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  totalLinea: number;
  descuentoVenta: number;
  devuelta: number;
};

export type DetalleVenta = {
  id: string;
  numero: string;
  estado: string;
  recibidaEn: string;
  // Pasadas 24 h (RN-08): anular y devolver exigen `devolver_fuera_plazo`.
  fueraDePlazo: boolean;
  origen: string;
  subtotal: number;
  descuento: number;
  total: number;
  motivoAnulacion: string | null;
  anuladaEn: string | null;
  equipo: string;
  cajaSesionId: string;
  cajaSesionAbierta: boolean;
  vendedor: string | null;
  cliente: string | null;
  items: ItemVenta[];
  pagos: { id: string; medio: string; monto: number; verificacion: string }[];
  devoluciones: {
    id: string;
    creadaEn: string;
    motivo: string;
    monto: number;
    montoEfectivo: number;
  }[];
};

export async function detalleVenta(
  supabase: Cliente,
  negocioId: string,
  ventaId: string,
): Promise<Resultado<DetalleVenta | null>> {
  const { data: v, error } = await supabase
    .from("ventas")
    .select(
      "id, numero, estado, recibida_en, origen, subtotal, descuento, total, motivo_anulacion, anulada_en, dispositivo_id, caja_sesion_id, vendedor_id, cliente_id",
    )
    .eq("negocio_id", negocioId)
    .eq("id", ventaId)
    .maybeSingle();
  if (error) return falla("No se pudo leer la venta.");
  if (!v) return { ok: true, data: null };

  const [items, pagos, devs, equipo, sesion, vendedor, cliente] = await Promise.all([
    supabase
      .from("venta_items")
      .select(
        "id, linea, producto_id, cantidad, precio_unitario, descuento, total_linea, descuento_venta",
      )
      .eq("venta_id", ventaId)
      .order("linea"),
    supabase
      .from("venta_pagos")
      .select("id, medio, monto, verificacion")
      .eq("venta_id", ventaId)
      .order("medio")
      .order("id"),
    supabase
      .from("devoluciones")
      .select("id, created_at, motivo, monto, monto_efectivo")
      .eq("venta_id", ventaId)
      .order("created_at"),
    supabase
      .from("dispositivos")
      .select("nombre, prefijo")
      .eq("id", v.dispositivo_id)
      .maybeSingle(),
    supabase.from("caja_sesiones").select("cerrada_en").eq("id", v.caja_sesion_id).maybeSingle(),
    supabase.from("perfiles").select("nombre").eq("id", v.vendedor_id).maybeSingle(),
    v.cliente_id
      ? supabase.from("clientes").select("nombre").eq("id", v.cliente_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (items.error || pagos.error || devs.error || equipo.error || sesion.error)
    return falla("No se pudo leer la venta.");

  const productoIds = [...new Set(items.data.map((i) => i.producto_id))];
  const productos = await supabase
    .from("productos")
    .select("id, codigo, nombre, unidad")
    .in("id", productoIds);
  if (productos.error) return falla("No se pudo leer la venta.");
  const porId = new Map(productos.data.map((p) => [p.id, p]));

  const itemIds = items.data.map((i) => i.id);
  const devItems = devs.data.length
    ? await supabase
        .from("devolucion_items")
        .select("venta_item_id, cantidad")
        .in("venta_item_id", itemIds)
    : { data: [], error: null };
  if (devItems.error) return falla("No se pudo leer la venta.");
  const devuelta = new Map<string, number>();
  for (const d of devItems.data)
    devuelta.set(d.venta_item_id, (devuelta.get(d.venta_item_id) ?? 0) + Number(d.cantidad));

  return {
    ok: true,
    data: {
      id: v.id,
      numero: v.numero,
      estado: v.estado,
      recibidaEn: v.recibida_en,
      fueraDePlazo: fueraDePlazo(v.recibida_en, Date.now()),
      origen: v.origen,
      subtotal: Number(v.subtotal),
      descuento: Number(v.descuento),
      total: Number(v.total),
      motivoAnulacion: v.motivo_anulacion,
      anuladaEn: v.anulada_en,
      equipo: equipo.data ? `${equipo.data.nombre} (${equipo.data.prefijo})` : "—",
      cajaSesionId: v.caja_sesion_id,
      cajaSesionAbierta: sesion.data ? sesion.data.cerrada_en === null : false,
      vendedor: vendedor.data?.nombre ?? null,
      cliente: cliente.data?.nombre ?? null,
      items: items.data.map((i) => {
        const p = porId.get(i.producto_id);
        return {
          id: i.id,
          linea: i.linea,
          codigo: p?.codigo ?? "—",
          nombre: p?.nombre ?? "Producto",
          unidad: p?.unidad === "kg" ? "kg" : "unidad",
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio_unitario),
          descuento: Number(i.descuento),
          totalLinea: Number(i.total_linea),
          descuentoVenta: Number(i.descuento_venta),
          devuelta: devuelta.get(i.id) ?? 0,
        };
      }),
      pagos: pagos.data.map((p) => ({
        id: p.id,
        medio: p.medio,
        monto: Number(p.monto),
        verificacion: p.verificacion,
      })),
      devoluciones: devs.data.map((d) => ({
        id: d.id,
        creadaEn: d.created_at,
        motivo: d.motivo,
        monto: Number(d.monto),
        montoEfectivo: Number(d.monto_efectivo),
      })),
    },
  };
}
