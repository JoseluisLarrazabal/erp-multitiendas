import { describe, expect, it } from "vitest";
import { reportesDe } from "./domain";

describe("criterio de los reportes", () => {
  it("ventas, ingresos, más vendidos y caja explican qué cuentan, en todo tipo de negocio", () => {
    for (const tipo of ["tienda", "lavanderia", "frial"]) {
      for (const def of reportesDe(tipo, true)) {
        if (def.id === "stock" || def.id === "insumos") continue;
        expect(def.criterio, `${tipo}/${def.id}`).toMatch(/\S/);
      }
    }
  });

  it("las ventas dicen cómo cuentan crédito, reservas, sin conexión y devoluciones", () => {
    const ventas = reportesDe("tienda", false).find((d) => d.id === "ventas")!;
    expect(ventas.criterio).toContain("una venta hecha sin conexión cuenta el día en que se envió");
    expect(ventas.criterio).toContain("crédito entra entera");
    expect(ventas.criterio).toContain("los anticipos y las cuotas no entran aquí sino en Caja");
  });

  it("la lavandería no menciona créditos, reservas ni cuotas", () => {
    for (const def of reportesDe("lavanderia", true)) {
      expect(def.criterio ?? "", def.id).not.toMatch(/crédito|reserva|cuota|anticipo/i);
    }
    const ingresos = reportesDe("lavanderia", false).find((d) => d.id === "ingresos")!;
    expect(ingresos.criterio).toContain("La orden se cobra al recibirla");
  });

  it("la caja dice dónde se ve lo que llegó después del cierre", () => {
    for (const tipo of ["tienda", "frial", "lavanderia"]) {
      const caja = reportesDe(tipo, false).find((d) => d.id === "caja")!;
      expect(caja.criterio).toContain("lo que llegó después se ve en el detalle de esa caja");
    }
  });
});
