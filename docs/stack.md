# Stack — ERP Multitiendas

Estado: **decidido por el CTO** (2026-10-26). Los términos se revisaron el
2026-10-26 con las fuentes oficiales citadas abajo.

## Decisión

| Pieza | Elección | Costo |
|---|---|---|
| Framework | Next.js 16 (App Router), una sola app con `/panel` y `/pos` | — |
| Base y auth | Supabase **Free** + backups propios (ver abajo) | $0 |
| Hosting | Vercel **Hobby** + dominio propio | $0 + dominio |
| Service worker (POS) | `@serwist/turbopack` 9.5.13, solo precache, alcance `/pos` (spike cerrado, ver abajo) | — |
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

## Spike del service worker (2026-11-01)

**Decisión: `@serwist/turbopack` 9.5.13, fijada exacta.** Funciona con Next 16.4.3, Turbopack y `next build` de
producción. No hace falta el plan B (SW manual).

- **Verificado:** MIT, publicado en npm desde 2025-07, última versión 2026-10-04 (anterior 2026-07-22). Peers: `next >=14`,
  `react >=18`; `esbuild`, `typescript` y `esbuild-wasm` son opcionales. La doc existe hoy en
  https://serwist.pages.dev/docs/next/turbo (el 404 anterior ya no se reproduce). Instala sin saltar
  `minimumReleaseAge` de pnpm 11.
- **Dependencias añadidas:** `@serwist/turbopack`, `serwist` (el SW importa de ahí) y `esbuild` (lo usa el paquete en
  el build). `allowBuilds` marca `esbuild` y `@swc/core` en `false`: sus binarios llegan por paquetes opcionales y el
  build funciona sin sus scripts de instalación.
- **Cómo funciona:** no hay plugin de Turbopack; el SW se compila en un route handler estático
  (`src/app/(pos)/sw-pos/[path]/route.ts`) que lee `.next/static` al hacer `next build` y lo sirve en `/sw-pos/sw.js`.
  Código del SW: `src/sw.ts`. Registro: `SerwistProvider` en `src/app/(pos)/layout.tsx`, solo bajo `/pos`.
- **Alcance:** `registration.scope` termina en `/pos` (sin barra final, para que `/pos` mismo quede controlado). El SW
  vive en `/sw-pos/sw.js`, fuera de `/pos`, y `next.config` añade `Service-Worker-Allowed: /pos` (el paquete envía
  `/`; el valor de `next.config` lo sustituye). El panel nunca
  queda bajo el SW. **Ninguna ruta nueva puede empezar con `/pos` salvo `/pos` y sus hijos** (`/posx` quedaría en alcance).
- **Qué se precachea:** `.next/static/**` (js, css, woff2) y el HTML de `/pos`. Sin `runtimeCaching`: auth, Supabase y
  `/panel` pasan a la red, nunca se guardan. **No se usa `defaultCache` del paquete**: cachea con NetworkFirst todo lo
  que pasa, incluido Supabase.
- **Trampa del paquete (resuelta):** el route handler corre en paralelo al prerender, así que `pos.html` aún no existe al
  hacer el glob. Se añade `/pos` con `additionalPrecacheEntries: [{ url: "/pos", revision: randomUUID() }]`: una
  revisión por build garantiza HTML nuevo aun si los chunks no cambian. Precachea también chunks del panel (hoy
  pocos); acotar con `globPatterns` si pesa.
- **Precache nunca guarda una redirección:** Serwist copiaría la respuesta redirigida (el HTML de login) bajo la clave
  `/pos`. `src/sw-precache-guard.ts` (plugin `cacheWillUpdate`) hace fallar la instalación ante `redirected`, una URL
  final distinta o una respuesta no-ok.
- **`reloadOnOnline` apagado.** Por defecto el provider hace `location.reload()` al volver la red: perdería una venta
  a medias. Tampoco se usa `cacheOnNavigation`.
- **Actualización: `skipWaiting: false`, `clientsClaim: true`.** Un build nuevo se instala y espera; la versión vieja
  sigue sirviendo HTML y chunks consistentes con su propio precache hasta que se cierre la última pestaña del POS.
  Probado con dos builds seguidos: con la pestaña abierta quedan los dos precaches (23 entradas) y la pantalla vieja;
  al cerrarla y abrir `/pos` queda el nuevo y el viejo se limpia (19 entradas), y recarga sin red con el contenido
  nuevo. Forzar `skipWaiting` cambiaría el JS bajo una venta a medias. Con `skipWaiting` apagado una actualización solo
  se activa sin clientes, así que `clientsClaim` solo afecta a la primera instalación: deja controlada esa primera
  pestaña sin recargar.
- **Prueba:** `web/tests/e2e/pos-offline.spec.ts` (contra `next build` + `next start`, como CI): abre `/pos`, espera el
  SW, corta la red, recarga y ve la pantalla; `scope` termina en `/pos`; `/` no tiene `controller`; encabezados del SW; el JS y el CSS vienen del SW (`fromServiceWorker`), ninguna petición de `/_next` falla y React
  hidrató; un redirect en el precache de `/pos` impide instalar el SW. Plugin cubierto también en Vitest.

### Lo que deben respetar el PR 3 y la fase 3

- **PR 3 (`proxy.ts`):** el `matcher` debe excluir `/sw-pos/` (un redirect a login rompe la actualización del SW; los
  navegadores rechazan scripts de SW con redirect) y `/_next/static`, `/_next/image`, favicon. `/pos` debe seguir
  siendo estático: leer cookies o `headers()` en su `page`/`layout` lo vuelve dinámico y deja de ser precacheable.
  La guarda de sesión de `/pos` es **del cliente** (comprueba la sesión local y lee la cola); el proxy no corre sin
  red. Sin red, un `/pos` precacheado se abre aunque la cookie haya caducado: es el comportamiento deseado (la venta
  se guarda en la cola) y la RLS decide al sincronizar. Si, al instalar el SW, el proxy redirige `/pos`
  (usuario sin sesión), la instalación falla y se reintenta en la próxima carga; el layout registra siempre.
- **Enlaces de `/pos` a `/panel`:** con `<a>` o `location.assign`, nunca `next/link`: una navegación suave conserva el
  controlador del SW.
- **Fase 3:** el SW nuevo espera. Hay que mostrar "actualización disponible" y, con la cola vacía o en el cierre de
  caja, enviar `{ type: "SKIP_WAITING" }` al SW en espera y recargar (el provider ya soporta el mensaje). Mostrar también un aviso visible si el SW no quedó activo: un
  `register()` fallido hoy no muestra nada.
  Chunks cargados con `import()` dinámico dentro de `/pos` entran por el glob de `.next/static`, no hay que listarlos.
  Datos del snapshot (productos, precios) viven en IndexedDB, no en el SW.

### No verificado

- **Vercel:** el encabezado `Service-Worker-Allowed` se probó solo con `next start`; comprobarlo en el primer preview.
  Un `source` combinado `/, /pos` rompería el registro.
- **Safari y Firefox:** solo se probó Chromium.

## Riesgos abiertos

- **Elegance también corre en Vercel Hobby con uso comercial.** Ya existe el mismo riesgo de suspensión de la cuenta.
  Si se paga Pro para esta cuenta, conviene mover Elegance al mismo equipo Pro.
- Uso comercial en Workers Free: no confirmado (habría que leer el Self-Serve Subscription Agreement).
