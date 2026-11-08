import { describe, expect, it } from "vitest";
import {
  cambioBruscoDeTipoCambio,
  costoATexto,
  costoUnico,
  errorDeFoto,
  formatearFecha,
  hrefConFiltros,
  FILTROS_VACIOS,
  listasDelNegocio,
  mensajeDeCatalogo,
  mismoMonto,
  parsearMonto,
  precioATexto,
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

describe("parsearMonto: miles y cero", () => {
  it("no adivina miles: 1.500 y 1,500 se rechazan; con 4 decimales sí", () => {
    expect(parsearMonto("1.500", 4)).toBeNull();
    expect(parsearMonto("1.500")).toBeNull();
    expect(parsearMonto("1,500", 4)).toBeNull();
    expect(parsearMonto("1.5000", 4)).toBe(1.5);
  });
  it("el cero solo vale si se admite (costos)", () => {
    expect(parsearMonto("0", 4)).toBeNull();
    expect(parsearMonto("0", 4, true)).toBe(0);
    expect(parsearMonto("0,00", 4, true)).toBe(0);
    expect(parsearMonto("-1", 4, true)).toBeNull();
  });
});

describe("precioATexto y costoATexto", () => {
  it("el precio lleva siempre 2 decimales y coma", () => {
    expect(precioATexto(12.5)).toBe("12,50");
    expect(precioATexto(40)).toBe("40,00");
    expect(precioATexto(null)).toBe("");
  });
  it("el costo lleva hasta 4 decimales, sin ceros de más", () => {
    expect(costoATexto(12.5)).toBe("12,5");
    expect(costoATexto(40)).toBe("40");
    expect(costoATexto(6.9612)).toBe("6,9612");
    expect(costoATexto(0)).toBe("0");
    expect(costoATexto(null)).toBe("");
  });
  it("ida y vuelta", () => {
    expect(parsearMonto(precioATexto(1234.56))).toBe(1234.56);
  });
});

describe("mismoMonto", () => {
  it("compara por número cuando ambos parsean", () => {
    expect(mismoMonto("12,50", "12,5")).toBe(true);
    expect(mismoMonto("12,5", "13")).toBe(false);
    expect(mismoMonto("0,00", "0")).toBe(true);
  });
  it("si alguno no parsea compara el texto: abc o 0 frente a vacío son cambio", () => {
    expect(mismoMonto("abc", "")).toBe(false);
    expect(mismoMonto("0", "")).toBe(false);
    expect(mismoMonto("abc", "abc")).toBe(true);
    expect(mismoMonto("abc", "abd")).toBe(false);
  });
});

describe("costoUnico", () => {
  it("un costo igual en todas las ubicaciones se muestra; distintos, varía", () => {
    expect(costoUnico([7.5, 7.5])).toEqual({ costo: 7.5, varia: false });
    expect(costoUnico([7.5, 9])).toEqual({ costo: null, varia: true });
    expect(costoUnico([9, 7.5])).toEqual({ costo: null, varia: true });
    expect(costoUnico([])).toEqual({ costo: null, varia: false });
  });
});

describe("cambioBruscoDeTipoCambio", () => {
  it("pide confirmar si el valor se aleja más de 20 % del vigente", () => {
    expect(cambioBruscoDeTipoCambio(6.96, 69.6)).toBe(true);
    expect(cambioBruscoDeTipoCambio(6.96, 0.696)).toBe(true);
    expect(cambioBruscoDeTipoCambio(10, 12.1)).toBe(true);
    expect(cambioBruscoDeTipoCambio(10, 12)).toBe(false);
    expect(cambioBruscoDeTipoCambio(10, 8)).toBe(false);
    expect(cambioBruscoDeTipoCambio(6.96, 6.97)).toBe(false);
  });
  it("sin tipo de cambio vigente no hay con qué comparar", () => {
    expect(cambioBruscoDeTipoCambio(null, 500)).toBe(false);
  });
});

describe("sanearBusqueda", () => {
  it("cada carácter que rompe un filtro .or() de PostgREST se vuelve el comodín *", () => {
    expect(sanearBusqueda("a,b(c)")).toBe("a*b*c");
    expect(sanearBusqueda("x.eq.1,nombre.ilike.*")).toBe("x.eq.1*nombre.ilike.");
    expect(sanearBusqueda('50%_"\\*mm')).toBe("50*mm");
  });
  it("encuentra Cable 2,5mm y AB_12", () => {
    expect(sanearBusqueda("Cable 2,5mm")).toBe("Cable 2*5mm");
    expect(sanearBusqueda("AB_12")).toBe("AB*12");
  });
  it("colapsa comodines repetidos y no deja uno en los bordes", () => {
    expect(sanearBusqueda("a,,%_b")).toBe("a*b");
    expect(sanearBusqueda("a , b")).toBe("a*b");
    expect(sanearBusqueda(",a,")).toBe("a");
  });
  it("un valor solo de caracteres peligrosos queda vacío, no se vuelve 'todo'", () => {
    for (const t of ["*", "%%%", ",", "()", '_"\\', " , * ", ":"])
      expect(sanearBusqueda(t), t).toBe("");
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
