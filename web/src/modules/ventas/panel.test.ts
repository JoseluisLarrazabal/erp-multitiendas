import { describe, expect, it } from "vitest";
import { cantidadADevolver, fueraDePlazo, mensajeDeVentas } from "./domain-panel";
import {
  anularSchema,
  devolverSchema,
  hrefVentas,
  leerFiltrosVentas,
  topeSchema,
} from "./schemas-panel";

const G = "a0000000-0000-0000-0000-000000000001";

describe("fueraDePlazo (RN-08)", () => {
  const venta = "2026-11-01T12:00:00Z";
  it("hasta 24 h exactas sigue dentro; después, fuera", () => {
    expect(fueraDePlazo(venta, Date.parse("2026-11-02T12:00:00Z"))).toBe(false);
    expect(fueraDePlazo(venta, Date.parse("2026-11-02T12:00:01Z"))).toBe(true);
  });
});

describe("cantidadADevolver", () => {
  it("entera en unidad, decimales en kg, nunca más de lo que queda", () => {
    expect(cantidadADevolver("2", "unidad", 3000)).toBe(2);
    expect(cantidadADevolver("2,5", "unidad", 3000)).toBeNull();
    expect(cantidadADevolver("4", "unidad", 3000)).toBeNull();
    expect(cantidadADevolver("1,25", "kg", 2000)).toBe(1.25);
    expect(cantidadADevolver("0", "kg", 2000)).toBeNull();
    expect(cantidadADevolver("", "unidad", 3000)).toBeNull();
  });
});

describe("mensajeDeVentas", () => {
  it("cubre los códigos de cada acción", () => {
    for (const c of [
      "ERP_SIN_PERMISO",
      "ERP_DATOS_INVALIDOS",
      "ERP_OPERACION_REPETIDA",
      "ERP_CAJA_CERRADA",
      "ERP_EFECTIVO_INSUFICIENTE",
      "ERP_VENTA_CON_DEVOLUCIONES",
    ])
      expect(mensajeDeVentas("anular", c)).toBeTruthy();
    for (const c of ["ERP_DATOS_INVALIDOS", "ERP_EFECTIVO_INSUFICIENTE", "ERP_VENTA_ANULADA"])
      expect(mensajeDeVentas("devolver", c)).toBeTruthy();
    expect(mensajeDeVentas("anular", "ERP_OTRO")).toBeUndefined();
    expect(mensajeDeVentas("anular", "ERP_CLIENTE_DUPLICADO")).toBeUndefined();
  });
  it("mensajes por acción: tope y sin elegir caja al anular", () => {
    expect(mensajeDeVentas("tope", "ERP_DATOS_INVALIDOS")).toContain("entre 0 y 100");
    expect(mensajeDeVentas("anular", "ERP_EFECTIVO_INSUFICIENTE")).not.toContain("otra caja");
    expect(mensajeDeVentas("devolver", "ERP_EFECTIVO_INSUFICIENTE")).toContain("otra caja");
  });
});

describe("schemas del panel de ventas", () => {
  it("filtros: lo inválido cae al valor por defecto y se avisa", () => {
    const r = leerFiltrosVentas({
      estado: "x",
      desde: "2026-02-31",
      hasta: "2026-11-01",
      pagina: "-3",
    });
    expect(r.filtros).toMatchObject({ estado: "", desde: "", hasta: "2026-11-01", pagina: 1 });
    expect(r.invalido).toBe(true);
    expect(leerFiltrosVentas({ q: " C1-1 ", estado: "anulada" })).toMatchObject({
      filtros: { q: "C1-1", estado: "anulada" },
      invalido: false,
    });
    expect(leerFiltrosVentas({ q: "x".repeat(21) }).invalido).toBe(true);
  });
  it("anular exige motivo", () => {
    expect(anularSchema.safeParse({ ventaId: G, motivo: "  " }).success).toBe(false);
    expect(anularSchema.safeParse({ ventaId: G, motivo: "Error de cobro" }).success).toBe(true);
  });
  it("devolver exige al menos una línea con cantidad positiva y medio conocido", () => {
    const base = { id: G, ventaId: G, dispositivoId: G, cajaSesionId: G, medio: "qr", motivo: "x" };
    expect(devolverSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(
      devolverSchema.safeParse({ ...base, items: [{ ventaItemId: G, cantidad: 0 }] }).success,
    ).toBe(false);
    expect(
      devolverSchema.safeParse({ ...base, items: [{ ventaItemId: G, cantidad: 1.5 }] }).success,
    ).toBe(true);
    expect(
      devolverSchema.safeParse({
        ...base,
        medio: "tarjeta",
        items: [{ ventaItemId: G, cantidad: 1 }],
      }).success,
    ).toBe(false);
  });
  it("tope: 0 a 100 con 2 decimales, coma o punto", () => {
    const t = (v: string) => topeSchema.safeParse({ negocioId: G, tope: v });
    expect(t("12,5").success && t("12,5").data?.tope).toBe(12.5);
    expect(t("0").success).toBe(true);
    expect(t("100").success).toBe(true);
    expect(t("100,01").success).toBe(false);
    expect(t("5,555").success).toBe(false);
    expect(t("-1").success).toBe(false);
    expect(t("").success).toBe(false);
  });
  it("hrefVentas omite lo vacío", () => {
    expect(hrefVentas({ q: "", estado: "anulada", pagina: 1 })).toBe(
      "/panel/ventas?estado=anulada",
    );
    expect(hrefVentas({ pagina: 2 })).toBe("/panel/ventas?pagina=2");
  });
});
