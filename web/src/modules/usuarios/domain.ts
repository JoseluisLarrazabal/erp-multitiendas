export const COOKIE_NEGOCIO = "negocio_activo";

// Quien tiene alguno de estos permisos en el negocio activo entra al panel; el resto va al POS.
const PERMISOS_PANEL = ["ver_reportes", "editar_productos", "usuarios"];

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export type NegocioUsuario = {
  negocioId: string;
  nombre: string;
  tipo: string;
  rol: string;
};

export const ETIQUETA_ROL: Record<string, string> = {
  dueno: "Dueño",
  encargado: "Encargado",
  contador: "Contador",
  vendedor: "Vendedor",
  empleado: "Empleado",
};

export const etiquetaRol = (rol: string) => ETIQUETA_ROL[rol] ?? rol;

export const tieneAccesoPanel = (permisos: readonly string[]) =>
  PERMISOS_PANEL.some((p) => permisos.includes(p));

// La cookie es una preferencia de UI y puede venir forjada: solo vale si es un negocio del usuario.
export function elegirNegocioActivo(
  negocios: readonly NegocioUsuario[],
  preferido: string | undefined,
): NegocioUsuario | null {
  return negocios.find((n) => n.negocioId === preferido) ?? negocios[0] ?? null;
}

export type Destino = "/panel" | "/pos" | "/sin-acceso";

export function destinoInicial(
  activo: NegocioUsuario | null,
  permisos: readonly string[],
): Destino {
  if (!activo) return "/sin-acceso";
  return tieneAccesoPanel(permisos) ? "/panel" : "/pos";
}
