import { chmodSync, existsSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { EstadoBase, ResultadoEscritura } from "./escribir.ts";
import type { PlanFotos, ResultadoFotos } from "./fotos.ts";
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
export function conciliar(
  plan: Plan,
  estado: EstadoBase | null,
  esperadas?: number,
  fotos?: PlanFotos,
): Control[] {
  const { stock } = plan;
  const controles = [
    control(
      "Filas de datos = aceptadas + rechazadas + excluidas",
      plan.filasDeDatos,
      plan.aceptadas.length + plan.rechazadas.length + plan.excluidas.length,
    ),
  ];
  if (esperadas !== undefined) {
    controles.push(
      control(
        "Aceptadas + rechazadas = filas esperadas (--esperadas)",
        esperadas,
        plan.aceptadas.length + plan.rechazadas.length,
      ),
    );
  }
  if (fotos) {
    controles.push(
      control(
        "Anclas de fotos = asociadas + rechazadas + avisos",
        fotos.anclas,
        fotos.asociadas.length + fotos.rechazadas.length + fotos.avisos.length,
      ),
    );
  }
  if (!estado) return controles;
  if (fotos) {
    controles.push(
      control("Fotos asociadas en la base = asociadas por el plan", fotos.asociadas.length, estado.fotosAsignadas),
    );
  }
  controles.push(
    control(
      "Stock inicial de este archivo en la base = stock aceptado",
      stock.aceptado,
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

export type ReporteFotos = {
  anclas: number;
  asociadas: number;
  avisosPorTipo: Record<string, number>;
  rechazadasPorMotivo: Record<string, number>;
  escritura: ResultadoFotos | null;
  /** Solo número de fila y regla. */
  detalle: { avisos: Evento[]; rechazadas: Evento[] };
};

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
  fotos: ReporteFotos | null;
  conciliacion: Control[];
  /** Detalle por fila (número de fila de la planilla y regla), sin valores del cliente. */
  detalle: { excluidas: Evento[]; rechazadas: Evento[]; avisos: Evento[] };
};

export function armarReporte(
  plan: Plan,
  modo: Reporte["modo"],
  escritura: ResultadoEscritura | null,
  estado: EstadoBase | null,
  esperadas?: number,
  fotos?: { plan: PlanFotos; escritura: ResultadoFotos | null },
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
    fotos: fotos
      ? {
          anclas: fotos.plan.anclas,
          asociadas: fotos.plan.asociadas.length,
          avisosPorTipo: contarPorRegla(fotos.plan.avisos),
          rechazadasPorMotivo: contarPorRegla(fotos.plan.rechazadas),
          escritura: fotos.escritura,
          detalle: { avisos: fotos.plan.avisos, rechazadas: fotos.plan.rechazadas },
        }
      : null,
    conciliacion: conciliar(plan, estado, esperadas, fotos?.plan),
    detalle: { excluidas: plan.excluidas, rechazadas: plan.rechazadas, avisos: plan.avisos },
  };
}

/** ¿La ruta queda dentro de algún repo git? Sube desde su carpeta (o la más cercana que exista) buscando `.git`. */
export function rutaDentroDeRepo(ruta: string): boolean {
  let dir = dirname(resolve(ruta));
  while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
  for (dir = realpathSync(dir); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

// Modo 0600: el reporte lista filas del cliente. Va fuera del repo (cli lo exige); el chmod cubre un archivo previo.
export function escribirReporte(ruta: string, reporte: Reporte): void {
  writeFileSync(ruta, JSON.stringify(reporte, null, 2), { mode: 0o600 });
  chmodSync(ruta, 0o600);
}

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
  if (r.fotos) {
    lineas.push(
      `Fotos: anclas ${r.fotos.anclas}, asociadas ${r.fotos.asociadas}; avisos ${JSON.stringify(r.fotos.avisosPorTipo)}; rechazadas ${JSON.stringify(r.fotos.rechazadasPorMotivo)}`,
    );
    if (r.fotos.escritura) lineas.push(`Escritura de fotos: ${JSON.stringify(r.fotos.escritura)}`);
  }
  for (const c of r.conciliacion) {
    lineas.push(
      `${c.ok ? "OK " : "DIF"} ${c.control}: esperado ${c.esperado}, real ${c.real}${c.nota ? ` (${c.nota})` : ""}`,
    );
  }
  return lineas;
}
