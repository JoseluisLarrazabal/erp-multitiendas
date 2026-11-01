import { COOKIE_NEGOCIO } from "./domain";

export function leerNegocioGuardado(): string | undefined {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NEGOCIO}=`));
  return par?.slice(COOKIE_NEGOCIO.length + 1);
}

// Solo preferencia de UI: el servidor la valida contra los negocios del usuario en cada request.
// No httpOnly a propósito: /pos es estático y la lee en el cliente.
export function guardarNegocio(id: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NEGOCIO}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}

export function borrarNegocioGuardado() {
  document.cookie = `${COOKIE_NEGOCIO}=; path=/; max-age=0; SameSite=Lax`;
}
