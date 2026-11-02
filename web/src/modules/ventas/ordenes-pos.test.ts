import { describe, expect, it } from "vitest";
import { errorRetiro, estaAtrasada, filtrarOrdenes, mensajeAnulacion, PASOS } from "./ordenes-pos";
import type { OrdenActiva } from "./queries-ordenes";

const orden = (c: Partial<OrdenActiva>): OrdenActiva => ({
  id: "1",
  numero: "L1-000001",
  total: 10,
  cliente: "María Pérez",
  prendas: 2,
  casillero: null,
  fechaPrometida: "2026-11-05",
  estado: "recibida",
  express: false,
  ...c,
});

describe("filtrarOrdenes", () => {
  const todas = [orden({}), orden({ id: "2", numero: "L1-000002", cliente: "Juan" })];
  it("sin texto devuelve todas", () => expect(filtrarOrdenes(todas, "  ")).toHaveLength(2));
  it("por número o por cliente sin tildes", () => {
    expect(filtrarOrdenes(todas, "000002").map((o) => o.id)).toEqual(["2"]);
    expect(filtrarOrdenes(todas, "maria perez").map((o) => o.id)).toEqual(["1"]);
    expect(filtrarOrdenes(todas, "zzz")).toEqual([]);
  });
});

describe("estados y retiro", () => {
  it("solo lista se entrega; recibida no vuelve", () => {
    expect(PASOS.lista.entregar).toBe(true);
    expect(PASOS.recibida.anterior).toBeUndefined();
    expect(PASOS.en_lavado).toEqual({ siguiente: "lista", anterior: "recibida" });
  });
  it("atrasada es estrictamente anterior a hoy", () => {
    expect(estaAtrasada(orden({}), "2026-11-05")).toBe(false);
    expect(estaAtrasada(orden({}), "2026-11-06")).toBe(true);
  });
  it("el carnet exige documento; la boleta no", () => {
    expect(errorRetiro({ quien: "", con: "boleta", documento: "" })).not.toBeNull();
    expect(errorRetiro({ quien: "Ana", con: "boleta", documento: "" })).toBeNull();
    expect(errorRetiro({ quien: "Ana", con: "carnet", documento: " " })).not.toBeNull();
    expect(errorRetiro({ quien: "Ana", con: "carnet", documento: "123" })).toBeNull();
  });
  it("el aviso de anulación distingue el reembolso", () => {
    expect(mensajeAnulacion(true)).toContain("Se devolvió el efectivo");
    expect(mensajeAnulacion(false)).toContain("ya cerró");
  });
});
