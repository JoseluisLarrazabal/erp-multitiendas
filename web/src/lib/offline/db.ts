import Dexie, { type Table } from "dexie";
import type { FilaCola } from "./cola";

type FilaGuardada = Omit<FilaCola, "orden"> & { orden?: number };
type FilaDatos = { clave: string; valor: unknown };

class BaseOffline extends Dexie {
  cola!: Table<FilaGuardada, number>;
  datos!: Table<FilaDatos, string>;

  constructor() {
    super("erp-pos");
    // `id` único: la misma operación no entra dos veces. `datos` guarda el snapshot (PR 3).
    this.version(1).stores({ cola: "++orden, &id, estado, negocioId", datos: "clave" });
  }
}

// Perezosa: /pos se prerenderiza en el servidor, donde no hay IndexedDB.
let base: BaseOffline | null = null;
export function baseOffline(): BaseOffline {
  base ??= new BaseOffline();
  return base;
}
