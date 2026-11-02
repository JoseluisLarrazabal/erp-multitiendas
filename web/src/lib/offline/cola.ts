import { z } from "zod";
import { baseOffline } from "./db";
import { avisarRed } from "./red";

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
  // false: el primer intento sigue en curso o murió antes de entregar la nota al cliente. Las filas guardadas antes de
  // este campo ya se habían entregado.
  entregada: z.boolean().default(true),
});
export type FilaCola = z.infer<typeof filaColaSchema>;
export type FilaNueva = Pick<
  FilaCola,
  "id" | "tipo" | "negocioId" | "dispositivoId" | "usuarioId" | "payload" | "nota" | "numeroImpreso"
> &
  Partial<Pick<FilaCola, "entregada">>;

// red: la base pudo no enterarse (corta el vaciado y reintenta con backoff). rechazo: la base respondió que no
// (queda `rechazada`, nunca se borra sola). `respondio` en red: el servidor contestó (o no se sabe) con un error que se
// reintenta: no prueba que falte la red. pausa: no se puede enviar ahora, sin contar como fallo (no salió ninguna
// petición: sin sesión o sin poder comprobarla).
export type ResultadoEnvio =
  | { t: "ok" }
  | { t: "red"; error: string; respondio?: boolean }
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
export async function leerFila(id: string): Promise<FilaCola | null> {
  const r = filaColaSchema.safeParse(await porId(id).first());
  return r.success ? r.data : null;
}
export const actualizarFila = (
  id: string,
  cambios: Partial<Pick<FilaCola, "payload" | "nota" | "numeroImpreso" | "entregada">>,
) => porId(id).modify(cambios);
export const marcarRed = (id: string, error: string) =>
  porId(id).modify((f) => {
    f.intentos += 1;
    f.proximoIntento = Date.now() + esperaReintento(f.intentos);
    f.error = error;
  });
export const marcarRechazada = (id: string, error: string) =>
  porId(id).modify({ estado: "rechazada", error });
// Conserva `intentos`: una venta en duda sigue en duda y se comprueba antes de reenviarla. Quien reabre ya decidió
// reenviarla: deja de ser un primer intento interrumpido.
export const reabrir = (id: string) =>
  porId(id).modify({ estado: "pendiente", error: null, proximoIntento: 0, entregada: true });

// Descartar solo borra lo que sigue rechazado: entre pulsar el botón y confirmar, Reintentar pudo reabrirla. Va bajo el
// cerrojo de la fila para no borrar una que el motor está enviando. false: no se borró.
export async function quitarSiRechazada(id: string): Promise<boolean> {
  const r = await conFila(id, async () => {
    if ((await leerFila(id))?.estado !== "rechazada") return false;
    await quitar(id);
    return true;
  });
  return r?.valor ?? false;
}

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

// Como conFila pero espera su turno: para secciones cortas que serializan a todas las pestañas (sin red dentro).
const colasEnMemoria = new Map<string, Promise<unknown>>();
export async function conCerrojo<T>(nombre: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(nombre, fn);
  const anterior = colasEnMemoria.get(nombre) ?? Promise.resolve();
  const actual = anterior.then(fn);
  const cola = actual.catch(() => undefined);
  colasEnMemoria.set(nombre, cola);
  try {
    return await actual;
  } finally {
    if (colasEnMemoria.get(nombre) === cola) colasEnMemoria.delete(nombre);
  }
}

const MENSAJE_INTERRUMPIDA =
  "El cobro se interrumpió antes de la nota. Comprueba si el cliente pagó: reintenta o descarta.";
const CERROJO = "erp:cola";
let enCurso = false; // sin navigator.locks (Vitest, navegadores viejos) basta la guarda de esta pestaña

export type OpcionesVaciado = {
  enviadores: Record<string, Enviador>;
  // Filas de otro negocio o cuenta no se tocan.
  elegible: (fila: FilaCola) => boolean;
  // Ignora la espera de las filas que ya fallaron (volvió la red, o lo pidió el usuario).
  forzar?: boolean;
  // El motor que registró la espera pudo detenerse (logout, cambio de cuenta o negocio): una repetición suya no corre.
  activo?: () => boolean;
};

// Una sola pestaña vacía a la vez. Envía en orden; ante un fallo de red corta, porque las siguientes dependen de las
// anteriores (la apertura de caja antes que sus ventas).
// Un disparo que encuentra el vaciado en curso (de este motor, de otro o de otra pestaña) no se pierde: queda UNA
// repetición pendiente (forzada si alguno lo fue) que corre al soltarse el cerrojo. Devuelve false si solo la dejó
// registrada (no vació nada ahora).
let repetir: { forzar: boolean } | null = null;
export async function vaciar(o: OpcionesVaciado): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    const corrio = await navigator.locks.request(
      CERROJO,
      { ifAvailable: true },
      async (cerrojo) => {
        if (!cerrojo) return false;
        await recorrer(o);
        return true;
      },
    );
    if (corrio) return true;
    if (repetir) {
      repetir.forzar ||= !!o.forzar;
      return false;
    }
    const mia = (repetir = { forzar: !!o.forzar });
    // Espera su turno una sola vez (otra pestaña puede tener el cerrojo): no es un bucle, un disparo más abre otra espera.
    await navigator.locks.request(CERROJO, async () => {
      repetir = null;
      if (o.activo?.() === false) return;
      await recorrer({ ...o, forzar: mia.forzar });
    });
    return true;
  }
  if (enCurso) {
    if (repetir) repetir.forzar ||= !!o.forzar;
    else repetir = { forzar: !!o.forzar };
    return false;
  }
  enCurso = true;
  try {
    let actual = o;
    for (;;) {
      await recorrer(actual);
      if (!repetir || o.activo?.() === false) return true;
      actual = { ...o, forzar: repetir.forzar };
      repetir = null;
    }
  } finally {
    enCurso = false;
    repetir = null;
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
  // Con el cerrojo libre y sin nota entregada, el primer intento murió antes de la nota: la base pudo haber guardado la
  // venta. Nunca se envía sola.
  if (!fila.entregada) {
    await marcarRechazada(fila.id, MENSAJE_INTERRUMPIDA);
    return "seguir";
  }
  if (fila.proximoIntento > Date.now() && !o.forzar) return "cortar";
  let r: ResultadoEnvio;
  try {
    r = await enviador(fila);
  } catch {
    r = { t: "red", error: "No se pudo enviar. Se reintentará.", respondio: true };
  }
  // Una respuesta del servidor (ok o rechazo) prueba que hay red; un fallo sin respuesta, lo contrario.
  if (r.t === "ok" || r.t === "rechazo") avisarRed(true);
  else if (r.t === "red" && !r.respondio) avisarRed(false);
  if (r.t === "ok") await quitar(fila.id);
  else if (r.t === "rechazo") await marcarRechazada(fila.id, r.error);
  else if (r.t === "red") {
    await marcarRed(fila.id, r.error);
    return "cortar";
  } else return "cortar";
  return "seguir";
}
