# Stack — ERP Multitiendas

Estado: **propuesta del chairman, pendiente de confirmación del CTO** (2026-10-26). Los términos se revisaron el
2026-10-26 con las fuentes oficiales citadas abajo.

## Decisión propuesta

| Pieza | Elección | Costo |
|---|---|---|
| Framework | Next.js 16 (App Router), una sola app con `/panel` y `/pos` | — |
| Base y auth | Supabase **Pro** | ~$25/mes |
| Hosting | Vercel **Pro**, 1 seat Developer | ~$20/mes (incluye $20 de uso) |
| Service worker (POS) | spike con `@serwist/turbopack`; si falla, SW manual (`src/sw.ts` + esbuild) | — |
| Cola local (POS) | Dexie 4 + outbox propia con UUID como idempotency key | — |
| Reintento | evento `online` + temporizador (Background Sync no existe en Safari) | — |

Costo base estimado: **~$45/mes**. Quién lo paga (el cliente o el CTO) no está definido en lo que conozco del
contrato. **Pendiente.**

## Motivos

- **Supabase Free descartado:** no tiene backups automáticos y se pausa tras ~7 días de baja actividad. Para un
  sistema con dinero y stock, inaceptable.
  - Pro incluye backups diarios con 7 días de retención y no se pausa.
  - PITR ($100/mes) no hace falta de entrada.
  - Fuentes: https://supabase.com/pricing, https://supabase.com/docs/guides/platform/free-project-pausing
- **Vercel Hobby descartado:** su definición de uso comercial incluye a un consultor que cobra por el código.
  Fuente: https://vercel.com/docs/limits/fair-use-guidelines.
- **Vercel Pro antes que Cloudflare:**
  - `@opennextjs/cloudflare` (1.20.13) soporta Next `>=16.4.1`, pero **no soporta Node Middleware**. En Next 16,
    `proxy.ts` corre en Node. El patrón SSR de Supabase usa middleware/proxy para refrescar la sesión.
  - Workers Free tiene un tope de 10 ms de CPU por request, que un SSR puede superar.
  - El límite de tamaño del bundle se contradice entre la doc de OpenNext y la de Cloudflare.
  - Ahorrar ~$15/mes no compensa ese riesgo.
- **Cloudflare Workers Paid ($5/mes)** queda como alternativa barata, **solo después de un build real** que pase
  con auth y SSR.

## Riesgos abiertos

- La configuración de Serwist con Turbopack no está documentada (su página dio 404). Se resuelve con un spike corto
  antes del POS.
- **Elegance también corre en Vercel Hobby con uso comercial.** Ya existe el mismo riesgo de suspensión de la cuenta.
  Si se paga Pro para esta cuenta, conviene mover Elegance al mismo equipo Pro.
- Uso comercial en Workers Free: no confirmado (habría que leer el Self-Serve Subscription Agreement).
