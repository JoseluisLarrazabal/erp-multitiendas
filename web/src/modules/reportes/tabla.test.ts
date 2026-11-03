import { describe, expect, it } from "vitest";
import type { DatosReporte, FilaStockReporte, FilaVentas } from "./domain";
import { armarTabla, formatearKg, tablaKardex, textoCelda } from "./tabla";

const venta = (p: Partial<FilaVentas> = {}): FilaVentas => ({
  clave: "k",
  etiqueta: "Corte A",
  ventas: 2,
  cantidad: 3,
  kg: 1.255,
  bruto: 100,
  devuelto: 10,
  neto: 90,
  costo: 50,
  ganancia: 40,
  lineas_sin_costo: 0,
  ...p,
});
const ventas = (filas: FilaVentas[], lineasSinCosto = 0): DatosReporte => ({
  tipo: "ventas",
  filas,
  totales: { ...venta({ lineas_sin_costo: lineasSinCosto }) },
});
const base = { tipo: "tienda", agrupar: "producto", filtro: "todo", puedeVerCostos: true } as const;
const titulos = (d: DatosReporte, o: Parameters<typeof armarTabla>[1]) =>
  armarTabla(d, o).columnas.map((c) => c.titulo);

describe("armarTabla ventas", () => {
  it("costo y ganancia solo con ver_costos", () => {
    expect(titulos(ventas([venta()]), base)).toEqual(expect.arrayContaining(["Costo", "Ganancia"]));
    const sin = armarTabla(ventas([venta({ costo: null, ganancia: null })]), {
      ...base,
      puedeVerCostos: false,
    });
    expect(sin.columnas.map((c) => c.titulo)).not.toContain("Ganancia");
    expect(sin.columnas.map((c) => c.titulo)).not.toContain("Costo");
    expect(sin.filas[0]).toHaveLength(sin.columnas.length);
    expect(sin.totales).toHaveLength(sin.columnas.length);
    expect(JSON.stringify(sin)).not.toContain("40");
  });
  it("la lavandería muestra Kilos y Servicio, y nunca ganancia", () => {
    const t = armarTabla(ventas([venta()]), { ...base, tipo: "lavanderia" });
    expect(t.columnas.map((c) => c.titulo)).toEqual([
      "Servicio",
      "Ventas",
      "Cantidad",
      "Kilos",
      "Bruto",
      "Devuelto",
      "Neto",
    ]);
    expect(t.hoja).toBe("Ingresos");
  });
  it("la tienda no tiene columna de kilos; el frial se llama Corte y tiene Kg", () => {
    expect(titulos(ventas([venta()]), base)).not.toContain("Kg");
    const f = titulos(ventas([venta()]), { ...base, tipo: "frial" });
    expect(f[0]).toBe("Corte");
    expect(f).toContain("Kg");
  });
  it("más vendidos ordena por cantidad descendente", () => {
    const t = armarTabla(
      ventas([
        venta({ etiqueta: "B", cantidad: 1 }),
        venta({ etiqueta: "A", cantidad: 9 }),
        venta({ etiqueta: "C", cantidad: 5 }),
      ]),
      { ...base, esMasVendidos: true },
    );
    expect(t.filas.map((f) => f[0])).toEqual(["A", "C", "B"]);
  });
  it("más vendidos siempre muestra Producto, aunque agrupar pida otra cosa", () => {
    const t = armarTabla(ventas([venta()]), { ...base, agrupar: "vendedor", esMasVendidos: true });
    expect(t.columnas[0]).toEqual({ titulo: "Producto", tipo: "texto" });
    expect(titulos(ventas([venta()]), { ...base, agrupar: "dia", esMasVendidos: true })[0]).toBe(
      "Producto",
    );
  });
  it("avisa de las líneas sin costo solo a quien ve costos", () => {
    const d = ventas([venta()], 3);
    expect(armarTabla(d, base).avisos).toEqual([
      "3 líneas sin costo cargado: la ganancia está incompleta.",
    ]);
    expect(armarTabla(ventas([venta()], 1), base).avisos[0]).toMatch(/^1 línea sin costo/);
    expect(armarTabla(d, { ...base, puedeVerCostos: false }).avisos).toEqual([]);
    expect(armarTabla(ventas([venta()], 0), base).avisos).toEqual([]);
  });
  it("el total es la última fila de totales con 'Total' primero", () => {
    expect(armarTabla(ventas([venta()]), base).totales![0]).toBe("Total");
  });
});

const prod = (p: Partial<FilaStockReporte>): FilaStockReporte => ({
  codigo: "P1",
  nombre: "Prod",
  categoria: null,
  marca: null,
  unidad: "unidad",
  stock: 10,
  stock_minimo: null,
  stock_bajo: false,
  ultima_salida: null,
  sin_movimiento: false,
  valor: 25,
  ...p,
});
const stock = (filas: FilaStockReporte[], sinCosto: number | null = 0): DatosReporte => ({
  tipo: "stock",
  filas,
  totales: {
    productos: filas.length,
    stock_bajo: 0,
    sin_movimiento: 0,
    valor: 0,
    productos_sin_costo: sinCosto,
  },
});

describe("armarTabla stock", () => {
  const filas = [
    prod({ codigo: "A", stock_bajo: true, valor: 10 }),
    prod({ codigo: "B", sin_movimiento: true, valor: 20 }),
    prod({ codigo: "C", valor: 5 }),
  ];
  it("filtra por stock bajo y sin movimiento", () => {
    expect(armarTabla(stock(filas), { ...base, filtro: "bajo" }).filas.map((f) => f[0])).toEqual([
      "A",
    ]);
    expect(armarTabla(stock(filas), { ...base, filtro: "sin" }).filas.map((f) => f[0])).toEqual([
      "B",
    ]);
  });
  it("el valor total sale de la RPC con 'todo' y queda vacío con un filtro (no se suma en JS)", () => {
    const datos = stock(filas);
    if (datos.tipo === "stock") datos.totales.valor = 777.77;
    expect(armarTabla(datos, base).totales!.at(-1)).toBe(777.77);
    expect(armarTabla(datos, { ...base, filtro: "bajo" }).totales!.at(-1)).toBeNull();
    expect(armarTabla(datos, { ...base, filtro: "sin" }).totales!.at(-1)).toBeNull();
  });
  it("el valor solo con ver_costos", () => {
    const t = armarTabla(stock(filas), { ...base, puedeVerCostos: false });
    expect(t.columnas.map((c) => c.titulo)).not.toContain("Valor");
    expect(t.filas[0]).toHaveLength(t.columnas.length);
    expect(t.totales).toHaveLength(t.columnas.length);
  });
  it("avisa de productos sin costo solo con el filtro 'todo'", () => {
    expect(armarTabla(stock(filas, 2), base).avisos[0]).toMatch(
      /^2 productos con stock y sin costo/,
    );
    expect(armarTabla(stock(filas, 2), { ...base, filtro: "bajo" }).avisos).toEqual([]);
    expect(armarTabla(stock(filas, 2), { ...base, puedeVerCostos: false }).avisos).toEqual([]);
    expect(armarTabla(stock(filas, null), { ...base, puedeVerCostos: false }).avisos).toEqual([]);
  });
});

describe("armarTabla caja", () => {
  it("avisa de las sesiones abiertas", () => {
    const d: DatosReporte = {
      tipo: "caja",
      filas: [],
      totales: {
        sesiones: 2,
        monto_inicial: 0,
        ventas_efectivo: 0,
        ventas_qr: 0,
        ingresos: 0,
        egresos: 0,
        devoluciones_efectivo: 0,
        esperado: 0,
        contado: 0,
        diferencia: 0,
        sesiones_abiertas: 2,
      },
    };
    expect(armarTabla(d, base).avisos[0]).toMatch(/^2 sesiones abiertas/);
  });
});

describe("tablaKardex", () => {
  const mov = [
    {
      fecha: "2026-11-02T13:30:00Z",
      etiqueta: "Entrada",
      ubicacion: "Tienda",
      cantidad: 5,
      costoUnitario: 12.5,
      usuario: "Ana",
      motivo: null,
      referencia: null,
    },
  ];
  it("sin ver_costos no hay columna ni valor de costo", () => {
    const t = tablaKardex(mov, false);
    expect(t.columnas.map((c) => c.titulo)).not.toContain("Costo unitario");
    expect(t.filas[0]).toHaveLength(t.columnas.length);
    expect(t.filas[0]).not.toContain(12.5);
    expect(tablaKardex(mov, true).filas[0]).toContain(12.5);
  });
});

describe("textoCelda", () => {
  it("montos, kilos con 3 decimales, fechas y vacíos", () => {
    expect(textoCelda("monto", 75.3)).toBe("Bs 75,30");
    expect(textoCelda("kg", 1.255)).toBe("1,255");
    expect(textoCelda("kg", 1234)).toBe("1.234,000");
    expect(formatearKg(0)).toBe("0,000");
    expect(textoCelda("cantidad", 12)).toBe("12");
    expect(textoCelda("cantidad", 35.25)).toBe("35,25");
    expect(textoCelda("dia", "2026-11-02")).toBe("02/11/2026");
    expect(textoCelda("fechahora", "2026-11-02T13:30:00Z")).toBe("02/11/2026 09:30");
    expect(textoCelda("monto", null)).toBe("—");
    expect(textoCelda("costo", 12.5)).toBe("Bs 12,50");
  });
  it("un solo signo menos y nunca -0", () => {
    expect(textoCelda("monto", -5)).toBe("-Bs 5,00");
    expect(textoCelda("monto", -0.001)).toBe("Bs 0,00");
    expect(textoCelda("cantidad", -3)).toBe("-3");
    expect(textoCelda("cantidad", -1234.5)).toBe("-1.234,5");
    expect(textoCelda("cantidad", -0.0001)).toBe("0");
    expect(textoCelda("kg", -1.255)).toBe("-1,255");
    expect(textoCelda("costo", -2.5)).toBe("-Bs 2,50");
    expect(textoCelda("costo", -0.00001)).toBe("Bs 0,00");
  });
});
