import { z } from "zod";

// RF-CAT-12. Referencia informativa: nunca escribe en tipos_cambio ni toca el tipo de cambio vigente (RN-02).
const FUENTE = "https://paralelo.bo/api/v1/rate";
export const PARALELO_URL = "https://paralelo.bo";
export const MINUTOS_DESACTUALIZADO = 15;

// Solo median y timestamp: buy/sell vienen invertidos y sin documentar.
const fuenteSchema = z.object({
  median: z.number().positive(),
  timestamp: z.iso.datetime({ offset: true }),
});

export type Paralelo = { disponible: true; valor: number; leidoEn: string } | { disponible: false };

export function parsearParalelo(json: unknown): Paralelo {
  const r = fuenteSchema.safeParse(json);
  return r.success
    ? { disponible: true, valor: r.data.median, leidoEn: r.data.timestamp }
    : { disponible: false };
}

// Servidor. Cualquier falla de paralelo.bo (red, timeout, HTTP, forma) es "no disponible", nunca una excepción.
export async function obtenerParalelo(): Promise<Paralelo> {
  try {
    const r = await fetch(FUENTE, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
    return r.ok ? parsearParalelo(await r.json()) : { disponible: false };
  } catch {
    return { disponible: false };
  }
}

export function estaDesactualizado(leidoEn: string, ahoraMs: number = Date.now()): boolean {
  return ahoraMs - new Date(leidoEn).getTime() > MINUTOS_DESACTUALIZADO * 60_000;
}
