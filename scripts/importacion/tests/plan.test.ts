import { describe, expect, it } from "vitest";
import type { Campo, Celda, FilaCruda } from "../src/leer.ts";
import { construirPlan } from "../src/plan.ts";

type Datos = Partial<Record<Campo, string | number>>;

function fila(n: number, d: Datos, valores?: number): FilaCruda {
  const celda = (v: string | number | undefined): Celda =>
    typeof v === "number"
      ? { texto: String(v), esNumero: true }
      : { texto: v ?? "", esNumero: false };
  const campos: Campo[] = [
    "codigo",
    "barras",
    "nombre",
    "marca",
    "modelo",
    "categoria",
    "stock",
    "ubicacion",
  ];
  return {
    fila: n,
    celdas: Object.fromEntries(campos.map((c) => [c, celda(d[c])])) as Record<Campo, Celda>,
    valores: valores ?? Object.values(d).filter((v) => v !== undefined && v !== "").length,
  };
}

const base = (n: number, extra: Datos = {}): FilaCruda =>
  fila(n, {
    codigo: String(n),
    nombre: `Producto ${n}`,
    categoria: "Cocina",
    stock: 2,
    ubicacion: "tienda",
    ...extra,
  });

describe("construirPlan", () => {
  it("excluye ejemplos y fila suelta; cuadran las filas", () => {
    const plan = construirPlan([base(2), base(3), base(4), base(5), fila(6, { codigo: "598" })]);
    expect(plan.excluidas).toEqual([
      { fila: 2, regla: "ejemplo" },
      { fila: 3, regla: "ejemplo" },
      { fila: 6, regla: "fila_suelta" },
    ]);
    expect(plan.aceptadas.map((p) => p.fila)).toEqual([4, 5]);
    expect(plan.aceptadas.length + plan.rechazadas.length + plan.excluidas.length).toBe(
      plan.filasDeDatos,
    );
  });

  it("limpia espacios y deja marca y modelo '--' vacíos", () => {
    const plan = construirPlan([base(4, { nombre: "  Taza   roja ", marca: "--", modelo: "--" })]);
    expect(plan.aceptadas[0]).toMatchObject({ nombre: "Taza roja", marca: "", modelo: "" });
    expect(plan.corregidas.map((c) => c.regla).sort()).toEqual([
      "espacios",
      "marca_modelo_vacio",
      "marca_modelo_vacio",
    ]);
  });

  it("conserva el código interno tal cual, como texto", () => {
    const plan = construirPlan([base(4, { codigo: "0042" })]);
    expect(plan.aceptadas[0]?.codigo).toBe("0042");
  });

  it("mueve el texto de barras a modelo y lo registra como corrección", () => {
    const plan = construirPlan([base(4, { barras: "aro 20/29" })]);
    expect(plan.aceptadas[0]).toMatchObject({ barras: null, modelo: "aro 20/29" });
    expect(plan.corregidas).toContainEqual({ fila: 4, regla: "barras_a_modelo" });
  });

  it("barras repetido: conserva la primera fila, vacía las demás con aviso", () => {
    const plan = construirPlan([
      base(4, { barras: "1111" }),
      base(5, { barras: "1111" }),
      base(6, { barras: "2222" }),
    ]);
    expect(plan.aceptadas.map((p) => p.barras)).toEqual(["1111", null, "2222"]);
    expect(plan.avisos).toContainEqual({ fila: 5, regla: "barras_repetida" });
  });

  it("código interno repetido: rechaza las repetidas", () => {
    const plan = construirPlan([base(4, { codigo: "A" }), base(5, { codigo: "A", stock: 7 })]);
    expect(plan.aceptadas.map((p) => p.fila)).toEqual([4]);
    expect(plan.rechazadas).toEqual([{ fila: 5, regla: "codigo_repetido" }]);
    expect(plan.stock).toMatchObject({ fuente: 9, aceptado: 2, rechazado: 7 });
  });

  it("no une posibles duplicados: solo los lista", () => {
    const plan = construirPlan([
      base(4, { codigo: "A", nombre: "Taza", marca: "Acme" }),
      base(5, { codigo: "B", nombre: "taza", marca: "ACME" }),
      base(6, { codigo: "C", nombre: "Plato" }),
    ]);
    expect(plan.aceptadas).toHaveLength(3);
    expect(plan.posiblesDuplicados).toEqual([[4, 5]]);
  });

  it("categorías: solo las usadas, unidas sin distinguir mayúsculas, con aviso de parecidas", () => {
    const plan = construirPlan([
      base(4, { categoria: "Cocina" }),
      base(5, { categoria: " cocina " }),
      base(6, { categoria: "Cocina grande" }),
      base(7, { categoria: "" }),
    ]);
    expect(plan.categorias).toEqual(["Cocina", "Cocina grande"]);
    expect(plan.categoriasParecidas).toEqual([["Cocina", "Cocina grande"]]);
    expect(plan.aceptadas[3]?.categoria).toBeNull();
  });

  it("sin ubicación va a Tienda con aviso; reparte el stock por ubicación", () => {
    const plan = construirPlan([
      base(4, { ubicacion: "", stock: 3 }),
      base(5, { ubicacion: "deposito", stock: 5 }),
      base(6, { ubicacion: "tienda", stock: 1 }),
    ]);
    expect(plan.avisos).toContainEqual({ fila: 4, regla: "sin_ubicacion" });
    expect(plan.stock.porUbicacion).toEqual({ Tienda: 4, Depósito: 5 });
    expect(plan.stock.porDefecto).toBe(3);
  });

  it("stock: vacío es 0; decimal e inválido se rechazan", () => {
    const plan = construirPlan([
      base(4, { stock: "" }),
      base(5, { stock: "1,5" }),
      base(6, { stock: "mucho" }),
      base(7, { stock: 4 }),
    ]);
    expect(plan.aceptadas.map((p) => [p.fila, p.stock])).toEqual([
      [4, 0],
      [7, 4],
    ]);
    expect(plan.rechazadas).toEqual([
      { fila: 5, regla: "stock_decimal" },
      { fila: 6, regla: "stock_invalido" },
    ]);
    expect(plan.stock).toMatchObject({ ilegible: 1, fuente: 5.5, aceptado: 4, rechazado: 1.5 });
  });

  it("rechaza sin nombre o sin código", () => {
    const plan = construirPlan([base(4, { nombre: "" }), base(5, { codigo: "" })]);
    expect(plan.rechazadas).toEqual([
      { fila: 4, regla: "sin_nombre" },
      { fila: 5, regla: "sin_codigo" },
    ]);
  });
});
