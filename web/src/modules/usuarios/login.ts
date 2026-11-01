import { esErrorTransitorio } from "@/lib/supabase/errores";

// Mismo mensaje para cuenta inexistente, contraseña mala y cuenta desactivada (400 o 403).
export const ERROR_CREDENCIALES = "Correo o contraseña incorrectos.";
export const ERROR_CONEXION = "No pudimos conectar. Intenta de nuevo.";

export const mensajeErrorLogin = (error: unknown) =>
  esErrorTransitorio(error) ? ERROR_CONEXION : ERROR_CREDENCIALES;
