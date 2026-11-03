import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { EstadoBase } from "../src/escribir.ts";
import type { Celda, Campo, FilaCruda } from "../src/leer.ts";
import { construirPlan } from "../src/plan.ts";
import { armarReporte, conciliar, escribirReporte, rutaDentroDeRepo } from "../src/reporte.ts";

const dir = mkdtempSync(join(tmpdir(), "reporte-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const celda = (texto: string): Celda => ({ texto, esNumero: false });
const fila = (n: number, stock: string): FilaCruda => ({
  fila: n,
  celdas: Object.fromEntries(
    (["codigo", "barras", "nombre", "marca", "modelo", "categoria", "stock", "ubicacion"] as Campo[]).map(
      (c) => [c, celda(c === "codigo" ? String(n) : c === "nombre" ? `P${n}` : c === "stock" ? stock : "")],
    ),
  ) as Record<Campo, Celda>,
  valores: 3,
});
const plan = construirPlan([fila(4, "5"), fila(5, "x")]);
const estado = (importadoTotal: number): EstadoBase => ({
  importadoPorUbicacion: { Tienda: importadoTotal, Depósito: 0 },
  importadoTotal,
  diferenciasKardex: 0,
  productosAuditados: 1,
  auditadosConUsuario: 0,
  fotosAsignadas: 0,
});

describe("conciliar", () => {
  it("--esperadas: aceptadas + rechazadas debe ser n", () => {
    expect(conciliar(plan, null, 2).every((c) => c.ok)).toBe(true);
    expect(conciliar(plan, null, 3).filter((c) => !c.ok)).toHaveLength(1);
    expect(conciliar(plan, null).length).toBe(1);
  });
  it("el stock importado se compara con el aceptado", () => {
    expect(conciliar(plan, estado(5), 2).every((c) => c.ok)).toBe(true);
    expect(conciliar(plan, estado(7)).filter((c) => !c.ok).map((c) => c.control)).toContain(
      "Stock inicial de este archivo en la base = stock aceptado",
    );
  });
  it("concilia las fotos: anclas contra su desenlace y asociadas contra la base", () => {
    const asociada = { fila: 4, codigo: "5", imagen: 1, tipo: { mime: "image/jpeg", ext: "jpg" } } as const;
    const fotos = { anclas: 2, asociadas: [asociada], avisos: [{ fila: 9, regla: "foto_fila_excluida" }], rechazadas: [] };
    expect(conciliar(plan, null, undefined, fotos).every((c) => c.ok)).toBe(true);
    expect(conciliar(plan, null, undefined, { ...fotos, anclas: 3 }).filter((c) => !c.ok)).toHaveLength(1);
    expect(conciliar(plan, { ...estado(5), fotosAsignadas: 1 }, undefined, fotos).every((c) => c.ok)).toBe(true);
    expect(conciliar(plan, { ...estado(5), fotosAsignadas: 0 }, undefined, fotos).filter((c) => !c.ok)).toHaveLength(1);
  });
  it("el reporte lista excluidas y rechazadas con número de fila y motivo", () => {
    expect(armarReporte(plan, "seco", null, null).detalle.rechazadas).toEqual([
      { fila: 5, regla: "stock_invalido" },
    ]);
  });
});

describe("reporte en disco", () => {
  it("rutaDentroDeRepo sube buscando .git, también si la carpeta aún no existe", () => {
    mkdirSync(join(dir, "repo", ".git"), { recursive: true });
    mkdirSync(join(dir, "repo", "sub"));
    mkdirSync(join(dir, "fuera"));
    expect(rutaDentroDeRepo(join(dir, "repo", "sub", "r.json"))).toBe(true);
    expect(rutaDentroDeRepo(join(dir, "repo", "nueva", "r.json"))).toBe(true);
    expect(rutaDentroDeRepo(join(dir, "fuera", "r.json"))).toBe(false);
  });
  it("escribe con modo 0600 aunque el archivo ya existiera", () => {
    const ruta = join(dir, "fuera", "previo.json");
    writeFileSync(ruta, "{}", { mode: 0o644 });
    escribirReporte(ruta, armarReporte(plan, "seco", null, null));
    expect(statSync(ruta).mode & 0o777).toBe(0o600);
  });
});
