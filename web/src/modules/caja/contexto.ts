import { borrarDato, guardarDato, leerDato } from "@/lib/offline/datos";
import { sesionCajaSchema, type SesionCaja } from "./schemas";

// Sesión de caja abierta de un equipo, para abrir el POS sin red. Sin clave = sin caja abierta que se sepa.
const clave = (usuarioId: string, equipoId: string) => `caja:${usuarioId}:${equipoId}`;

export const leerCajaLocal = (usuarioId: string, equipoId: string): Promise<SesionCaja | null> =>
  leerDato(clave(usuarioId, equipoId), sesionCajaSchema);

export function guardarCajaLocal(usuarioId: string, equipoId: string, sesion: SesionCaja | null) {
  if (sesion) guardarDato(clave(usuarioId, equipoId), sesion);
  else void borrarDato(clave(usuarioId, equipoId));
}
