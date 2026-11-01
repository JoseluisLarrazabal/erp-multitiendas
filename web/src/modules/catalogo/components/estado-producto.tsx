"use client";

import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { cambiarEstadoProducto } from "../actions";

// Un producto no se borra: se desactiva y deja de aparecer en la venta, con su historial intacto.
export function EstadoProducto({
  productoId,
  nombre,
  activo,
}: {
  productoId: string;
  nombre: string;
  activo: boolean;
}) {
  return activo ? (
    <ConfirmarAccion
      etiqueta="Desactivar producto"
      titulo={`¿Desactivar ${nombre}?`}
      descripcion="Dejará de ofrecerse en la venta. Su historial y su stock se conservan, y puedes reactivarlo cuando quieras."
      confirmar="Desactivar"
      accion={() => cambiarEstadoProducto({ productoId, activo: false })}
    />
  ) : (
    <ConfirmarAccion
      etiqueta="Reactivar producto"
      titulo={`¿Reactivar ${nombre}?`}
      descripcion="Volverá a ofrecerse en la venta."
      confirmar="Reactivar"
      destructiva={false}
      accion={() => cambiarEstadoProducto({ productoId, activo: true })}
    />
  );
}
