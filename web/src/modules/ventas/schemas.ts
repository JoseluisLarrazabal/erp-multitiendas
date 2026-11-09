import { z } from "zod";
import { MAX_CUOTAS } from "@/modules/creditos";
import { aCentavos, type PreciosCentavos, type ProductoPos } from "./domain";

// Respuesta de catalogo_pos (jsonb): se valida antes de usarla.
const precio = z.number().nullable();
const productoCatalogoSchema = z.object({
  id: z.guid(),
  codigo: z.string(),
  codigo_barras: z.string().nullable(),
  nombre: z.string(),
  unidad: z.enum(["unidad", "kg"]),
  tipo: z.string(),
  controla_serie: z.boolean(),
  garantia_meses: z.number().nullable(),
  precios: z.object({
    contado: precio,
    credito: precio,
    mayorista: precio,
    minimo: precio,
    normal: precio,
    express: precio,
  }),
  stock_por_ubicacion: z.record(z.string(), z.number()),
  stock_total: z.number(),
});

export const catalogoSchema = z.object({
  tipo_cambio: z.number().nullable(),
  ubicaciones: z.array(z.object({ id: z.guid(), nombre: z.string() })),
  productos: z.array(productoCatalogoSchema),
  version: z.string(),
});
export type Catalogo = {
  version: string;
  tipoCambio: number | null;
  ubicaciones: { id: string; nombre: string }[];
  productos: ProductoPos[];
};

const centavosONulo = (n: number | null) => (n === null ? null : aCentavos(n));

export function leerCatalogo(json: unknown): Catalogo | null {
  const r = catalogoSchema.safeParse(json);
  if (!r.success) return null;
  return {
    version: r.data.version,
    tipoCambio: r.data.tipo_cambio !== null && r.data.tipo_cambio > 0 ? r.data.tipo_cambio : null,
    ubicaciones: r.data.ubicaciones,
    productos: r.data.productos.map((p) => {
      const precios: PreciosCentavos = {
        contado: centavosONulo(p.precios.contado),
        credito: centavosONulo(p.precios.credito),
        mayorista: centavosONulo(p.precios.mayorista),
        minimo: centavosONulo(p.precios.minimo),
        normal: centavosONulo(p.precios.normal),
        express: centavosONulo(p.precios.express),
      };
      return {
        id: p.id,
        codigo: p.codigo,
        codigoBarras: p.codigo_barras,
        nombre: p.nombre,
        unidad: p.unidad,
        tipo: p.tipo,
        controlaSerie: p.controla_serie,
        garantiaMeses: p.garantia_meses,
        precios,
        stockPorUbicacion: p.stock_por_ubicacion,
        stockTotal: p.stock_total,
      };
    }),
  };
}

// Payload de registrar_venta. Mismas reglas que el servidor: claves exactas, números JSON con a lo sumo
// 2 decimales (3 en cantidad); `anticipo` y `reserva_id` van juntos y solo en línea. QR `verificado: false` (pendiente) solo existe sin conexión y viaja con
// `p_offline`: el servidor lo rechaza en una venta en línea.
export const dinero = z.number().refine((n) => n >= 0 && Math.round(n * 100) / 100 === n);
export const cantidad = z.number().refine((n) => n > 0 && Math.round(n * 1000) / 1000 === n);

export const itemVentaSchema = z.strictObject({
  producto_id: z.guid(),
  lista: z.enum(["contado", "credito", "mayorista", "minimo", "normal", "express"]),
  cantidad,
  precio_unitario: dinero.refine((n) => n > 0),
  descuento: dinero,
  serie_id: z.guid().nullable(),
});

export const pagoVentaSchema = z.discriminatedUnion("medio", [
  z.strictObject({ medio: z.literal("efectivo"), monto: dinero.refine((n) => n > 0) }),
  z.strictObject({
    medio: z.literal("qr"),
    monto: dinero.refine((n) => n > 0),
    verificado: z.boolean(),
  }),
  // Solo con reserva_id: lo recibido como anticipo, que no es efectivo de la sesión.
  z.strictObject({ medio: z.literal("anticipo"), monto: dinero.refine((n) => n > 0) }),
]);

export const creditoPayloadSchema = z.strictObject({
  cuotas: z.number().int().min(1).max(MAX_CUOTAS),
  docs_ci: z.boolean(),
  docs_domicilio: z.boolean(),
  docs_pagare: z.boolean(),
});
export type CreditoPayload = z.infer<typeof creditoPayloadSchema>;

export const ventaPayloadSchema = z
  .strictObject({
    id: z.guid(),
    dispositivo_id: z.guid(),
    caja_sesion_id: z.guid(),
    numero: z.string().regex(/^[A-Z][0-9]{1,2}-[0-9]{6}$/),
    cliente_id: z.guid().nullable(),
    // Solo al completar una reserva (en línea): la venta de siempre no manda la clave.
    reserva_id: z.guid().optional(),
    // Venta a crédito (RF-CRE-01): solo en línea. Los pagos suman la inicial; las líneas van en la lista `credito`.
    condicion: z.literal("credito").optional(),
    credito: creditoPayloadSchema.optional(),
    creada_en_cliente: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/),
    descuento: dinero,
    total: dinero.refine((n) => n > 0),
    items: z.array(itemVentaSchema).min(1).max(200),
    pagos: z.array(pagoVentaSchema).min(1).max(10),
  })
  .refine(
    // La lista `credito` y el bloque `credito` van juntos y solo con condicion = credito (mismas reglas que el servidor).
    (v) =>
      (v.condicion === "credito") === (v.credito !== undefined) &&
      v.items.every((i) => (i.lista === "credito") === (v.condicion === "credito")),
  );
export type VentaPayload = z.infer<typeof ventaPayloadSchema>;

// Ficha de una orden de lavandería (p_orden de crear_orden). Mismas claves y largos que el servidor; los opcionales
// vacíos no viajan. Con cliente elegido el nombre y el teléfono salen de la base: solo sin cliente (sin conexión) se envían.
export const ordenPayloadSchema = z.strictObject({
  cliente_nombre: z.string().min(1).max(200).optional(),
  cliente_telefono: z.string().min(1).max(30).optional(),
  express: z.boolean(),
  prendas: z.number().int().min(1).max(999),
  casillero: z.string().min(1).max(20).optional(),
  fecha_prometida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nota: z.string().min(1).max(500).optional(),
});
export type OrdenPayload = z.infer<typeof ordenPayloadSchema>;

// Lo que la cola guarda de una venta: el payload y el tipo de cambio que vio el vendedor (va en `p_offline`).
// Con `orden` la fila sigue siendo una venta, pero se envía con crear_orden.
export const payloadColaVentaSchema = z.object({
  venta: ventaPayloadSchema,
  tipo_cambio: z.number().positive().nullable(),
  orden: ordenPayloadSchema.optional(),
});

export const respuestaVentaSchema = z.object({
  id: z.guid(),
  numero: z.string(),
  total: z.number(),
});

// Lo que /pos guarda en IndexedDB para abrir sin red. Sin costos ni clientes: catalogo_pos no los trae.
const preciosGuardadosSchema = z.object({
  contado: z.number().nullable(),
  // Catálogos guardados antes del crédito no la traen: sin precio de crédito.
  credito: z.number().nullable().default(null),
  mayorista: z.number().nullable(),
  minimo: z.number().nullable(),
  normal: z.number().nullable(),
  express: z.number().nullable(),
});
export const catalogoGuardadoSchema = z.object({
  // Cuándo se bajó (ms). Con el stock descontado por ventas locales, la edad sigue siendo la de la bajada.
  guardadoEn: z.number(),
  marcas: z.array(z.tuple([z.string(), z.string()])),
  catalogo: z.object({
    version: z.string(),
    tipoCambio: z.number().nullable(),
    ubicaciones: z.array(z.object({ id: z.string(), nombre: z.string() })),
    productos: z.array(
      z.object({
        id: z.string(),
        codigo: z.string(),
        codigoBarras: z.string().nullable(),
        nombre: z.string(),
        unidad: z.enum(["unidad", "kg"]),
        tipo: z.string(),
        controlaSerie: z.boolean(),
        garantiaMeses: z.number().nullable(),
        precios: preciosGuardadosSchema,
        stockPorUbicacion: z.record(z.string(), z.number()),
        stockTotal: z.number(),
      }),
    ),
  }),
});
export type CatalogoGuardado = z.infer<typeof catalogoGuardadoSchema>;

export const datosNegocioSchema = z.object({
  nombre: z.string(),
  nit: z.string().nullable(),
  datosNota: z.string().nullable(),
  topeDescuento: z.number(),
});
export const equiposGuardadosSchema = z.array(
  z.object({
    id: z.string(),
    nombre: z.string(),
    prefijo: z.string(),
    ubicacionId: z.string(),
    ultimoNumero: z.number(),
  }),
);
