# Plan — Fase 0: Cimientos

Objetivo: login real, RLS probado y CI verde en PR. Requisitos: RF-TR-01 a RF-TR-05 y RF-TR-08. Hito y spike en
`docs/roadmap.md`.

Implementa Sonnet; el chairman revisa, verifica y cierra. Todo corre en local: no se crean proyectos en Supabase ni en
Vercel en esta fase. Sin datos reales del cliente.

## PRs, en orden

| # | Rama | Contenido | Se comprueba con |
|---|---|---|---|
| 1 | `chore/fase-0-scaffold` | `web/`, Supabase CLI, CI de 8 pasos, prueba humo en cada capa | CI verde |
| 2 | `feat/base-tenencia` | Tablas de tenencia, helpers, RLS, RPC, seed, pgTAP | `supabase test db`, DB-03 |
| 3 | `feat/auth-negocio` | Login, `proxy.ts`, shell, selector de negocio, permisos en UI | E2E-01, E2E-02, E2E-03 parcial |
| 4 | `feat/usuarios` | Edge Function `admin-usuarios`, pantallas de usuarios y dispositivos | Integración y E2E de usuarios |
| 5 | `chore/spike-service-worker` | Spike de `@serwist/turbopack`, resultado en `docs/stack.md` | `/pos` abre sin red; `/panel` sin SW |

PR 5 no depende de 2 a 4 y puede correr en paralelo tras PR 1.

## Decisiones

- **Puertos:** este equipo ya corre otros stacks Supabase en 54321-54327 y 55421-55427. Este proyecto usa 54420-54429.
  No se detienen stacks ajenos.
- **Supabase CLI:** `supabase` como devDependency de `web/`, versión exacta, igual en local y CI. `supabase/` queda en la
  raíz.
- **UI:** sin bake-off. El prototipo ya fija la dirección visual: se llevan sus tokens de `app/globals.css` a `web/`, y
  cada pantalla sigue el camino único de `impeccable`. No se copia su CSS de clases sueltas: Tailwind y shadcn.
- **Iconos:** `lucide-react`, el set de shadcn y del prototipo.
- **Negocio activo:** cookie validada en servidor contra los negocios del usuario. Es preferencia de UI: la seguridad
  sigue en RLS.
- **Permisos en UI:** se leen de `usuario_negocio`, `negocios` y `rol_permisos`. Ocultar es comodidad; decide la RPC.
- **Perfil:** trigger sobre `auth.users` crea `perfiles`, para que cuenta y perfil nazcan juntos.

## Reglas de seguridad de usuarios

Estas reglas cierran huecos que la matriz no resuelve sola. En lavandería el encargado tiene `usuarios`, y `activo` es
global a la cuenta.

1. Solo un `dueno` del negocio asigna el rol `dueno` o modifica a un `dueno`.
2. Nadie cambia su propio rol ni se quita a sí mismo.
3. Desactivar o reactivar una cuenta exige `usuarios` en **todos** los negocios de esa cuenta. Quien no los tiene usa
   `quitar_usuario`, que solo afecta a su negocio.
4. Una cuenta desactivada queda baneada en Auth y además `mis_negocios()` y `tiene_permiso()` la ignoran, porque su JWT
   sigue vivo hasta 1 hora.
5. `admin-usuarios` llama `asignar_usuario` con el JWT del llamador. Si falla, borra la cuenta recién creada.

`quitar_usuario` se suma al catálogo de RPC.

## Trampas

- Supabase da privilegios amplios por defecto en `public`, y Postgres da `EXECUTE` a `PUBLIC`. Cada tabla y función
  declara `revoke` y `grant` explícitos. Un test recorre `pg_class` y `pg_proc` y falla si `anon` puede escribir o
  ejecutar algo.
- `mis_negocios()` es `security definer`, así no entra en recursión con las policies de `usuario_negocio`.
- Service worker con alcance solo en `/pos`: el panel nunca debe quedar bajo su control.
- `proxy.ts` no debe interceptar el service worker ni estáticos.

## Pendiente para PR 3, de la revisión del scaffold

- `globals.css` solo tiene tokens del prototipo. Faltan los de shadcn (`popover`, `input`, `ring`, `secondary`,
  `destructive`) y el import `shadcn/tailwind.css`. Se agregan al instalar los primeros componentes.
- Sin CSP todavía. La sesión de `@supabase/ssr` queda en cookies que el navegador puede leer, así que PR 3 agrega CSP.
- Producción debe repetir lo de `config.toml`: registro público apagado, contraseña mínima y `auto_expose_new_tables`
  apagado. Va en la lista de la fase 6.

## Fuera de esta fase

- Restablecer contraseña: no está en el SRS. Hoy se haría desde Supabase.
- Primer dueño en producción: se crea en la fase 6 con un script y `service_role`.
- Auditoría de usuarios y permisos: RF-TR-09 entra en la fase 1.
- Vercel y proyecto Supabase remoto: fase 6.
