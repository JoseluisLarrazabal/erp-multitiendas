import { z } from "zod";

type Crudo = Record<string, string | string[] | undefined>;

// Parámetros de la URL (searchParams) -> filtros. Cada campo se valida por separado: uno inválido toma su valor por
// defecto y marca `invalido`, para que la página avise en vez de descartarlo en silencio.
export function leerFiltros<T extends Record<string, z.ZodType>>(
  campos: T,
  defectos: { [K in keyof T]: z.output<T[K]> },
  crudo: Crudo,
): { filtros: { [K in keyof T]: z.output<T[K]> }; invalido: boolean } {
  const filtros = { ...defectos };
  let invalido = false;
  for (const k of Object.keys(campos) as (keyof T)[]) {
    const v = crudo[k as string];
    if (v === undefined || v === "") continue;
    const r = campos[k]!.safeParse(v);
    if (r.success) filtros[k] = r.data as (typeof filtros)[typeof k];
    else invalido = true;
  }
  return { filtros, invalido };
}

export const AVISO_FILTRO_INVALIDO = "Algún filtro de la dirección no era válido y se ignoró.";
