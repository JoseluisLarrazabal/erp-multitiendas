import { describe, expect, it } from "vitest";
import { CADUCIDAD_CONTEXTO_MS } from "./contexto-local";
import { vencerSiCorresponde, type SesionPos } from "./use-pos-sesion";

const lista: SesionPos = {
  fase: "lista",
  usuarioId: "u1",
  negocios: [],
  activoId: "n1",
  permisos: [],
};

describe("vencerSiCorresponde", () => {
  it("una sesión lista sin confirmar por más de 72 h pasa a vencida", () => {
    expect(vencerSiCorresponde(lista, 0, CADUCIDAD_CONTEXTO_MS + 1)).toEqual({
      fase: "sin-conexion",
      contextoVencido: true,
    });
  });
  it("dentro del plazo, sin fecha conocida o en otra fase no cambia", () => {
    expect(vencerSiCorresponde(lista, 0, CADUCIDAD_CONTEXTO_MS)).toBe(lista);
    expect(vencerSiCorresponde(lista, null, 1e15)).toBe(lista);
    const verificando: SesionPos = { fase: "verificando" };
    expect(vencerSiCorresponde(verificando, 0, 1e15)).toBe(verificando);
  });
});
