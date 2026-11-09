import { describe, expect, it } from "vitest";
import type { Simulacion } from "@/modules/creditos";
import { formCreditoInicial, leerPlan, pedirSimulacion, type FormCredito } from "./credito-venta";

const activo = (f: Partial<FormCredito> = {}): FormCredito => ({
  ...formCreditoInicial,
  activo: true,
  ...f,
});

describe("pedirSimulacion (solo interpreta lo escrito)", () => {
  it("vacío deja que el servidor use la inicial mínima y el plazo por defecto", () => {
    expect(pedirSimulacion(activo(), 12_000)).toEqual({
      ok: true,
      total: 120,
      inicial: null,
      cuotas: null,
    });
  });
  it("convierte la inicial a Bs y las cuotas a entero", () => {
    expect(pedirSimulacion(activo({ inicialTexto: "59,99", cuotasTexto: "4" }), 12_000)).toEqual({
      ok: true,
      total: 120,
      inicial: 59.99,
      cuotas: 4,
    });
  });
  it("rechaza texto que no es una inicial o unas cuotas", () => {
    expect(pedirSimulacion(activo({ inicialTexto: "abc" }), 12_000).ok).toBe(false);
    expect(pedirSimulacion(activo({ inicialTexto: "0" }), 12_000).ok).toBe(false);
    expect(pedirSimulacion(activo({ cuotasTexto: "2,5" }), 12_000).ok).toBe(false);
    expect(pedirSimulacion(activo({ cuotasTexto: "0" }), 12_000).ok).toBe(false);
    expect(pedirSimulacion(activo(), 0).ok).toBe(false);
  });
});

const base: Simulacion = {
  error: null,
  minimo: 60,
  inicial: 60,
  cuotas: 3,
  financiado: 60,
  max_cuotas: 12,
  inicial_pct: 50,
  plan: [
    { numero: 1, capital: 19.51, interes: 1.5, monto: 21.01, vence_en: "2026-12-08" },
    { numero: 2, capital: 20, interes: 1.01, monto: 21.01, vence_en: "2027-01-08" },
    { numero: 3, capital: 20.49, interes: 0.51, monto: 21, vence_en: "2027-02-08" },
  ],
};

describe("leerPlan (respuesta de simular_credito)", () => {
  it("pasa el plan del servidor a centavos, sin recalcular", () => {
    const r = leerPlan(base);
    expect(r.ok && r.plan).toMatchObject({
      inicial: 6_000,
      minimo: 6_000,
      cuotas: 3,
      financiado: 6_000,
    });
    expect(r.ok && r.plan.plan.map((p) => p.fila.monto)).toEqual([2_101, 2_101, 2_100]);
    expect(r.ok && r.plan.plan.map((p) => p.vence)).toEqual([
      "2026-12-08",
      "2027-01-08",
      "2027-02-08",
    ]);
  });
  it("traduce los errores del servidor", () => {
    const baja = leerPlan({ ...base, error: "ERP_INICIAL_INSUFICIENTE", plan: [] });
    expect(!baja.ok && baja.motivo).toMatch(/mínima es Bs 60,00 \(50 % del total\)/);
    const otra = leerPlan({ ...base, error: "ERP_DATOS_INVALIDOS", plan: [] });
    expect(!otra.ok && otra.motivo).toMatch(/1 a 12/);
  });
});
