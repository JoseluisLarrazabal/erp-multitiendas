"use client";

import { kardexExcelAccion } from "../actions";
import { BotonExcel } from "./boton-excel";

// Kardex completo del producto: las filas se piden al servidor al pulsar, no son solo las de la página.
export function BotonKardexExcel({
  productoId,
  ubicacionId,
  archivo,
}: {
  productoId: string;
  ubicacionId: string;
  archivo: string;
}) {
  return (
    <BotonExcel archivo={archivo} cargar={() => kardexExcelAccion({ productoId, ubicacionId })} />
  );
}
