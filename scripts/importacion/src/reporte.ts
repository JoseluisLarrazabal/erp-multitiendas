import { writeFileSync } from "node:fs";
import type { EstadoBase, ResultadoEscritura } from "./escribir.ts";
import type { Evento, Plan } from "./plan.ts";

export type Control = {
  control: string;
  esperado: number;
  real: number;
  ok: boolean;
  nota?: string;
};

export const contarPorRegla = (eventos: Evento[]): Record<string, number> => {
  const cuenta: Record<string, number> = {};
  for (const { regla } of eventos) cuenta[regla] = (cuenta[regla] ?? 0) + 1;
  return cuenta;
};

const control = (nombre: string, esperado: number, real: number, nota?: string): Control => ({
  control: nombre,
  esperado,
  real,
  ok: esperado === real,
  ...(nota ? { nota } : {}),
});

/** Conciliación (docs/migracion-datos.md). Sin `estado` (corrida seca) solo valen los controles sobre el plan. */
export function conciliar(plan: Plan, estado: EstadoBase | null): Control[] {
  const { stock } = plan;
  const controles = [
    control(
      "Filas de datos = aceptadas + rechazadas + excluidas",
      plan.filasDeDatos,
      plan.aceptadas.length + plan.rechazadas.length + plan.excluidas.length,
    ),
  ];
  if (!estado) return controles;
  controles.push(
    control(
      "Stock inicial en la base = fuente menos rechazado",
      stock.fuente - stock.rechazado,
      estado.importadoTotal,
      `rechazado ${stock.rechazado} unidades; ${stock.ilegible} filas con stock ilegible no suman a la fuente`,
    ),
    ...(["Tienda", "Depósito"] as const).map((u) =>
      control(`Stock inicial en ${u}`, stock.porUbicacion[u], estado.importadoPorUbicacion[u] ?? 0),
    ),
    control("Pares donde stock difiere de la suma del kardex", 0, estado.diferenciasKardex),
    control(
      "Productos auditados con usuario (debe ser null: no hay sesión)",
      0,
      estado.auditadosConUsuario,
    ),
  );
  return controles;
}

export type Reporte = {
  generado: string;
  modo: "seco" | "real";
  filas: { datos: number; aceptadas: number; rechazadas: number; excluidas: number };
  excluidasPorRegla: Record<string, number>;
  rechazadasPorMotivo: Record<string, number>;
  corregidasPorRegla: Record<string, number>;
  avisosPorTipo: Record<string, number>;
  stock: Plan["stock"];
  categoriasUsadas: number;
  categoriasParecidas: [string, string][];
  posiblesDuplicados: number[][];
  escritura: ResultadoEscritura | null;
  conciliacion: Control[];
  /** Detalle por fila (número de fila de la planilla y regla), sin valores del cliente. */
  detalle: { excluidas: Evento[]; rechazadas: Evento[]; avisos: Evento[] };
};

export function armarReporte(
  plan: Plan,
  modo: Reporte["modo"],
  escritura: ResultadoEscritura | null,
  estado: EstadoBase | null,
): Reporte {
  return {
    generado: new Date().toISOString(),
    modo,
    filas: {
      datos: plan.filasDeDatos,
      aceptadas: plan.aceptadas.length,
      rechazadas: plan.rechazadas.length,
      excluidas: plan.excluidas.length,
    },
    excluidasPorRegla: contarPorRegla(plan.excluidas),
    rechazadasPorMotivo: contarPorRegla(plan.rechazadas),
    corregidasPorRegla: contarPorRegla(plan.corregidas),
    avisosPorTipo: contarPorRegla(plan.avisos),
    stock: plan.stock,
    categoriasUsadas: plan.categorias.length,
    categoriasParecidas: plan.categoriasParecidas,
    posiblesDuplicados: plan.posiblesDuplicados,
    escritura,
    conciliacion: conciliar(plan, estado),
    detalle: { excluidas: plan.excluidas, rechazadas: plan.rechazadas, avisos: plan.avisos },
  };
}

// Mode 0600: el reporte lista filas del cliente. Va fuera del repo (o en un nombre que .gitignore excluye).
export const escribirReporte = (ruta: string, reporte: Reporte): void =>
  writeFileSync(ruta, JSON.stringify(reporte, null, 2), { mode: 0o600 });

/** Solo conteos: nada de nombres, códigos ni marcas. */
export function resumenConsola(r: Reporte): string[] {
  const lineas = [
    `Modo: ${r.modo}`,
    `Filas de datos: ${r.filas.datos} (aceptadas ${r.filas.aceptadas}, rechazadas ${r.filas.rechazadas}, excluidas ${r.filas.excluidas})`,
    `Excluidas por regla: ${JSON.stringify(r.excluidasPorRegla)}`,
    `Rechazadas por motivo: ${JSON.stringify(r.rechazadasPorMotivo)}`,
    `Corregidas por regla: ${JSON.stringify(r.corregidasPorRegla)}`,
    `Avisos por tipo: ${JSON.stringify(r.avisosPorTipo)}`,
    `Categorías usadas: ${r.categoriasUsadas}; parecidas: ${r.categoriasParecidas.length}; grupos de posibles duplicados: ${r.posiblesDuplicados.length}`,
    `Stock: fuente ${r.stock.fuente}, aceptado ${r.stock.aceptado}, rechazado ${r.stock.rechazado} (Tienda ${r.stock.porUbicacion.Tienda}, Depósito ${r.stock.porUbicacion.Depósito}, por defecto a Tienda ${r.stock.porDefecto})`,
  ];
  if (r.escritura) lineas.push(`Escritura: ${JSON.stringify(r.escritura)}`);
  for (const c of r.conciliacion) {
    lineas.push(
      `${c.ok ? "OK " : "DIF"} ${c.control}: esperado ${c.esperado}, real ${c.real}${c.nota ? ` (${c.nota})` : ""}`,
    );
  }
  return lineas;
}
