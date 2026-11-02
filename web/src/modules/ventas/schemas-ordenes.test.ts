import { describe, expect, it } from "vitest";
import {
  anularOrdenSchema,
  cursorOrden,
  DIAS_SIN_RECOGER,
  hrefOrdenes,
  leerFiltrosOrdenes,
  limpiarBusqueda,
  partirCursor,
  umbralSinRecoger,
} from "./schemas-ordenes";

const ID = "e0000000-0000-0000-0000-000000000001";
const FECHA = "2026-11-02T14:30:00.123456+00:00";

describe("leerFiltrosOrdenes", () => {
  it("sin parámetros: activas, sin búsqueda ni cursor", () => {
    expect(leerFiltrosOrdenes({})).toEqual({
      filtros: { q: "", estado: "", desde: "" },
      invalido: false,
    });
  });
  it("acepta cada estado y sin_recoger; uno desconocido se ignora y avisa", () => {
    for (const e of ["recibida", "en_lavado", "lista", "entregada", "cancelada", "sin_recoger"])
      expect(leerFiltrosOrdenes({ estado: e }).filtros.estado).toBe(e);
    const r = leerFiltrosOrdenes({ estado: "otra" });
    expect(r.filtros.estado).toBe("");
    expect(r.invalido).toBe(true);
  });
  it("un cursor mal formado se ignora y avisa", () => {
    expect(leerFiltrosOrdenes({ desde: cursorOrden(FECHA, ID) }).filtros.desde).toBe(
      cursorOrden(FECHA, ID),
    );
    const r = leerFiltrosOrdenes({ desde: `${FECHA}_x),id.eq.1` });
    expect(r.filtros.desde).toBe("");
    expect(r.invalido).toBe(true);
  });
});

describe("cursor", () => {
  it("ida y vuelta", () => {
    expect(partirCursor(cursorOrden(FECHA, ID))).toEqual({ estadoEn: FECHA, id: ID });
    expect(partirCursor("basura")).toBeNull();
  });
});

describe("umbralSinRecoger", () => {
  it("es el instante de hace 30 días", () => {
    const ahora = Date.parse("2026-11-02T12:00:00Z");
    expect(umbralSinRecoger(ahora)).toBe("2026-10-03T12:00:00.000Z");
    expect(DIAS_SIN_RECOGER).toBe(30);
  });
});

describe("limpiarBusqueda", () => {
  it("quita lo que rompería el LIKE o el .or() de PostgREST", () => {
    expect(limpiarBusqueda('a%b_c,d(e)f"g\\h*i')).toBe("abcdefghi");
    expect(limpiarBusqueda("x),id.eq.1")).toBe("xid.eq.1");
  });
  it("conserva nombres con tildes, espacios, guion y punto", () => {
    expect(limpiarBusqueda("  María   J.  Núñez-Paz ")).toBe("María J. Núñez-Paz");
    expect(limpiarBusqueda("L1-000123")).toBe("L1-000123");
  });
});

describe("hrefOrdenes", () => {
  it("omite lo vacío y codifica el cursor", () => {
    expect(hrefOrdenes({})).toBe("/panel/ordenes");
    const h = hrefOrdenes({ q: "ana", estado: "lista", desde: cursorOrden(FECHA, ID) });
    expect(h).toContain("q=ana&estado=lista&desde=");
    expect(h).toContain("%2B00%3A00");
  });
});

describe("anularOrdenSchema", () => {
  it("exige id y motivo no vacío de hasta 200", () => {
    expect(anularOrdenSchema.safeParse({ ordenId: ID, motivo: " x " }).data?.motivo).toBe("x");
    expect(anularOrdenSchema.safeParse({ ordenId: ID, motivo: "  " }).success).toBe(false);
    expect(anularOrdenSchema.safeParse({ ordenId: ID, motivo: "a".repeat(201) }).success).toBe(
      false,
    );
    expect(anularOrdenSchema.safeParse({ ordenId: "no", motivo: "x" }).success).toBe(false);
  });
});
