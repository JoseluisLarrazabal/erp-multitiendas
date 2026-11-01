import { describe, expect, it } from "vitest";
import {
  errorDeFoto,
  formatearFecha,
  hrefConFiltros,
  FILTROS_VACIOS,
  listasDelNegocio,
  mensajeDeCatalogo,
  montoATexto,
  parsearMonto,
  rutaDeFoto,
  sanearBusqueda,
  tiposDeProducto,
} from "./domain";

describe("parsearMonto", () => {
  it("acepta coma o punto, hasta 2 decimales", () => {
    expect(parsearMonto("1234,5")).toBe(1234.5);
    expect(parsearMonto("1234.50")).toBe(1234.5);
    expect(parsearMonto(" 7 ")).toBe(7);
  });
  it("rechaza vacío, cero, negativos, miles, 3 decimales y basura", () => {
    for (const t of ["", "0", "0,00", "-1", "1.234,50", "1,234", "abc", "1e3", "1,", ",5", "NaN"]) {
      expect(parsearMonto(t), t).toBeNull();
    }
  });
  it("admite más decimales cuando se pide (costo, tipo de cambio)", () => {
    expect(parsearMonto("6,9612", 4)).toBe(6.9612);
    expect(parsearMonto("6,96123", 4)).toBeNull();
  });
});

describe("montoATexto", () => {
  it("usa coma y no deja ceros de sobra", () => {
    expect(montoATexto(12.5)).toBe("12,5");
    expect(montoATexto(40)).toBe("40");
    expect(montoATexto(null)).toBe("");
  });
  it("ida y vuelta", () => {
    expect(parsearMonto(montoATexto(1234.56))).toBe(1234.56);
  });
});

describe("sanearBusqueda", () => {
  it("quita lo que rompe o altera un filtro .or() de PostgREST", () => {
    expect(sanearBusqueda("a,b(c)")).toBe("a b c");
    expect(sanearBusqueda("x.eq.1,nombre.ilike.*")).toBe("x.eq.1 nombre.ilike.");
    expect(sanearBusqueda('50%_"\\*')).toBe("50");
  });
  it("recorta y limita el largo", () => {
    expect(sanearBusqueda("   hola   mundo  ")).toBe("hola mundo");
    expect(sanearBusqueda("a".repeat(200))).toHaveLength(80);
  });
  it("un código de barras pasa intacto", () => {
    expect(sanearBusqueda("7770000000011")).toBe("7770000000011");
  });
});

describe("listas y tipos por negocio", () => {
  it("tienda y frial: 4 listas; lavandería: 2", () => {
    expect(listasDelNegocio("tienda")).toEqual(["contado", "credito", "mayorista", "minimo"]);
    expect(listasDelNegocio("frial")).toEqual(listasDelNegocio("tienda"));
    expect(listasDelNegocio("lavanderia")).toEqual(["normal", "express"]);
  });
  it("tipos de producto", () => {
    expect(tiposDeProducto("tienda")).toEqual(["producto"]);
    expect(tiposDeProducto("lavanderia")).toEqual(["servicio", "insumo"]);
  });
});

describe("foto", () => {
  it("valida tipo y tamaño", () => {
    expect(errorDeFoto({ type: "image/svg+xml", size: 10 })).toMatch(/JPG, PNG o WebP/);
    expect(errorDeFoto({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
    expect(errorDeFoto({ type: "image/webp", size: 1000 })).toBeNull();
  });
  it("ruta <negocio>/<producto>.<ext>", () => {
    expect(rutaDeFoto("n", "p", "image/jpeg")).toBe("n/p.jpg");
    expect(rutaDeFoto("n", "p", "image/png")).toBe("n/p.png");
  });
});

describe("mensajes", () => {
  it("traduce los códigos nuevos y deja pasar los de otros módulos", () => {
    for (const c of [
      "ERP_CATEGORIA_DUPLICADA",
      "ERP_CODIGO_DUPLICADO",
      "ERP_CODIGO_BARRAS_DUPLICADO",
      "ERP_LOTE_GRANDE",
      "ERP_MONEDA_MIXTA",
      "ERP_PRODUCTO_CON_MOVIMIENTOS",
    ]) {
      expect(mensajeDeCatalogo(c), c).toBeTruthy();
    }
    expect(mensajeDeCatalogo("ERP_SIN_PERMISO")).toBeUndefined();
  });
});

describe("hrefConFiltros y fecha", () => {
  it("omite los valores por defecto", () => {
    expect(hrefConFiltros("/panel/productos", FILTROS_VACIOS)).toBe("/panel/productos");
    expect(
      hrefConFiltros("/x", { ...FILTROS_VACIOS, q: "a b", sinPrecio: true }, { pagina: 3 }),
    ).toBe("/x?q=a+b&sinPrecio=1&pagina=3");
  });
  it("fecha dd/mm/aaaa en hora de Bolivia", () => {
    expect(formatearFecha("2026-11-01T02:30:00Z")).toBe("31/10/2026 22:30");
  });
});
