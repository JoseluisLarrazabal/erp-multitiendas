import { describe, expect, it } from "vitest";
import { agruparPagos, agruparPorCliente, vencidas, type Cuenta, type PagoFila } from "./domain";

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

describe("agruparPagos", () => {
  const fila = (o: Partial<PagoFila>): PagoFila => ({
    monto: 10,
    medio: "efectivo",
    creado_en: "2026-11-01T10:00:00Z",
    operacion_id: "p1",
    anula_operacion_id: null,
    motivo: null,
    ...o,
  });

  it("junta las filas de un pago mixto en una línea", () => {
    const [p] = agruparPagos([fila({ monto: 0.1 }), fila({ monto: 0.2, medio: "qr" })]);
    expect(p).toMatchObject({
      efectivo: 0.1,
      qr: 0.2,
      total: 0.3,
      esReverso: false,
      anulado: false,
    });
  });

  it("marca como anulado el cobro con reverso y deja el reverso en negativo", () => {
    const r = agruparPagos([
      fila({ monto: 50 }),
      fila({ monto: -50, operacion_id: "r1", anula_operacion_id: "p1", motivo: "error" }),
      fila({ monto: 20, operacion_id: "p2" }),
    ]);
    expect(r.map((x) => [x.operacionId, x.total, x.anulado, x.esReverso])).toEqual([
      ["p1", 50, true, false],
      ["r1", -50, false, true],
      ["p2", 20, false, false],
    ]);
    expect(r[1]?.motivo).toBe("error");
  });
});
