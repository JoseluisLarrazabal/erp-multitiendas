import type { Campos } from "@/components/panel/campo";
import { mensajeCantidad, type Unidad } from "../domain";

// Clave del schema -> control y mensaje, en orden de pantalla. Un fallo del schema cae en su campo real.
export const camposSalida = (unidad: Unidad | undefined, conSigno: boolean): Campos => ({
  productoId: { id: "sal-producto", mensaje: "Elige un producto." },
  tipo: { id: "sal-tipo", mensaje: "Elige un tipo de salida válido." },
  ubicacionId: { id: "sal-ubicacion", mensaje: "Elige una ubicación." },
  cantidad: { id: "sal-cantidad", mensaje: mensajeCantidad(unidad, conSigno) },
  motivo: { id: "sal-motivo", mensaje: "El motivo es obligatorio." },
});

export const camposConsumo = (unidad: Unidad | undefined): Campos => ({
  productoId: { id: "con-producto", mensaje: "Elige un insumo." },
  ubicacionId: { id: "con-ubicacion", mensaje: "Elige una ubicación." },
  cantidad: { id: "con-cantidad", mensaje: mensajeCantidad(unidad) },
  motivo: { id: "con-motivo", mensaje: "El motivo es obligatorio." },
});

export const camposTraslado = (unidad: Unidad | undefined): Campos => ({
  productoId: { id: "tra-producto", mensaje: "Elige un producto." },
  origenId: { id: "tra-origen", mensaje: "Elige un origen." },
  destinoId: { id: "tra-destino", mensaje: "El destino debe ser distinto del origen." },
  cantidad: { id: "tra-cantidad", mensaje: mensajeCantidad(unidad) },
  motivo: { id: "tra-motivo", mensaje: "El motivo es demasiado largo." },
});
