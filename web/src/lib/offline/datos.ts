import type { ZodType } from "zod";
import { baseOffline } from "./db";

// Contexto del POS en IndexedDB (tabla `datos`). Genérico: no sabe qué guarda cada módulo. Todo se valida con Zod al
// leer y una fila inválida (versión vieja, dato dañado) se ignora, como si no existiera. Nunca lanza: sin IndexedDB el
// POS funciona igual, solo que no abre sin red.
export async function leerDato<T>(clave: string, schema: ZodType<T>): Promise<T | null> {
  try {
    const fila = await baseOffline().datos.get(clave);
    const r = schema.safeParse(fila?.valor);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

// No bloquea la UI: el llamador no espera ni se entera del fallo. `despues` corre solo si se guardó.
export function guardarDato(clave: string, valor: unknown, despues?: () => void): void {
  void baseOffline()
    .datos.put({ clave, valor })
    .then(despues)
    .catch(() => undefined);
}

export async function borrarDato(clave: string): Promise<void> {
  try {
    await baseOffline().datos.delete(clave);
  } catch {
    // Sin IndexedDB no hay nada guardado que borrar.
  }
}

// Cerrar sesión: borra el contexto. La cola es otra tabla y nunca se toca aquí.
export async function borrarDatos(): Promise<void> {
  try {
    await baseOffline().datos.clear();
  } catch {
    // Sin IndexedDB no hay nada guardado que borrar.
  }
}

// Escritura diferida para valores grandes (el catálogo): se junta lo último que llegó y se guarda cuando el navegador
// está libre, así el buscador no pierde teclas por clonar ~1 MB.
const pendientes = new Map<string, { t: ReturnType<typeof setTimeout>; guardar: () => void }>();
// `valor` devuelve undefined si ya no hay nada que guardar. `despues` va tras escribir el valor (p. ej. la fecha que lo
// describe: si la pestaña cierra antes, la fecha no queda adelantada al dato).
export function guardarDatoDiferido(
  clave: string,
  valor: () => unknown,
  esperaMs = 2_000,
  despues?: () => void,
): void {
  clearTimeout(pendientes.get(clave)?.t);
  const guardar = () => {
    const v = valor();
    if (v !== undefined) guardarDato(clave, v, despues);
  };
  const t = setTimeout(() => {
    pendientes.delete(clave);
    const ocioso = (window as { requestIdleCallback?: (f: () => void) => number })
      .requestIdleCallback;
    if (ocioso) ocioso(guardar);
    else guardar();
  }, esperaMs);
  pendientes.set(clave, { t, guardar });
}

// Al ocultarse o cerrarse la pestaña no hay "más tarde": lo pendiente se guarda ya.
export function guardarPendientes(): void {
  for (const [clave, { t, guardar }] of [...pendientes]) {
    clearTimeout(t);
    pendientes.delete(clave);
    guardar();
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", guardarPendientes);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") guardarPendientes();
  });
}
