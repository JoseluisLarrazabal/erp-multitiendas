// Preferencias del equipo en localStorage. Puede lanzar (modo privado, datos bloqueados): todo va en try/catch y
// la pantalla funciona sin ellas (el contador se rehace con dispositivos.ultimo_numero).
const claveEquipo = (negocioId: string) => `erp:pos:equipo:${negocioId}`;
const claveContador = (dispositivoId: string) => `erp:pos:contador:${dispositivoId}`;

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function escribir(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: el contador local no persiste, el servidor lo repone.
  }
}

export const leerEquipoGuardado = (negocioId: string) => leer(claveEquipo(negocioId));
export const guardarEquipo = (negocioId: string, id: string | null) =>
  escribir(claveEquipo(negocioId), id);

export function leerContador(dispositivoId: string): number {
  const n = Number(leer(claveContador(dispositivoId)));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}
export const guardarContador = (dispositivoId: string, n: number) =>
  escribir(claveContador(dispositivoId), String(n));
// Nunca baja: una venta de la cola puede llegar después de una más nueva.
export const subirContador = (dispositivoId: string, n: number) =>
  guardarContador(dispositivoId, Math.max(leerContador(dispositivoId), n));
