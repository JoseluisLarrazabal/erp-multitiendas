import type { ResumenCarrito } from "./carrito";
import { aBolivianos, brutoLinea, formatearCantidad, parsearMonto, type Lista } from "./domain";
import { ventaPayloadSchema, type VentaPayload } from "./schemas";

export type DatosEnvio = {
  ventaId: string;
  dispositivoId: string;
  cajaId: string;
  numero: string;
  clienteId: string | null;
  creadaEnCliente: string;
  descuentoVentaTexto: string;
  efectivo: number;
  qr: number;
  // false: el QR se cobró sin conexión y queda pendiente de verificar (solo viaja con p_offline).
  qrVerificado: boolean;
};

// Construye y valida el payload. Se llama una vez al confirmar el cobro: los reintentos reenvían este mismo objeto.
export function construirPayload(resumen: ResumenCarrito, d: DatosEnvio): VentaPayload | null {
  if (!resumen.totales || resumen.error) return null;
  const descuentoVenta =
    d.descuentoVentaTexto.trim() === "" ? 0 : parsearMonto(d.descuentoVentaTexto);
  if (descuentoVenta === null) return null;
  const items = resumen.lineas.map((r) => ({
    producto_id: r.linea.producto.id,
    lista: r.linea.lista as Lista,
    cantidad: (r.entrada?.cantidadMilesimas ?? 0) / 1000,
    precio_unitario: aBolivianos(r.entrada?.precio ?? 0),
    descuento: aBolivianos(r.entrada?.descuento ?? 0),
    serie_id: r.linea.serieId,
  }));
  const pagos: VentaPayload["pagos"] = [];
  if (d.efectivo > 0) pagos.push({ medio: "efectivo", monto: aBolivianos(d.efectivo) });
  if (d.qr > 0) pagos.push({ medio: "qr", monto: aBolivianos(d.qr), verificado: d.qrVerificado });
  const r = ventaPayloadSchema.safeParse({
    id: d.ventaId,
    dispositivo_id: d.dispositivoId,
    caja_sesion_id: d.cajaId,
    numero: d.numero,
    cliente_id: d.clienteId,
    creada_en_cliente: d.creadaEnCliente,
    descuento: aBolivianos(descuentoVenta),
    total: aBolivianos(resumen.totales.total),
    items,
    pagos,
  });
  return r.success ? r.data : null;
}

export type NotaVenta = {
  numero: string;
  fechaIso: string;
  negocio: { nombre: string; nit: string | null; datosNota: string | null };
  vendedor: string;
  cliente: { nombre: string; documento: string | null } | null;
  // Orden de lavandería: la nota se imprime como boleta con la ficha.
  orden?: {
    telefono: string | null;
    prendas: number;
    casillero: string | null;
    express: boolean;
    fechaPrometida: string;
    nota: string | null;
  };
  lineas: {
    nombre: string;
    codigo: string;
    cantidad: string;
    precio: number;
    descuento: number;
    total: number;
    garantiaMeses: number | null;
    serie: string | null;
  }[];
  subtotal: number;
  descuentoVenta: number;
  total: number;
  pagos: { medio: "efectivo" | "qr"; monto: number; pendiente?: boolean }[];
  recibido: number;
  vuelto: number;
};

// Todo en centavos; la nota se arma con lo que vio el cajero, sin volver a consultar.
export function construirNota(
  resumen: ResumenCarrito,
  d: Pick<
    DatosEnvio,
    "numero" | "creadaEnCliente" | "efectivo" | "qr" | "descuentoVentaTexto" | "qrVerificado"
  >,
  contexto: Pick<NotaVenta, "negocio" | "vendedor" | "cliente" | "orden"> & { recibido: number },
): NotaVenta | null {
  if (!resumen.totales) return null;
  const pagos: NotaVenta["pagos"] = [];
  if (d.efectivo > 0) pagos.push({ medio: "efectivo", monto: d.efectivo });
  if (d.qr > 0)
    pagos.push({ medio: "qr", monto: d.qr, ...(d.qrVerificado ? {} : { pendiente: true }) });
  return {
    numero: d.numero,
    fechaIso: d.creadaEnCliente,
    ...contexto,
    lineas: resumen.lineas.map((r) => {
      const e = r.entrada!;
      return {
        nombre: r.linea.producto.nombre,
        codigo: r.linea.producto.codigo,
        cantidad: formatearCantidad(e.cantidadMilesimas),
        precio: e.precio,
        descuento: e.descuento,
        total: brutoLinea(e.cantidadMilesimas, e.precio) - e.descuento,
        garantiaMeses: r.linea.producto.garantiaMeses,
        serie: r.linea.serieTexto,
      };
    }),
    subtotal: resumen.totales.subtotal,
    descuentoVenta: resumen.totales.sumaLineas - resumen.totales.total,
    total: resumen.totales.total,
    pagos,
    vuelto: contexto.recibido - d.efectivo,
  };
}
