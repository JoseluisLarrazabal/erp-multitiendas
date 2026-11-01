import { isAuthRetryableFetchError, isAuthSessionMissingError } from "@supabase/supabase-js";

type ErrorAuth = { status?: number } | null | undefined;

// Fallo de red, límite de tasa o caída de Auth: reintentar sirve, y no dice nada de la sesión.
export function esErrorTransitorio(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as ErrorAuth)?.status;
  return typeof status === "number" && (status === 429 || status >= 500);
}

// Sin sesión o token inválido: lo único que justifica mandar a /login desde el cliente.
export function esSinSesion(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  const status = (error as ErrorAuth)?.status;
  return status === 401 || status === 403;
}

export const ERROR_CONEXION = "No pudimos conectar. Intenta de nuevo.";
