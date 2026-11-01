# Estándares de código

Reglas verificables para `web/`, `supabase/` y `scripts/`. Lo que una herramienta puede imponer, lo impone CI.

## Principios

- Primero lo más simple que cumpla el requisito. Sin abstracciones ni opciones para un futuro hipotético.
- Reutilizar antes de escribir: módulo existente, librería instalada, plataforma.
- Tres casos iguales justifican una abstracción. Dos, no.
- Borrar código muerto. El historial está en git.

## TypeScript

- `strict: true`, más `noUncheckedIndexedAccess`. Sin `any`; `unknown` más Zod en los bordes.
- `@ts-ignore` prohibido. `@ts-expect-error` solo con comentario del motivo.
- Tipos de base generados por `supabase gen types`. No se escriben a mano.
- Todo dato externo (formulario, URL, cola local, respuesta de RPC con `jsonb`) pasa por un schema Zod.
- Funciones que pueden fallar de forma esperada devuelven `{ ok: true, data } | { ok: false, error }`.
- Dinero nunca en `number` para sumar: las cifras definitivas las calcula Postgres. Para pantalla, centavos enteros
  en `modules/*/domain.ts`.

## Nombres

- Dominio en español, sin tildes: `venta`, `cajaSesion`, `registrarVenta`.
- Términos técnicos en inglés: `schema`, `query`, `hook`.
- Componentes `PascalCase`; archivos de componente `kebab-case.tsx`; SQL `snake_case`.
- Booleanos con prefijo `es`, `tiene` o `puede`.
- Sin abreviaturas inventadas: `cantidad`, no `cant`.

## React y Next.js

- Server Components por defecto. `"use client"` solo donde hay estado o eventos.
- Lecturas en `queries.ts`; mutaciones en `actions.ts`.
- Una server action valida con Zod, llama una RPC y revalida. Nada más.
- El POS es la excepción: es cliente y usa la cola de `lib/offline`.
- Componentes de más de 200 líneas se dividen.
- `useEffect` no se usa para derivar estado ni para traer datos.
- UI con shadcn y tokens de Tailwind. Iconos de `lucide-react`, el set de shadcn; no SVG inventados.
- Trabajo visual con los skills `impeccable` o `design-taste-frontend`, y auditoría con `web-design-guidelines`.
- Estados de carga, vacío y error explícitos en cada pantalla.

## Límites de módulos

- `app/` importa módulos por su `index.ts`.
- Un módulo importa a otro solo por su `index.ts`. Sin ciclos.
- Excepción: un módulo con server actions las expone en `panel.ts`, segunda entrada solo para páginas del panel. Así no
  entran al bundle precacheado de `/pos`.
- `lib/` no importa `modules/`.
- ESLint lo impone con `no-restricted-imports`.

## SQL

- Una migración por cambio, con nombre descriptivo. Una migración aplicada no se edita.
- Toda tabla nueva: RLS activo y policies en la misma migración.
- Toda RPC: `security definer`, `set search_path = ''`, nombres calificados, `tiene_permiso` al inicio.
- Errores con `raise exception` y código propio que la app traduce a un mensaje en español.
- `numeric` para dinero y cantidades; nunca `float`.
- Toda RPC que recibe UUID del cliente es idempotente.
- Índices en toda FK usada en filtros y en `(negocio_id, created_at)`.

## Comentarios y logs

- Se comenta el porqué que el código no muestra, en una línea.
- Un atajo con límite conocido lleva: `shortcut: <límite>, <cuándo mejorar>`.
- Sin datos personales en logs, ni `console.log` en código mergeado.

## Dependencias

- Antes de agregar una: revisar si ya está resuelto. Nunca por pocas líneas.
- Versiones exactas en lockfile. Revisar la licencia y que tenga mantenimiento.

## Git y revisión

- Sin commits directos a `main`. Rama por cambio, `feat/`, `fix/`, `docs/`, `chore/`.
- Commits con Conventional Commits.
- PR chico, una sola intención. CI verde para mergear.
- Antes de mergear: `/code-review` y `/ponytail-review`; `/security-review` si toca auth, RLS o RPC;
  `/codex-debug verify-fix` en cada `fix:`.
- Un bug corregido deja un test que antes fallaba.

## Definition of Done

Una tarea termina cuando:

1. Cumple el criterio de aceptación de su RF.
2. Tiene las pruebas de `docs/plan-pruebas.md`.
3. CI está verde.
4. Las revisiones se aplicaron o quedaron registradas.
5. La UI se verificó en navegador real.
6. `docs/handoff.md` está al día.
