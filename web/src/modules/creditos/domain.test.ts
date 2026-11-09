import { describe, expect, it } from "vitest";
import {
  agruparPorCliente,
  inicialMinima,
  planCuotas,
  sumarMeses,
  vencidas,
  type Cuenta,
} from "./domain";

describe("planCuotas (DB-21, P-07)", () => {
  it("1000 al 2,5 % en 3 cuotas: 350,14 / 350,14 / 350,13", () => {
    const p = planCuotas(100_000, 2.5, 3);
    expect(p.map((c) => [c.capital, c.interes])).toEqual([
      [32_514, 2_500],
      [33_327, 1_687],
      [34_159, 854],
    ]);
    expect(p.map((c) => c.monto)).toEqual([35_014, 35_014, 35_013]);
    expect(p.reduce((t, c) => t + c.capital, 0)).toBe(100_000);
  });
  it("60 al 2,5 % en 3 cuotas: 21,01 / 21,01 / 21,00", () => {
    expect(planCuotas(6_000, 2.5, 3).map((c) => c.monto)).toEqual([2_101, 2_101, 2_100]);
  });
  it("sin interés reparte el capital y la última absorbe", () => {
    expect(planCuotas(10_000, 0, 3).map((c) => c.monto)).toEqual([3_333, 3_333, 3_334]);
  });
  it("una cuota cobra el capital más un mes de interés", () => {
    expect(planCuotas(50_000, 2.5, 1).map((c) => c.monto)).toEqual([51_250]);
  });
  it("el capital siempre suma exacto", () => {
    for (const n of [1, 2, 5, 12, 36])
      expect(planCuotas(123_456, 2.5, n).reduce((t, c) => t + c.capital, 0)).toBe(123_456);
  });
  it("entradas inválidas dan []", () => {
    expect(planCuotas(0, 2.5, 3)).toEqual([]);
    expect(planCuotas(1_000, 2.5, 0)).toEqual([]);
    expect(planCuotas(1_000, 2.5, 37)).toEqual([]);
    expect(planCuotas(1_000, -1, 3)).toEqual([]);
    expect(planCuotas(2, 0, 5)).toEqual([]);
  });
});

describe("fechas y mínimos", () => {
  it("vence el mismo día o el último del mes más corto", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2026-01-31", 2)).toBe("2026-03-31");
    expect(sumarMeses("2026-01-31", 3)).toBe("2026-04-30");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(sumarMeses("2026-11-08", 3)).toBe("2027-02-08");
    expect(sumarMeses("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("la inicial mínima redondea hacia arriba", () => {
    expect(inicialMinima(12_000, 50)).toBe(6_000);
    expect(inicialMinima(3_333, 50)).toBe(1_667);
    expect(inicialMinima(10_000, 0)).toBe(0);
    expect(inicialMinima(10_001, 30)).toBe(3_001);
  });
});

const cuenta = (o: Partial<Cuenta>): Cuenta => ({
  creditoId: "c1",
  clienteId: "a",
  clienteNombre: "Ana",
  clienteDocumento: null,
  origen: "venta",
  ventaNumero: "C1-000001",
  creadoEn: "2026-11-01T00:00:00Z",
  total: 100,
  pagado: 0,
  saldo: 100,
  cuotasVencidas: 0,
  montoVencido: 0,
  diasAtraso: 0,
  proximaVence: null,
  proximoMonto: 0,
  ...o,
});

describe("cuentas por cobrar", () => {
  it("suma el saldo por cliente en centavos y ordena por atraso", () => {
    const g = agruparPorCliente([
      cuenta({ creditoId: "1", clienteId: "a", saldo: 0.1 }),
      cuenta({ creditoId: "2", clienteId: "a", saldo: 0.2 }),
      cuenta({
        creditoId: "3",
        clienteId: "b",
        clienteNombre: "Beto",
        saldo: 50,
        diasAtraso: 12,
        cuotasVencidas: 1,
        montoVencido: 20,
      }),
    ]);
    expect(g.map((x) => [x.nombre, x.saldo, x.creditos, x.diasAtraso])).toEqual([
      ["Beto", 50, 1, 12],
      ["Ana", 0.3, 2, 0],
    ]);
  });
  it("vencidas solo trae las atrasadas, la más atrasada primero", () => {
    const v = vencidas([
      cuenta({ creditoId: "1", cuotasVencidas: 1, diasAtraso: 3 }),
      cuenta({ creditoId: "2" }),
      cuenta({ creditoId: "3", cuotasVencidas: 2, diasAtraso: 40 }),
    ]);
    expect(v.map((x) => x.creditoId)).toEqual(["3", "1"]);
  });
});
