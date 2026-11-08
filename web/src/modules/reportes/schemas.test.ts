import { describe, expect, it } from "vitest";
import {
  hrefReportes,
  leerFiltrosReporte,
  rangosRapidos,
  respuestaCajaSchema,
  respuestaVentasSchema,
} from "./schemas";

const HOY = "2026-11-02";
const leer = (crudo: Record<string, string>, tipo = "tienda") =>
  leerFiltrosReporte(crudo, tipo, HOY);

describe("leerFiltrosReporte", () => {
  it("sin parámetros: primer reporte del tipo, hoy, agrupado por día", () => {
    expect(leer({})).toEqual({
      filtros: { r: "ventas", desde: HOY, hasta: HOY, agrupar: "dia", dias: 30, filtro: "todo" },
      invalido: false,
    });
    expect(leer({}, "lavanderia").filtros.r).toBe("ingresos");
  });
  it("acepta valores válidos", () => {
    const { filtros, invalido } = leer({
      r: "stock",
      desde: "2026-10-01",
      hasta: "2026-10-31",
      dias: "90",
      filtro: "sin",
    });
    expect(invalido).toBe(false);
    expect(filtros).toMatchObject({ r: "stock", dias: 90, filtro: "sin", desde: "2026-10-01" });
  });
  it("un reporte que el negocio no tiene vuelve al primero y avisa", () => {
    const r = leer({ r: "ventas" }, "lavanderia");
    expect(r.invalido).toBe(true);
    expect(r.filtros.r).toBe("ingresos");
    expect(leer({ r: "masvendidos" }, "frial").invalido).toBe(true);
  });
  it("el reporte de insumos es de lavandería y exige ver_costos", () => {
    const r = leer({ r: "insumos", agrupar: "insumo" }, "lavanderia");
    expect(r).toMatchObject({ invalido: false, filtros: { r: "insumos", agrupar: "insumo" } });
    expect(leerFiltrosReporte({ r: "insumos" }, "lavanderia", HOY, false)).toMatchObject({
      invalido: true,
      filtros: { r: "ingresos" },
    });
    expect(leer({ r: "insumos" }, "tienda").invalido).toBe(true);
    expect(leer({ r: "ventas", agrupar: "insumo" }, "tienda").invalido).toBe(true);
  });
  it("una agrupación que el reporte no admite avisa; si no vino en la URL, no", () => {
    expect(leer({ r: "ingresos", agrupar: "marca" }, "lavanderia")).toMatchObject({
      invalido: true,
      filtros: { agrupar: "dia" },
    });
    expect(leer({ r: "ventas", agrupar: "marca" }).filtros.agrupar).toBe("marca");
  });
  it("fecha mal escrita o inexistente avisa y usa el valor por defecto", () => {
    for (const desde of ["2026-02-31", "hoy", "01/11/2026", "2026-11-2"]) {
      const r = leer({ desde });
      expect(r.invalido).toBe(true);
      expect(r.filtros.desde).toBe(HOY);
    }
  });
  it("rango al revés o de más de 366 días vuelve a hoy", () => {
    expect(leer({ desde: "2026-11-02", hasta: "2026-11-01" })).toMatchObject({
      invalido: true,
      filtros: { desde: HOY, hasta: HOY },
    });
    expect(leer({ desde: "2025-11-01", hasta: "2026-11-02" }).invalido).toBe(true);
    // 366 días con ambos extremos: el máximo.
    expect(leer({ desde: "2025-11-02", hasta: "2026-11-02" }).invalido).toBe(false);
  });
  it("días y filtro de stock fuera de la lista avisan", () => {
    expect(leer({ dias: "45" }).invalido).toBe(true);
    expect(leer({ filtro: "todos" }).invalido).toBe(true);
  });
});

describe("rangosRapidos", () => {
  it("hoy, este mes y mes anterior", () => {
    expect(rangosRapidos("2026-11-02")).toEqual({
      hoy: { desde: "2026-11-02", hasta: "2026-11-02" },
      mes: { desde: "2026-11-01", hasta: "2026-11-02" },
      anterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
  });
  it("cruza el año y respeta febrero bisiesto", () => {
    expect(rangosRapidos("2027-01-15").anterior).toEqual({
      desde: "2026-12-01",
      hasta: "2026-12-31",
    });
    expect(rangosRapidos("2028-03-10").anterior.hasta).toBe("2028-02-29");
  });
});

describe("hrefReportes", () => {
  it("arma la URL con los filtros", () => {
    expect(hrefReportes({ r: "caja", desde: HOY })).toBe("/panel/reportes?r=caja&desde=2026-11-02");
  });
});

describe("respuestas de las RPC", () => {
  const totales = {
    ventas: 1,
    cantidad: 3,
    kg: 0,
    bruto: 90,
    devuelto: 0,
    neto: 90,
    costo: null,
    ganancia: null,
    lineas_sin_costo: 0,
  };
  it("acepta filas y totales de ventas, con costo nulo sin ver_costos", () => {
    const r = respuestaVentasSchema.safeParse({
      filas: [{ ...totales, clave: null, etiqueta: "Sin marca" }],
      totales,
    });
    expect(r.success).toBe(true);
  });
  it("rechaza números como texto, campos que faltan y formas que no son", () => {
    expect(
      respuestaVentasSchema.safeParse({ filas: [], totales: { ...totales, neto: "90" } }).success,
    ).toBe(false);
    expect(respuestaVentasSchema.safeParse({ filas: [{ etiqueta: "x" }], totales }).success).toBe(
      false,
    );
    expect(respuestaCajaSchema.safeParse(null).success).toBe(false);
  });
});
