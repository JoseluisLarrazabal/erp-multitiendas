import { z } from "zod";
import { borrarDatos, guardarDato, leerDato } from "@/lib/offline/datos";
import type { NegocioUsuario } from "./domain";

// Qué cuenta, negocios y permisos tenía el POS la última vez que hubo red, para abrir sin conexión (docs/plan-fase-3.md).
// Una sola cuenta a la vez por navegador: `ultimo` dice cuál, y al guardar otra cuenta se borra el contexto anterior,
// así nadie ve datos ajenos. La RLS sigue decidiendo al sincronizar.
const CLAVE_ULTIMO = "ultimo";
const claveSesion = (usuarioId: string) => `sesion:${usuarioId}`;

const ultimoSchema = z.object({ usuarioId: z.string().min(1) });
const sesionLocalSchema = z.object({
  usuarioId: z.string().min(1),
  negocios: z.array(
    z.object({ negocioId: z.string(), nombre: z.string(), tipo: z.string(), rol: z.string() }),
  ),
  activoId: z.string(),
  permisos: z.array(z.string()),
  // Última vez que el servidor confirmó este contexto (ms). Sin el campo (filas viejas) cuenta como caducado.
  validadaEn: z.number().optional(),
});
export type SesionLocal = {
  usuarioId: string;
  negocios: NegocioUsuario[];
  activoId: string;
  permisos: string[];
};

// Sin contacto con el servidor por más de esto, el contexto guardado no sirve para vender (un usuario desactivado o
// con otro rol no debe vender sin conexión indefinidamente). shortcut: usa el reloj del equipo; si lo atrasan no caduca.
export const CADUCIDAD_CONTEXTO_MS = 72 * 3_600_000;
export const contextoCaducado = (validadaEn: number | undefined, ahora = Date.now()): boolean =>
  validadaEn === undefined || ahora - validadaEn > CADUCIDAD_CONTEXTO_MS;
export const CADUCADO = "caducado" as const;

// Guardar = el servidor acaba de confirmar este contexto: renueva la fecha. Espera todas las escrituras: un cierre de
// sesión que borre después no puede ser resucitado por una escritura en vuelo.
export async function guardarSesionLocal(s: SesionLocal): Promise<void> {
  const ultimo = await leerDato(CLAVE_ULTIMO, ultimoSchema);
  if (ultimo && ultimo.usuarioId !== s.usuarioId) await borrarDatos();
  await guardarDato(CLAVE_ULTIMO, { usuarioId: s.usuarioId });
  await guardarDato(claveSesion(s.usuarioId), { ...s, validadaEn: Date.now() });
}

export async function leerSesionLocal(): Promise<SesionLocal | typeof CADUCADO | null> {
  const ultimo = await leerDato(CLAVE_ULTIMO, ultimoSchema);
  if (!ultimo) return null;
  const crudo = await leerDato(claveSesion(ultimo.usuarioId), sesionLocalSchema);
  if (!crudo || crudo.usuarioId !== ultimo.usuarioId) return null;
  if (!crudo.negocios.some((n) => n.negocioId === crudo.activoId)) return null;
  if (contextoCaducado(crudo.validadaEn)) return CADUCADO;
  const s = { ...crudo };
  delete s.validadaEn;
  return s;
}

// Cerrar sesión o salir a /login: el contexto se va, la cola nunca.
export const borrarContextoLocal = borrarDatos;
