import { describe, expect, it } from "vitest";
import {
  brutoLinea,
  buscar,
  calcularCobro,
  calcularTotales,
  crearIndice,
  descontarStock,
  formatearCantidad,
  formatearNumero,
  motivoNoVendible,
  secuenciaAgotada,
  siguienteSecuencia,
  parsearCantidad,
  parsearMonto,
  pisoUnitario,
  porCodigoExacto,
  type ProductoPos,
} from "./domain";

const linea = (cantidadMilesimas: number, precio: number, descuento = 0, piso = precio) => ({
  cantidadMilesimas,
  precio,
  descuento,
  pisoUnitario: piso,
});

describe("brutoLinea", () => {
  it("redondea .005 hacia arriba como round() de Postgres", () => {
    expect(brutoLinea(500, 1)).toBe(1); // 0,5 x 0,01 = 0,005 -> 0,01
    expect(brutoLinea(1500, 1)).toBe(2); // 0,015 -> 0,02
    expect(brutoLinea(499, 1)).toBe(0);
  });
  it("kg con 3 decimales", () => {
    expect(brutoLinea(1255, 1000)).toBe(1255); // 1,255 kg x 10,00
    expect(brutoLinea(333, 333)).toBe(111); // 0,333 x 3,33 = 1,10889
    expect(brutoLinea(2345, 4567)).toBe(10710); // 2,345 x 45,67 = 107,09615
  });
});

describe("calcularTotales", () => {
  it("total = suma de líneas - descuento de la venta", () => {
    const t = calcularTotales([linea(2000, 1050), linea(1000, 333, 100)], 50, 0);
    expect(t.subtotal).toBe(2100 + 333);
    expect(t.sumaLineas).toBe(2100 + 333 - 100);
    expect(t.total).toBe(2100 + 333 - 100 - 50);
    expect(t.pideDescuento).toBe(true);
  });
  it("sin descuento ni precio bajo piso no pide permiso", () => {
    const t = calcularTotales([linea(1000, 4000, 0, 3200)], 0, 0);
    expect(t.pideDescuento).toBe(false);
    expect(t.excedeTope).toBe(false);
  });
  it("precio bajo el piso cuenta como descuento y como base del tope", () => {
    // piso 100,00 y se vende a 90,00: brecha 10,00 sobre base 100,00 = 10 %.
    const bajo = calcularTotales([linea(1000, 9000, 0, 10000)], 0, 10);
    expect(bajo.pideDescuento).toBe(true);
    expect(bajo.descuentoTotal).toBe(1000);
    expect(bajo.base).toBe(10000);
    expect(bajo.excedeTope).toBe(false);
    expect(calcularTotales([linea(1000, 9000, 0, 10000)], 0, 9.99).excedeTope).toBe(true);
  });
  it("con tope 0 cualquier descuento lo excede", () => {
    expect(calcularTotales([linea(1000, 1000, 1)], 0, 0).excedeTope).toBe(true);
    expect(calcularTotales([linea(1000, 1000)], 0, 0).excedeTope).toBe(false);
  });
});

describe("pisoUnitario", () => {
  it("es el menor entre mínimo y lista; sin mínimo, la lista", () => {
    expect(pisoUnitario(8000, 10000)).toBe(8000);
    expect(pisoUnitario(12000, 10000)).toBe(10000);
    expect(pisoUnitario(null, 10000)).toBe(10000);
  });
});

describe("entradas de usuario", () => {
  it("parsearMonto acepta coma o punto y hasta 2 decimales", () => {
    expect(parsearMonto("12")).toBe(1200);
    expect(parsearMonto("12,5")).toBe(1250);
    expect(parsearMonto("12.05")).toBe(1205);
    expect(parsearMonto("12.505")).toBeNull();
    expect(parsearMonto("")).toBeNull();
    expect(parsearMonto("-1")).toBeNull();
  });
  it("cantidad entera en unidad, 3 decimales en kg", () => {
    expect(parsearCantidad("3", "unidad")).toBe(3000);
    expect(parsearCantidad("1,5", "unidad")).toBeNull();
    expect(parsearCantidad("1,255", "kg")).toBe(1255);
    expect(parsearCantidad("1,2555", "kg")).toBeNull();
    expect(parsearCantidad("0", "kg")).toBeNull();
    expect(formatearCantidad(1255)).toBe("1,255");
    expect(formatearCantidad(2000)).toBe("2");
    expect(formatearCantidad(-1500)).toBe("-1,5");
    expect(formatearCantidad(-500)).toBe("-0,5");
    expect(formatearCantidad(-3000)).toBe("-3");
    expect(formatearCantidad(0)).toBe("0");
  });
});

describe("calcularCobro", () => {
  it("efectivo con vuelto", () => {
    expect(calcularCobro(8000, 0, 10000, false)).toEqual({
      ok: true,
      efectivo: 8000,
      qr: 0,
      vuelto: 2000,
    });
  });
  it("mixto: el efectivo aplicado es el saldo tras el QR", () => {
    expect(calcularCobro(8000, 3000, 5000, true)).toEqual({
      ok: true,
      efectivo: 5000,
      qr: 3000,
      vuelto: 0,
    });
  });
  it("QR sin confirmar, QR mayor al total o efectivo corto no cobran", () => {
    expect(calcularCobro(8000, 3000, 5000, false).ok).toBe(false);
    expect(calcularCobro(8000, 9000, 0, true).ok).toBe(false);
    expect(calcularCobro(8000, 0, 7999, false).ok).toBe(false);
  });
  it("todo QR confirmado cobra sin efectivo", () => {
    expect(calcularCobro(8000, 8000, 0, true)).toEqual({
      ok: true,
      efectivo: 0,
      qr: 8000,
      vuelto: 0,
    });
  });
});

describe("numeración", () => {
  it("formatea prefijo-000123", () => {
    expect(formatearNumero("C1", 123)).toBe("C1-000123");
  });
});

const prod = (
  id: string,
  codigo: string,
  nombre: string,
  barras: string | null = null,
): ProductoPos => ({
  id,
  codigo,
  codigoBarras: barras,
  nombre,
  unidad: "unidad",
  tipo: "producto",
  controlaSerie: false,
  garantiaMeses: null,
  precios: {
    contado: 1000,
    credito: null,
    mayorista: null,
    minimo: null,
    normal: null,
    express: null,
  },
  stockPorUbicacion: {},
  stockTotal: 0,
});

describe("siguienteSecuencia", () => {
  it("sigue al mayor contador visto, no al de montaje", () => {
    expect(siguienteSecuencia(5, 9)).toBe(10); // otra pestaña avanzó el local
    expect(siguienteSecuencia(12, 9)).toBe(13);
    expect(siguienteSecuencia(0, 0)).toBe(1);
    expect(siguienteSecuencia(7, 7, 20)).toBe(21); // tras un duplicado
  });
});

describe("secuenciaAgotada", () => {
  it("el sexto dígito es el tope", () => {
    expect(secuenciaAgotada(999_999)).toBe(false);
    expect(secuenciaAgotada(1_000_000)).toBe(true);
  });
});

describe("motivoNoVendible", () => {
  const servicio = { ...prod("s", "SRV-1", "Lavado"), tipo: "servicio" };
  it("un servicio solo se vende en lavandería", () => {
    expect(motivoNoVendible(servicio, "tienda")).toMatch(/lavandería/);
    // La lavandería vende por lista normal o express, no a contado.
    const lavado = { ...servicio, precios: { ...servicio.precios, normal: 15, express: null } };
    expect(motivoNoVendible(lavado, "lavanderia")).toBeNull();
    expect(motivoNoVendible(lavado, "lavanderia", "express")).toMatch(/exprés/);
    expect(
      motivoNoVendible({ ...lavado, precios: { ...lavado.precios, normal: null } }, "lavanderia"),
    ).toMatch(/normal/);
  });
  it("en lavandería solo se venden servicios", () => {
    expect(motivoNoVendible(prod("p", "P-1", "Cable"), "lavanderia")).toMatch(/servicios/);
  });
  it("un producto sin precio de contado no se vende en ningún negocio", () => {
    const sinPrecio = {
      ...prod("p", "P-1", "Cable"),
      precios: { ...servicio.precios, contado: null },
    };
    expect(motivoNoVendible(sinPrecio, "tienda")).toMatch(/precio/);
    expect(motivoNoVendible(prod("p", "P-1", "Cable"), "tienda")).toBeNull();
  });
});

describe("búsqueda", () => {
  const indice = crearIndice(
    [
      prod("1", "CEL-001", "Celular Demo", "7770000000011"),
      prod("2", "ACC-001", "Funda Cámara"),
      prod("3", "ACC-002", "Cargador"),
    ],
    new Map([["3", "Marca Y"]]),
  );
  it("busca por código, nombre, marca y barras, sin tildes ni mayúsculas", () => {
    expect(buscar(indice, "camara").map((p) => p.id)).toEqual(["2"]);
    expect(buscar(indice, "marca y").map((p) => p.id)).toEqual(["3"]);
    expect(buscar(indice, "acc-00").length).toBe(2);
    expect(buscar(indice, "cel zzz")).toEqual([]);
    expect(buscar(indice, "")).toEqual([]);
  });
  it("código exacto por código o barras", () => {
    expect(porCodigoExacto(indice, "cel-001")?.id).toBe("1");
    expect(porCodigoExacto(indice, "7770000000011")?.id).toBe("1");
    expect(porCodigoExacto(indice, "CEL")).toBeNull();
  });
  it("2.000 productos buscan en menos de 200 ms", () => {
    const grande = crearIndice(
      Array.from({ length: 2000 }, (_, i) => prod(String(i), `P-${i}`, `Producto ${i} lote`)),
      new Map(),
    );
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) buscar(grande, "producto 19");
    expect((performance.now() - t0) / 100).toBeLessThan(200);
  });
});

describe("descontarStock", () => {
  const p = (id: string, aqui: number, otra: number) =>
    ({
      id,
      stockPorUbicacion: { u1: aqui, u2: otra },
      stockTotal: aqui + otra,
    }) as unknown as import("./domain").ProductoPos;
  it("resta en la ubicación del equipo, suma líneas repetidas y rehace el total", () => {
    const a = p("a", 5, 2);
    const b = p("b", 1, 0);
    const r = descontarStock([a, b], "u1", [
      { producto_id: "a", cantidad: 1 },
      { producto_id: "a", cantidad: 1.5 },
    ]);
    expect(r[0]).toMatchObject({ stockPorUbicacion: { u1: 2.5, u2: 2 }, stockTotal: 4.5 });
    expect(r[1]).toBe(b);
  });
  it("deja negativo el stock agotado (RN-04)", () => {
    const r = descontarStock([p("a", 1, 0)], "u1", [{ producto_id: "a", cantidad: 3 }]);
    expect(r[0]?.stockPorUbicacion.u1).toBe(-2);
  });
});
