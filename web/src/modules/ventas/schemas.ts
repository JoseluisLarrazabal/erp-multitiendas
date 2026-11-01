import { z } from "zod";
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
  ubicaciones: { id: string; nombre: string }[];
  productos: ProductoPos[];
};

const centavosONulo = (n: number | null) => (n === null ? null : aCentavos(n));

export function leerCatalogo(json: unknown): Catalogo | null {
  const r = catalogoSchema.safeParse(json);
  if (!r.success) return null;
  return {
    version: r.data.version,
    ubicaciones: r.data.ubicaciones,
    productos: r.data.productos.map((p) => {
      const precios: PreciosCentavos = {
        contado: centavosONulo(p.precios.contado),
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
// 2 decimales (3 en cantidad), QR siempre verificado, crédito no existe.
const dinero = z.number().refine((n) => n >= 0 && Math.round(n * 100) / 100 === n);
const cantidad = z.number().refine((n) => n > 0 && Math.round(n * 1000) / 1000 === n);

export const itemVentaSchema = z.strictObject({
  producto_id: z.guid(),
  lista: z.enum(["contado", "mayorista", "minimo", "normal", "express"]),
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
    verificado: z.literal(true),
  }),
]);

export const ventaPayloadSchema = z.strictObject({
  id: z.guid(),
  dispositivo_id: z.guid(),
  caja_sesion_id: z.guid(),
  numero: z.string().regex(/^[A-Z][0-9]{1,2}-[0-9]{6}$/),
  cliente_id: z.guid().nullable(),
  creada_en_cliente: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/),
  descuento: dinero,
  total: dinero.refine((n) => n > 0),
  items: z.array(itemVentaSchema).min(1).max(200),
  pagos: z.array(pagoVentaSchema).min(1).max(10),
});
export type VentaPayload = z.infer<typeof ventaPayloadSchema>;

export const respuestaVentaSchema = z.object({
  id: z.guid(),
  numero: z.string(),
  total: z.number(),
});
