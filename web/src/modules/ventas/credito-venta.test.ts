import { describe, expect, it } from "vitest";
import type { Parametros } from "@/modules/creditos";
import { armarCredito, formCreditoInicial, type FormCredito } from "./credito-venta";

const parametros: Parametros = {
  inicialPct: 50,
  plazoCuotas: 3,
  maxCuotas: 12,
  interesMensualPct: 2.5,
};
const activo = (f: Partial<FormCredito> = {}): FormCredito => ({
  ...formCreditoInicial,
  activo: true,
  ...f,
});
const base = { parametros, total: 12_000, hayCliente: true, hoy: "2026-11-08" };

describe("armarCredito", () => {
  it("sin texto usa la inicial mínima y el plazo del negocio", () => {
    const r = armarCredito({ ...base, form: activo() });
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
  it("rechaza una inicial bajo el mínimo, igual o sobre el total", () => {
    const motivo = (inicialTexto: string) => {
      const r = armarCredito({ ...base, form: activo({ inicialTexto }) });
      return r.ok ? "ok" : r.motivo;
    };
    expect(motivo("59,99")).toMatch(/mínima es Bs 60,00/);
    expect(motivo("120")).toMatch(/menor al total/);
    expect(motivo("abc")).toMatch(/inválida/);
    expect(motivo("60")).toBe("ok");
    expect(motivo("119")).toBe("ok");
    expect(motivo("119,99")).toMatch(/muy chico/);
  });
  it("redondea el mínimo hacia arriba como el servidor", () => {
    const r = armarCredito({ ...base, total: 3_333, form: activo() });
    expect(r.ok && r.plan.minimo).toBe(1_667);
  });
  it("valida las cuotas contra el máximo del negocio", () => {
    const motivo = (cuotasTexto: string) => {
      const r = armarCredito({ ...base, form: activo({ cuotasTexto }) });
      return r.ok ? "ok" : r.motivo;
    };
    expect(motivo("13")).toMatch(/1 a 12/);
    expect(motivo("0")).toMatch(/1 a 12/);
    expect(motivo("2,5")).toMatch(/1 a 12/);
    expect(motivo("12")).toBe("ok");
  });
  it("exige cliente y parámetros cargados", () => {
    const sin = armarCredito({ ...base, hayCliente: false, form: activo() });
    expect(!sin.ok && sin.motivo).toMatch(/cliente/);
    const cargando = armarCredito({ ...base, parametros: null, form: activo() });
    expect(!cargando.ok && cargando.motivo).toMatch(/Cargando/);
  });
});
