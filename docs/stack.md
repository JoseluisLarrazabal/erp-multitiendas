# Stack — ERP Multitiendas

Estado: **decidido por el CTO** (2026-10-26). Los términos se revisaron el
2026-10-26 con las fuentes oficiales citadas abajo.

## Decisión

| Pieza | Elección | Costo |
|---|---|---|
| Framework | Next.js 16 (App Router), una sola app con `/panel` y `/pos` | — |
| Base y auth | Supabase **Free** + backups propios (ver abajo) | $0 |
| Hosting | Vercel **Hobby** + dominio propio | $0 + dominio |
| Service worker (POS) | spike con `@serwist/turbopack`; si falla, SW manual (`src/sw.ts` + esbuild) | — |
| Cola local (POS) | Dexie 4 + outbox propia con UUID como idempotency key | — |
| Reintento | evento `online` + temporizador (Background Sync no existe en Safari) | — |

Costo base: **$0/mes** más el dominio.

### Librerías y herramientas (2026-11-01)

| Uso | Elección |
|---|---|
| Lenguaje | TypeScript `strict` |
| Paquetes | pnpm |
| UI | Tailwind 4 y shadcn, como el prototipo |
| Validación | Zod |
| Sesión Supabase | `@supabase/ssr` con `proxy.ts` |
| Migraciones y tipos | Supabase CLI, `supabase gen types` |
| Excel | `xlsx` no se agrega sin revisar licencia y alternativas al implementar RF-REP-04 |
| Pruebas | Vitest, pgTAP (`supabase test db`), Playwright |
| Calidad | ESLint de Next, Prettier, gitleaks |
| CI | GitHub Actions |

Versiones exactas se fijan en el scaffold. Reglas de uso en `docs/estandares-codigo.md` y `docs/plan-pruebas.md`.

### Condiciones de la decisión

- **Backups, obligatorios antes de producción:**
  - GitHub Actions con cron diario y `supabase db dump`, que incluya `auth.users` (verificarlo).
  - Dump cifrado (`age`/`gpg`) y guardado fuera de Supabase.
  - **Prueba de restauración** en un proyecto aparte: login OK y stock = `sum(kardex)`.
- **Pasar a Supabase Pro** si el proyecto se pausa alguna vez, si se acerca a 500 MB o si el negocio lo justifica.
- **Vercel Hobby:**
  - El CTO acepta el riesgo de los términos (prohíben uso comercial; tener dominio propio no cambia eso).
  - Mitigación recomendada: una cuenta Vercel separada para este cliente, para que una suspensión no arrastre a
    Elegance ni a otros proyectos.
  - Mitigación recomendada: un despliegue reproducible, que se pueda mover a Vercel Pro o a Cloudflare en horas.
- Cupo del Free: máximo 2 proyectos activos por organización. Revisar si ya está ocupado.

## Análisis previo (antes de la decisión del CTO)

La propuesta inicial era Supabase Pro + Vercel Pro (~$45/mes). El CTO eligió Free/Hobby aceptando los riesgos de
abajo.

- **Riesgo de Supabase Free:** no tiene backups automáticos y se pausa tras ~7 días de baja actividad. Para un
  sistema con dinero y stock, inaceptable sin backups propios.
  - Pro incluye backups diarios con 7 días de retención y no se pausa.
  - PITR ($100/mes) no hace falta de entrada.
  - Fuentes: https://supabase.com/pricing, https://supabase.com/docs/guides/platform/free-project-pausing
- **Riesgo de Vercel Hobby:** su definición de uso comercial incluye a un consultor que cobra por el código.
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
