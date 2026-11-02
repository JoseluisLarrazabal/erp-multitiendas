import { z } from "zod";
import { baseOffline } from "./db";

// Cola genérica de operaciones pendientes. No conoce ventas ni caja: cada tipo trae su enviador.
export const filaColaSchema = z.object({
  orden: z.number().int(),
  id: z.guid(),
  tipo: z.string().min(1),
  negocioId: z.string().min(1),
  dispositivoId: z.string().min(1),
  usuarioId: z.string().min(1),
  payload: z.json(),
  nota: z.json(),
  estado: z.enum(["pendiente", "rechazada"]),
  intentos: z.number().int().min(0),
  proximoIntento: z.number(),
  error: z.string().nullable(),
  numeroImpreso: z.string().nullable(),
});
export type FilaCola = z.infer<typeof filaColaSchema>;
export type FilaNueva = Pick<
  FilaCola,
  "id" | "tipo" | "negocioId" | "dispositivoId" | "usuarioId" | "payload" | "nota" | "numeroImpreso"
>;

// red: la base pudo no enterarse (corta el vaciado y reintenta con backoff). rechazo: la base respondió que no
// (queda `rechazada`, nunca se borra sola). pausa: no se puede enviar ahora, sin contar como fallo (sesión caducada).
export type ResultadoEnvio =
  | { t: "ok" }
  | { t: "red"; error: string }
  | { t: "rechazo"; error: string; codigo?: string | null }
  | { t: "pausa" };
export type Enviador = (fila: FilaCola) => Promise<ResultadoEnvio>;

const ESPERA_MIN_MS = 5_000;
const ESPERA_MAX_MS = 300_000;
export const esperaReintento = (intentos: number) =>
  Math.min(ESPERA_MIN_MS * 2 ** Math.max(intentos - 1, 0), ESPERA_MAX_MS);

export type LecturaCola = { filas: FilaCola[]; ilegibles: number; ordenesIlegibles: number[] };

// Lee todo en orden. Una fila ilegible no rompe nada y no se borra sola: se cuenta y se guarda su `orden`.
export async function leerFilas(): Promise<LecturaCola> {
  const crudas = await baseOffline().cola.orderBy("orden").toArray();
  const filas: FilaCola[] = [];
  const ordenesIlegibles: number[] = [];
  for (const cruda of crudas) {
    const r = filaColaSchema.safeParse(cruda);
    if (r.success) filas.push(r.data);
    else if (cruda.orden !== undefined) ordenesIlegibles.push(cruda.orden);
  }
  return { filas, ilegibles: ordenesIlegibles.length, ordenesIlegibles };
}

// Lanza si IndexedDB falla: el llamador decide no cobrar.
export async function encolar(nueva: FilaNueva): Promise<void> {
  const fila = filaColaSchema.omit({ orden: true }).parse({
    ...nueva,
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    error: null,
  });
  await baseOffline().cola.add(fila);
}

const porId = (id: string) => baseOffline().cola.where("id").equals(id);
export const quitar = (id: string) => porId(id).delete();
export const actualizarFila = (
  id: string,
  cambios: Partial<Pick<FilaCola, "payload" | "nota" | "numeroImpreso">>,
) => porId(id).modify(cambios);
export const marcarRed = (id: string, error: string) =>
  porId(id).modify((f) => {
    f.intentos += 1;
    f.proximoIntento = Date.now() + esperaReintento(f.intentos);
    f.error = error;
  });
export const marcarRechazada = (id: string, error: string) =>
  porId(id).modify({ estado: "rechazada", error });
// Conserva `intentos`: una venta en duda sigue en duda y se comprueba antes de reenviarla.
export const reabrir = (id: string) =>
  porId(id).modify({ estado: "pendiente", error: null, proximoIntento: 0 });

// Solo borra lo que sigue siendo ilegible: una fila que otra pestaña dejó legible no se toca.
export async function quitarIlegibles(ordenes: readonly number[]): Promise<void> {
  const tabla = baseOffline().cola;
  await baseOffline().transaction("rw", tabla, async () => {
    const crudas = await tabla.bulkGet([...ordenes]);
    const aBorrar = ordenes.filter((_, i) => {
      const cruda = crudas[i];
      return cruda !== undefined && !filaColaSchema.safeParse(cruda).success;
    });
    await tabla.bulkDelete(aBorrar);
  });
}

// Cerrojo por fila: quien tiene la fila en su primer intento (o la está enviando) la tiene sola. Si la pestaña muere el
// navegador suelta el cerrojo. Devuelve null si la fila está ocupada.
const filasEnMemoria = new Set<string>(); // sin navigator.locks (Vitest, navegadores viejos) basta esta pestaña
export async function conFila<T>(id: string, fn: () => Promise<T>): Promise<{ valor: T } | null> {
  const nombre = `erp:fila:${id}`;
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(nombre, { ifAvailable: true }, (cerrojo) =>
      cerrojo ? fn().then((valor) => ({ valor })) : null,
    );
  }
  if (filasEnMemoria.has(nombre)) return null;
  filasEnMemoria.add(nombre);
  try {
    return { valor: await fn() };
  } finally {
    filasEnMemoria.delete(nombre);
  }
}

const CERROJO = "erp:cola";
let enCurso = false; // sin navigator.locks (Vitest, navegadores viejos) basta la guarda de esta pestaña

export type OpcionesVaciado = {
  enviadores: Record<string, Enviador>;
  // Filas de otro negocio o cuenta no se tocan.
  elegible: (fila: FilaCola) => boolean;
  // Ignora la espera de las filas que ya fallaron (volvió la red, o lo pidió el usuario).
  forzar?: boolean;
};

// Una sola pestaña vacía a la vez. Envía en orden; ante un fallo de red corta, porque las siguientes dependen de las
// anteriores (la apertura de caja antes que sus ventas).
export async function vaciar(o: OpcionesVaciado): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(CERROJO, { ifAvailable: true }, (cerrojo) =>
      cerrojo ? recorrer(o) : undefined,
    );
    return;
  }
  if (enCurso) return;
  enCurso = true;
  try {
    await recorrer(o);
  } finally {
    enCurso = false;
  }
}

async function recorrer(o: OpcionesVaciado): Promise<void> {
  const { filas } = await leerFilas();
  for (const fila of filas) {
    if (fila.estado !== "pendiente" || !o.elegible(fila)) continue;
    // shortcut: un tipo sin enviador (fila de una versión más nueva) se salta sin bloquear el resto; si el orden entre
    // tipos pasa a importar, cortar aquí.
    const enviador = o.enviadores[fila.tipo];
    if (!enviador) continue;
    // Fila ocupada (su primer intento o otra pestaña): se corta, las siguientes dependen de ella.
    const r = await conFila(fila.id, () => enviarFila(fila.id, enviador, o));
    if (!r || r.valor === "cortar") return;
  }
}

// Relee la fila ya con el cerrojo: otra pestaña pudo enviarla o cambiarla mientras tanto.
async function enviarFila(
  id: string,
  enviador: Enviador,
  o: OpcionesVaciado,
): Promise<"seguir" | "cortar"> {
  const cruda = await porId(id).first();
  const leida = filaColaSchema.safeParse(cruda);
  if (!leida.success || leida.data.estado !== "pendiente") return "seguir";
  const fila = leida.data;
  if (fila.proximoIntento > Date.now() && !o.forzar) return "cortar";
  let r: ResultadoEnvio;
  try {
    r = await enviador(fila);
  } catch {
    r = { t: "red", error: "No se pudo enviar. Se reintentará." };
  }
  if (r.t === "ok") await quitar(fila.id);
  else if (r.t === "rechazo") await marcarRechazada(fila.id, r.error);
  else if (r.t === "red") {
    await marcarRed(fila.id, r.error);
    return "cortar";
  } else return "cortar";
  return "seguir";
}
