import { ERROR_CONEXION, esErrorTransitorio } from "@/lib/supabase/errores";

// Mismo mensaje para cuenta inexistente, contraseña mala y cuenta desactivada (400 o 403).
export const ERROR_CREDENCIALES = "Correo o contraseña incorrectos.";
export { ERROR_CONEXION };

export const mensajeErrorLogin = (error: unknown) =>
  esErrorTransitorio(error) ? ERROR_CONEXION : ERROR_CREDENCIALES;
