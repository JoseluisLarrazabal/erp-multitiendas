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
});
export type SesionLocal = {
  usuarioId: string;
  negocios: NegocioUsuario[];
  activoId: string;
  permisos: string[];
};

// Espera solo el cambio de cuenta (el borrado debe terminar antes de que otros módulos escriban lo suyo).
export async function guardarSesionLocal(s: SesionLocal): Promise<void> {
  const ultimo = await leerDato(CLAVE_ULTIMO, ultimoSchema);
  if (ultimo && ultimo.usuarioId !== s.usuarioId) await borrarDatos();
  guardarDato(CLAVE_ULTIMO, { usuarioId: s.usuarioId });
  guardarDato(claveSesion(s.usuarioId), s);
}

export async function leerSesionLocal(): Promise<SesionLocal | null> {
  const ultimo = await leerDato(CLAVE_ULTIMO, ultimoSchema);
  if (!ultimo) return null;
  const s = await leerDato(claveSesion(ultimo.usuarioId), sesionLocalSchema);
  return s && s.usuarioId === ultimo.usuarioId && s.negocios.some((n) => n.negocioId === s.activoId)
    ? s
    : null;
}

// Cerrar sesión o salir a /login: el contexto se va, la cola nunca.
export const borrarContextoLocal = borrarDatos;
