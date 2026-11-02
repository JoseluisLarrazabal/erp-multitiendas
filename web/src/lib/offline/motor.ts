import { liveQuery } from "dexie";
import { leerFilas, vaciar, type LecturaCola, type OpcionesVaciado } from "./cola";

const ESPERA_MIN_TEMPORIZADOR_MS = 5_000;

export type Motor = { disparar: (forzar?: boolean) => void; detener: () => void };

// Disparadores del vaciado: al montar, al volver la red (`online`) y un temporizador mientras haya filas. No se
// confía en navigator.onLine: se intenta siempre y manda la respuesta del servidor.
export function iniciarMotor(o: Omit<OpcionesVaciado, "forzar">): Motor {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let activo = true;

  async function programar() {
    if (!activo) return;
    try {
      const { filas } = await leerFilas();
      const proximas = filas
        .filter((f) => f.estado === "pendiente" && o.elegible(f))
        .map((f) => f.proximoIntento);
      // Tras el await: dos programar solapados no pueden dejar cada uno su temporizador.
      clearTimeout(temporizador);
      if (proximas.length === 0 || !activo) return;
      // Piso: una fila lista pero en pausa (sesión caducada) no puede girar en vacío.
      const espera = Math.max(Math.min(...proximas) - Date.now(), ESPERA_MIN_TEMPORIZADOR_MS);
      temporizador = setTimeout(() => disparar(false), espera);
    } catch {
      // IndexedDB no disponible: no hay cola que vaciar.
    }
  }
  // Se reprograma siempre, aunque `vaciar` solo dejara una repetición: si esa espera es de OTRO motor (detenido) no corre
  // y este quedaría sin temporizador. Cuesta una lectura de IndexedDB de más.
  function disparar(forzar = false) {
    if (!activo) return;
    void vaciar({ ...o, forzar, activo: () => activo })
      .catch(() => undefined)
      .then(programar);
  }
  const alVolverLaRed = () => disparar(true);
  window.addEventListener("online", alVolverLaRed);
  disparar(true);
  return {
    disparar,
    detener: () => {
      activo = false;
      clearTimeout(temporizador);
      window.removeEventListener("online", alVolverLaRed);
    },
  };
}

// Suscripción al contenido de la cola (también ve los cambios de otras pestañas). Si la lectura falla avisa con
// `alFallar` y la suscripción termina: el llamador no puede dar la cola por vacía.
export function observarFilas(
  alCambiar: (e: LecturaCola) => void,
  alFallar: () => void,
): () => void {
  const s = liveQuery(leerFilas).subscribe({ next: alCambiar, error: alFallar });
  return () => s.unsubscribe();
}

// Reduce el desalojo de IndexedDB por falta de espacio. Es una petición: el navegador puede negarla.
export async function pedirPersistencia(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Sin soporte o bloqueado: la cola funciona igual.
  }
}
