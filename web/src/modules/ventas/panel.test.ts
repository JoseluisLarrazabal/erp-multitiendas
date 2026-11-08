import { describe, expect, it } from "vitest";
import {
  cantidadADevolver,
  ETIQUETA_MOTIVO,
  fueraDePlazo,
  mensajeDeVentas,
  textoMotivo,
  textoPorRevisar,
} from "./domain-panel";
import {
  anularSchema,
  devolverSchema,
  hrefVentas,
  leerDesdeReconciliacion,
  leerFiltrosVentas,
  pagoQrSchema,
  parsearPagosPendientes,
  revisarSchema,
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
  it("orden entregada y QR rechazado tienen mensaje propio", () => {
    expect(mensajeDeVentas("anular", "ERP_ORDEN_ENTREGADA")).toContain("devolución");
    expect(mensajeDeVentas("devolver", "ERP_QR_RECHAZADO")).toContain("rechazado");
  });
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

describe("reconciliación", () => {
  it("cada motivo de la base tiene un texto en español; uno desconocido se muestra tal cual", () => {
    expect(Object.keys(ETIQUETA_MOTIVO).sort()).toEqual([
      "caja_cerrada",
      "descuento_sin_permiso",
      "otra_cuenta",
      "producto_inactivo",
      "renumerada",
      "sin_cliente",
      "sin_precio",
      "sobre_tope",
    ]);
    expect(textoMotivo("sobre_tope")).toBe("Descuento sobre el tope");
    expect(textoMotivo("nuevo_motivo")).toBe("nuevo_motivo");
  });
  it("acciones: revisar y QR validan ids y el booleano", () => {
    expect(revisarSchema.safeParse({ ventaId: G }).success).toBe(true);
    expect(revisarSchema.safeParse({ ventaId: "x" }).success).toBe(false);
    expect(pagoQrSchema.safeParse({ pagoId: G, cobrado: false }).success).toBe(true);
    expect(pagoQrSchema.safeParse({ pagoId: G }).success).toBe(false);
  });
  it("cursor `desde` inválido se ignora y se avisa; pagos pendientes mal formados fallan", () => {
    expect(leerDesdeReconciliacion({ desde: G })).toMatchObject({ filtros: { desde: G } });
    expect(leerDesdeReconciliacion({ desde: "x" })).toMatchObject({
      filtros: { desde: "" },
      invalido: true,
    });
    expect(parsearPagosPendientes([{ id: G, monto: 10 }]).success).toBe(true);
    expect(parsearPagosPendientes([{ id: G }]).success).toBe(false);
  });
  it("mensajes de revisar y QR", () => {
    expect(mensajeDeVentas("revisar", "ERP_VENTA_ANULADA")).toBeTruthy();
    expect(mensajeDeVentas("qr", "ERP_OPERACION_REPETIDA")).toBeTruthy();
    expect(mensajeDeVentas("qr", "ERP_SIN_PERMISO")).toBeTruthy();
  });
});

describe("textoPorRevisar", () => {
  it("sin ventas no hay aviso; singular, plural y más de una página", () => {
    expect(textoPorRevisar(0, false)).toBeNull();
    expect(textoPorRevisar(1, false)).toBe("1 venta por revisar");
    expect(textoPorRevisar(3, false)).toBe("3 ventas por revisar");
    expect(textoPorRevisar(25, true)).toBe("25+ ventas por revisar");
  });
});
