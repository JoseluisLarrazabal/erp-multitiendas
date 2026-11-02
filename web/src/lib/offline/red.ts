import { useSyncExternalStore } from "react";

// navigator.onLine no es confiable (portal cautivo, red sin salida): un fetch que falla también significa sin red.
// Quien hace una petición avisa el resultado con `avisarRed`; el evento `online` lo limpia.
let falloDeRed = false;
// Con navigator.onLine=true y nada más pidiendo, la marca no se limpiaría sola: se expira para volver a comprobar.
const REINTENTO_MS = 20_000;
let temporizador: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();
const notificar = () => oyentes.forEach((o) => o());

export const leerSinRed = () =>
  typeof navigator !== "undefined" && (!navigator.onLine || falloDeRed);

export function avisarRed(respondio: boolean): void {
  if (falloDeRed === !respondio) return;
  falloDeRed = !respondio;
  clearTimeout(temporizador);
  if (falloDeRed) temporizador = setTimeout(alVolverLaRed, REINTENTO_MS);
  notificar();
}

function alVolverLaRed() {
  clearTimeout(temporizador);
  falloDeRed = false;
  notificar();
}

function suscribir(oyente: () => void): () => void {
  if (oyentes.size === 0) {
    window.addEventListener("online", alVolverLaRed);
    window.addEventListener("offline", notificar);
  }
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) {
      window.removeEventListener("online", alVolverLaRed);
      window.removeEventListener("offline", notificar);
    }
  };
}

export const useSinRed = (): boolean => useSyncExternalStore(suscribir, leerSinRed, () => false);
