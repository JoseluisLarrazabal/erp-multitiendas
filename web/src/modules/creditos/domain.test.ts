import { describe, expect, it } from "vitest";
import { agruparPorCliente, vencidas, type Cuenta } from "./domain";

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
