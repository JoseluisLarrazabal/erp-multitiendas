import { describe, expect, it } from "vitest";
import { validarCampos } from "@/components/panel/campo";
import { salidaSchema, trasladoSchema } from "../schemas";
import { camposSalida, camposTraslado } from "./campos-operacion";

const id = "a0000000-0000-0000-0000-000000000001";
const otro = "a0000000-0000-0000-0000-000000000002";
// validarCampos solo usa querySelector para enfocar.
const formulario = { querySelector: () => null } as unknown as HTMLFormElement;

describe("fallo del schema -> campo real", () => {
  const traslado = { operacionId: id, negocioId: id, productoId: id, cantidad: "1", motivo: "" };
  it("traslado: destino igual al origen cae en destino", () => {
    const r = validarCampos(
      formulario,
      trasladoSchema,
      { ...traslado, origenId: id, destinoId: id, serieIds: null },
      camposTraslado("unidad"),
    );
    expect(Object.keys("errores" in r ? r.errores : {})).toEqual(["tra-destino"]);
  });
  it("traslado: origen inválido cae en origen y cantidad inválida en cantidad", () => {
    const r = validarCampos(
      formulario,
      trasladoSchema,
      { ...traslado, cantidad: "0", origenId: "", destinoId: otro, serieIds: null },
      camposTraslado("unidad"),
    );
    expect(Object.keys("errores" in r ? r.errores : {}).sort()).toEqual([
      "tra-cantidad",
      "tra-origen",
    ]);
  });
  it("salida: tipo inválido cae en tipo, no en cantidad", () => {
    const r = validarCampos(
      formulario,
      salidaSchema,
      {
        operacionId: id,
        negocioId: id,
        productoId: id,
        ubicacionId: id,
        tipo: "otro",
        cantidad: "2",
        motivo: "x",
        serieIds: null,
      },
      camposSalida("unidad", false),
    );
    expect(Object.keys("errores" in r ? r.errores : {})).toEqual(["sal-tipo"]);
  });
});
