import { describe, expect, it } from "vitest";
import {
  aperturaSchema,
  cierreSchema,
  movimientoSchema,
  resumenCajaSchema,
  sesionCajaSchema,
} from "./schemas";

describe("caja schemas", () => {
  it("apertura: monto >= 0 con 2 decimales", () => {
    expect(aperturaSchema.safeParse({ montoInicial: 0 }).success).toBe(true);
    expect(aperturaSchema.safeParse({ montoInicial: 100.5 }).success).toBe(true);
    expect(aperturaSchema.safeParse({ montoInicial: -1 }).success).toBe(false);
    expect(aperturaSchema.safeParse({ montoInicial: 1.005 }).success).toBe(false);
  });
  it("sesión: exige id y monto", () => {
    expect(
      sesionCajaSchema.safeParse({
        id: "a0000000-0000-0000-0000-000000000001",
        monto_inicial: 0,
        abierta_en: "x",
      }).success,
    ).toBe(true);
    expect(sesionCajaSchema.safeParse({ id: "no" }).success).toBe(false);
  });
});

describe("movimientos y cierre", () => {
  it("movimiento: monto > 0, motivo obligatorio, tipo conocido", () => {
    const ok = { tipo: "gasto", monto: 10.5, motivo: " Limpieza " };
    expect(movimientoSchema.parse(ok).motivo).toBe("Limpieza");
    expect(movimientoSchema.safeParse({ ...ok, monto: 0 }).success).toBe(false);
    expect(movimientoSchema.safeParse({ ...ok, monto: 1.005 }).success).toBe(false);
    expect(movimientoSchema.safeParse({ ...ok, motivo: "  " }).success).toBe(false);
    expect(movimientoSchema.safeParse({ ...ok, tipo: "venta" }).success).toBe(false);
  });
  it("cierre: la respuesta del servidor trae esperado, diferencia y QR", () => {
    expect(cierreSchema.safeParse({ monto_esperado: 1, diferencia: -2, total_qr: 0 }).success).toBe(
      true,
    );
    expect(cierreSchema.safeParse({ monto_esperado: 1, diferencia: -2 }).success).toBe(false);
  });
});

describe("resumen de caja", () => {
  it("exige las cifras del arqueo, también las de reservas", () => {
    const ok = {
      monto_inicial: 100,
      ventas_efectivo: 60,
      ingresos: 25,
      gastos: 7.5,
      retiros: 12,
      devoluciones_efectivo: 10,
      anticipos_efectivo: 20,
      anticipos_qr: 10,
      devoluciones_reserva_efectivo: 5,
      devoluciones_reserva_qr: 0,
      cuotas_efectivo: 8,
      cuotas_qr: 3,
      esperado: 155.5,
      qr_neto: -3,
      cantidad_ventas: 4,
      cantidad_movimientos: 3,
    };
    expect(resumenCajaSchema.safeParse(ok).success).toBe(true);
    expect(resumenCajaSchema.safeParse({ ...ok, esperado: undefined }).success).toBe(false);
    expect(resumenCajaSchema.safeParse({ ...ok, esperado: null }).success).toBe(true);
    expect(resumenCajaSchema.safeParse({ ...ok, anticipos_qr: undefined }).success).toBe(false);
    expect(resumenCajaSchema.safeParse({ ...ok, cuotas_qr: undefined }).success).toBe(false);
    expect(resumenCajaSchema.parse(ok).anticipos_efectivo).toBe(20);
    expect(resumenCajaSchema.parse(ok).cuotas_efectivo).toBe(8);
  });
});
