import { describe, expect, it } from "vitest";
import {
  conteoSchema,
  entradaSchema,
  filtrosStockSchema,
  leerFiltrosVencimientos,
  revertirConsumoSchema,
  salidaSchema,
  seriesSchema,
  trasladoSchema,
} from "./schemas";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const base = { operacionId: A, negocioId: A };

describe("entradaSchema", () => {
  const ok = { ...base, productoId: A, ubicacionId: B, cantidad: "2,5", costo: "", motivo: "" };
  it("cantidad con coma, costo y motivo vacíos a null", () => {
    expect(entradaSchema.parse(ok)).toMatchObject({ cantidad: 2.5, costo: null, motivo: null });
    expect(entradaSchema.parse({ ...ok, costo: "12,5" }).costo).toBe(12.5);
  });
  it("rechaza cantidad 0, negativa, con miles ambiguos o costo inválido", () => {
    for (const cantidad of ["0", "-1", "1.500", "abc", ""])
      expect(entradaSchema.safeParse({ ...ok, cantidad }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...ok, costo: "x" }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...ok, operacionId: "no" }).success).toBe(false);
  });
});

describe("salidaSchema: consumo", () => {
  const ok = {
    ...base,
    productoId: A,
    ubicacionId: B,
    tipo: "consumo",
    cantidad: "2,5",
    motivo: " lavado ",
    serieIds: null,
  };
  it("el consumo sale negativo y recorta el motivo", () => {
    expect(salidaSchema.parse(ok)).toMatchObject({ cantidad: -2.5, motivo: "lavado" });
  });
  it("rechaza cantidad 0 o con signo y motivo vacío", () => {
    for (const cantidad of ["0", "-1", "abc", ""])
      expect(salidaSchema.safeParse({ ...ok, cantidad }).success).toBe(false);
    expect(salidaSchema.safeParse({ ...ok, motivo: "  " }).success).toBe(false);
  });
});

describe("revertirConsumoSchema", () => {
  it("pide motivo y ids válidos", () => {
    const ok = { operacionId: A, movimientoId: B, motivo: " error de carga " };
    expect(revertirConsumoSchema.parse(ok).motivo).toBe("error de carga");
    expect(revertirConsumoSchema.safeParse({ ...ok, motivo: " " }).success).toBe(false);
    expect(revertirConsumoSchema.safeParse({ ...ok, movimientoId: "x" }).success).toBe(false);
  });
});

describe("entradaSchema: lote", () => {
  const ok = { ...base, productoId: A, ubicacionId: B, cantidad: "2", costo: "", motivo: "" };
  const campos = (r: ReturnType<typeof entradaSchema.safeParse>) =>
    r.success ? [] : r.error.issues.map((i) => i.path[0]);
  it("sin lote ni vence (o sin las claves) pasa con null", () => {
    expect(entradaSchema.parse(ok)).toMatchObject({ lote: null, vence: null });
    expect(entradaSchema.parse({ ...ok, lote: " ", vence: "" })).toMatchObject({
      lote: null,
      vence: null,
    });
  });
  it("con los dos pasa y recorta el lote", () => {
    expect(entradaSchema.parse({ ...ok, lote: " L-1 ", vence: "2026-12-31" })).toMatchObject({
      lote: "L-1",
      vence: "2026-12-31",
    });
  });
  it("uno solo marca el campo que falta", () => {
    expect(campos(entradaSchema.safeParse({ ...ok, lote: "L-1", vence: "" }))).toEqual(["vence"]);
    expect(campos(entradaSchema.safeParse({ ...ok, lote: "", vence: "2026-12-31" }))).toEqual([
      "lote",
    ]);
  });
  it("rechaza fecha imposible o mal escrita y lote de más de 40 caracteres", () => {
    for (const vence of ["2026-02-30", "31/12/2026", "2026-13-01", "mañana"])
      expect(entradaSchema.safeParse({ ...ok, lote: "L", vence }).success, vence).toBe(false);
    expect(
      entradaSchema.safeParse({ ...ok, lote: "x".repeat(41), vence: "2026-12-31" }).success,
    ).toBe(false);
  });
});

describe("leerFiltrosVencimientos", () => {
  it("default 7; acepta 7, 15 y 30; lo demás vuelve a 7 y avisa", () => {
    expect(leerFiltrosVencimientos({})).toEqual({ filtros: { dias: 7 }, invalido: false });
    expect(leerFiltrosVencimientos({ dias: "30" }).filtros.dias).toBe(30);
    for (const dias of ["10", "abc", "-7", "7.5"])
      expect(leerFiltrosVencimientos({ dias })).toEqual({ filtros: { dias: 7 }, invalido: true });
  });
});

describe("salidaSchema", () => {
  const ok = {
    ...base,
    productoId: A,
    ubicacionId: B,
    tipo: "danado",
    cantidad: "2",
    motivo: "se cayó",
    serieIds: null,
  };
  it("una salida que no es ajuste se envía negativa", () => {
    expect(salidaSchema.parse(ok).cantidad).toBe(-2);
  });
  it("ajuste lleva el signo escrito", () => {
    expect(salidaSchema.parse({ ...ok, tipo: "ajuste", cantidad: "−3" }).cantidad).toBe(-3);
    expect(salidaSchema.parse({ ...ok, tipo: "ajuste", cantidad: "+3" }).cantidad).toBe(3);
  });
  it("exige motivo y rechaza signo fuera de ajuste", () => {
    expect(salidaSchema.safeParse({ ...ok, motivo: "  " }).success).toBe(false);
    expect(salidaSchema.safeParse({ ...ok, cantidad: "-2" }).success).toBe(false);
    expect(salidaSchema.safeParse({ ...ok, tipo: "ajuste", cantidad: "0" }).success).toBe(false);
  });
});

describe("trasladoSchema", () => {
  const ok = {
    ...base,
    productoId: A,
    origenId: A,
    destinoId: B,
    cantidad: "1",
    motivo: "",
    serieIds: null,
  };
  it("valida y rechaza origen igual al destino", () => {
    expect(trasladoSchema.safeParse(ok).success).toBe(true);
    expect(trasladoSchema.safeParse({ ...ok, destinoId: A }).success).toBe(false);
  });
});

describe("conteoSchema", () => {
  const item = { productoId: A, cantidad: "0", serieIds: null };
  it("admite contar 0 y limita a 500 ítems", () => {
    expect(
      conteoSchema.safeParse({ ...base, ubicacionId: B, motivo: "", items: [item] }).success,
    ).toBe(true);
    expect(
      conteoSchema.safeParse({ ...base, ubicacionId: B, motivo: "", items: Array(501).fill(item) })
        .success,
    ).toBe(false);
    expect(conteoSchema.safeParse({ ...base, ubicacionId: B, motivo: "", items: [] }).success).toBe(
      false,
    );
  });
});

describe("seriesSchema", () => {
  it("separa por línea, coma o punto y coma, y descarta vacíos", () => {
    const r = seriesSchema.parse({
      negocioId: A,
      productoId: A,
      ubicacionId: B,
      series: "A1\n B2 ;C3,,\n",
    });
    expect(r.series).toEqual(["A1", "B2", "C3"]);
  });
  it("rechaza vacío", () => {
    expect(
      seriesSchema.safeParse({ negocioId: A, productoId: A, ubicacionId: B, series: " \n " })
        .success,
    ).toBe(false);
  });
});

describe("filtrosStockSchema", () => {
  it("entrada de URL mala cae a valores seguros", () => {
    expect(filtrosStockSchema.parse({ q: ["x"], bajo: "1", pagina: "-4" })).toEqual({
      q: "",
      bajo: true,
      pagina: 1,
    });
    expect(filtrosStockSchema.parse({})).toEqual({ q: "", bajo: false, pagina: 1 });
  });
});
