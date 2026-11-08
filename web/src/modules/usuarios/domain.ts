import type { ZodType } from "zod";

export const COOKIE_NEGOCIO = "negocio_activo";

// Quien tiene alguno de estos permisos en el negocio activo entra al panel; el resto va al POS.
const PERMISOS_PANEL = ["ver_reportes", "editar_productos", "usuarios"];

// `codigo`: código ERP_* de la RPC cuando el fallo vino de la base (las acciones del panel no lo usan).
export type Resultado<T> =
  { ok: true; data: T } | { ok: false; error: string; codigo?: string | null; red?: boolean };

// `red`: no hubo respuesta del servidor (fallo de transporte), no un error de la base.
export const falla = (error: string, red?: boolean): Resultado<never> => ({
  ok: false,
  error,
  red,
});

// Entrada de una server action -> datos validados, o null. Compartido por las actions de los módulos del panel.
export function validar<T>(schema: ZodType<T>, entrada: unknown): T | null {
  const r = schema.safeParse(entrada);
  return r.success ? r.data : null;
}

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

// Re-chequeo de fondo con la sesión ya lista: el negocio en pantalla se conserva si sigue siendo del usuario; solo
// el cambio explícito del usuario cambia de negocio (si no, el carrito y la venta en duda se perderían al remontar).
export function negocioDeRecheck(
  negocios: readonly NegocioUsuario[],
  actualId: string | null,
  preferido: string | undefined,
): NegocioUsuario | null {
  return negocios.find((n) => n.negocioId === actualId) ?? elegirNegocioActivo(negocios, preferido);
}

export type Destino = "/panel" | "/pos" | "/sin-acceso";

export function destinoInicial(
  activo: NegocioUsuario | null,
  permisos: readonly string[],
): Destino {
  if (!activo) return "/sin-acceso";
  return tieneAccesoPanel(permisos) ? "/panel" : "/pos";
}

const ORDEN_ROLES = Object.keys(ETIQUETA_ROL);

// `dueno` solo lo asigna un dueño (regla 1); la RPC lo exige igual, esto solo evita ofrecer lo que se rechazaría.
export const rolesOfrecidos = (roles: readonly string[], llamadorEsDueno: boolean) =>
  ORDEN_ROLES.filter((r) => roles.includes(r) && (llamadorEsDueno || r !== "dueno"));

export type FilaUsuario = {
  usuarioId: string;
  nombre: string;
  rol: string;
  activo: boolean;
  esYo: boolean;
  // Resultado de puede_administrar_cuenta (regla 3): sirve para desactivar y reactivar.
  puedeAdministrar: boolean;
};

export type AccionesFila = {
  cambiarRol: boolean;
  quitar: boolean;
  desactivar: boolean;
  reactivar: boolean;
};

const SIN_ACCIONES: AccionesFila = {
  cambiarRol: false,
  quitar: false,
  desactivar: false,
  reactivar: false,
};

// Ocultar es comodidad: decide la RPC. Mi fila y la de un dueño (si no soy dueño) no llevan acciones.
export function accionesDeFila(fila: FilaUsuario, llamadorEsDueno: boolean): AccionesFila {
  if (fila.esYo || (fila.rol === "dueno" && !llamadorEsDueno)) return SIN_ACCIONES;
  return {
    cambiarRol: true,
    quitar: true,
    desactivar: fila.activo && fila.puedeAdministrar,
    reactivar: !fila.activo && fila.puedeAdministrar,
  };
}

export type PersonaExterna = { usuarioId: string; nombre: string };

export type Dispositivo = { id: string; nombre: string; prefijo: string; ubicacion: string };
export type Ubicacion = { id: string; nombre: string };

// Códigos estables de la RPC y de admin-usuarios, traducidos para la persona.
export const MENSAJES_ERROR: Record<string, string> = {
  ERP_SIN_PERMISO: "No tienes permiso para hacer esto.",
  ERP_SIN_SESION: "Tu sesión terminó. Vuelve a ingresar.",
  ERP_DATOS_INVALIDOS: "Revisa los datos: hay algo incompleto o inválido.",
  ERP_DUENO_PROTEGIDO: "Solo un dueño del negocio puede asignar o modificar a un dueño.",
  ERP_ULTIMO_DUENO:
    "Es el único dueño activo de uno de sus negocios: nombra o reactiva a otro dueño antes de desactivarlo.",
  ERP_AUTOGESTION: "No puedes cambiar tu propio rol ni quitarte a ti mismo.",
  ERP_ULTIMO_NEGOCIO:
    "Es el último negocio de esta cuenta, no se puede quitar. Desactívala en su lugar.",
  ERP_PREFIJO_DUPLICADO: "Ya hay un dispositivo con ese prefijo en este negocio.",
  ERP_CORREO_EXISTE: "Ya existe una cuenta con ese correo.",
  ERP_CLAVE_DEBIL: "La contraseña necesita al menos 8 caracteres, con letras y dígitos.",
  ERP_CUENTA_HUERFANA:
    "No se pudo asignar el negocio y la cuenta nueva quedó sin negocio. Avisa a soporte.",
  ERP_AUDITORIA:
    "El cambio se aplicó, pero no quedó registrado en la auditoría. Avisa al administrador.",
  ERP_INTERNO: "Algo salió mal de nuestro lado. Intenta de nuevo.",
};

export const mensajeDeError = (codigo: string | undefined) =>
  (codigo && MENSAJES_ERROR[codigo]) || MENSAJES_ERROR.ERP_INTERNO!;

// Los errores de RPC llegan como texto; solo cuenta el código ERP_* que contengan.
export const codigoDeMensaje = (mensaje: string | undefined) => mensaje?.match(/ERP_[A-Z_]+/)?.[0];

// Una verificación de fondo (evento `online`) que falla no puede sacar una sesión que ya estaba lista: desmontaría la
// venta en curso. Solo una respuesta cierta de sesión perdida cambia de fase (ver `caducada` en use-pos-sesion).
export const conservarLista = <T extends { fase: string }>(actual: T, nueva: T): T =>
  actual.fase === "lista" && nueva.fase !== "lista" ? actual : nueva;
