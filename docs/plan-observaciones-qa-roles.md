# Plan: observaciones del QA de roles (2026-11-12)

Aprobado por el CTO el 2026-11-12. Estado y avance: `docs/handoff.md`.

## Contexto

El QA de roles en producción (`docs/qa-roles-produccion.md`, tres pasadas, sin desvíos) dejó cuatro observaciones
menores. El CTO pidió el 2026-11-12 un plan de implementación con mis recomendaciones. El paralelo no se toca: se
espera a que el cliente avise (cargas, páginas llenas y fecha).

Resultado buscado: cerrar lo que es barato y seguro antes de que el cliente empiece a usar el sistema, tener una
respuesta con evidencia sobre el cuelgue de "Cajas", y dejar escrito lo que se pospone y por qué.

## Alcance decidido

| N.º | Observación | Decisión |
|---|---|---|
| 1 | Vendedor y empleado leen por la API ventas y cajas de todo el negocio | **No se implementa ahora.** Se anota como mejora posterior a la entrega, con notas de diseño |
| 2 | "Cajas" del panel se colgó 30 s una vez, sin reproducir | **Diagnóstico con evidencia**; arreglo solo si aparece una causa |
| 3 | El contador abre "Créditos" de lavandería por dirección directa | **Arreglo chico**, con prueba |
| 4 | Cuenta desactivada recibe "Correo o contraseña incorrectos" | **Sin cambio de código**; una línea en el manual del dueño |
| — | Paralelo | **En espera del cliente.** Nada que hacer hasta que avise |

## Paso 0. Guardar el plan (regla 8)

Antes de tocar código: volcar este plan a `docs/plan-observaciones-qa-roles.md` y anotarlo en la sección de
reanudación de `docs/handoff.md` (hito activo, estado, enlace). Va en el mismo PR de documentación del paso 1.

## Paso 1. PR de documentación (lo escribe el chairman; solo docs, sin revisión de código)

Rama `docs/plan-observaciones-qa`.

- `docs/plan-observaciones-qa-roles.md`: este plan.
- `docs/handoff.md`:
  - puntero al plan en "Próxima sesión";
  - **paralelo en espera del cliente** (decisión del CTO del 2026-11-12): no se fija fecha hasta que el cliente avise;
    se mantiene la advertencia del plazo del contrato (2026-12-01);
  - mejora pospuesta (observación 1) con sus notas de diseño (ver abajo).
- `docs/manual/encargado-y-dueno.md`, bloque "**Desactivar o quitar.**" (línea ~751): una viñeta nueva. Texto:
  "Una persona desactivada que intenta entrar ve 'Correo o contraseña incorrectos', igual que con una clave
  equivocada: la pantalla no dice que la cuenta está desactivada. Si alguien avisa que su clave dejó de funcionar,
  revisar primero aquí si figura como desactivada."
  - Los PDF del manual no se versionan (`docs/manual/dist/`): se regeneran antes de entregarlos, como ya dice el
    handoff. No se regeneran en este PR.
- `docs/qa-roles-produccion.md`: en cada observación, una línea con la decisión tomada y el enlace al plan.

**Notas de diseño de la mejora pospuesta (observación 1), para quien la tome después:**

- Qué sería: en `ventas`, `venta_items`, `venta_pagos`, `devoluciones` y `caja_sesiones`, que los roles sin panel
  (vendedor, empleado) lean solo lo propio (ventas que hicieron, cajas que abrieron). Quien tenga `ver_reportes` o
  `anular` sigue leyendo todo el negocio.
- Por qué se pospone: es un cambio de reglas de lectura sobre tablas de dinero; el riesgo actual es bajo (hace falta
  usar la API a mano con la sesión propia; la pantalla no lo muestra) y un error rompe el punto de venta en pleno
  paralelo.
- Trampas conocidas: la caja es del equipo, no de la persona (un cajero ve y cierra la caja que otro abrió en el
  mismo equipo: `caja_sesion_abierta`); "Cuotas" y "Reservas" del punto de venta cobran operaciones que inició otra
  persona; la devolución usa "Caja que devuelve"; la cola sin conexión reenvía ventas y relee su resultado.
- Cuando se haga: plan propio con Opus, pgTAP por rol, y `/security-review`.

## Paso 2. Arreglo: "Créditos" solo en tienda y frial (observación 3)

Lo implementa un subagente Sonnet en un worktree (`/home/shadowfreak/Documents/wt-fix-creditos-tipo`, rama
`fix/creditos-solo-tienda-frial`).

- Causa: `web/src/app/(panel)/panel/creditos/page.tsx` y `web/src/app/(panel)/panel/creditos/[id]/page.tsx`
  comprueban el permiso (`exigirAlgunPermiso(["gestionar_credito", "ver_reportes"])`) pero no el tipo de negocio. El
  menú sí lo hace (`web/src/components/panel/panel-items.ts`, item `/panel/creditos`, `tipos: ["tienda", "frial"]`).
- Arreglo: el mismo patrón de una línea que ya usan `panel/ordenes/page.tsx:30`
  (`if (activo.tipo !== "lavanderia") redirect("/panel")`) y `panel/inventario/vencimientos/page.tsx:22`. En las dos
  páginas de créditos, después de `exigirAlgunPermiso`: si `activo.tipo` es `lavanderia`, `redirect("/panel")`.
  Sin ayudante nuevo ni abstracción: dos líneas, igual que el resto del panel.
- Barrido corto incluido en el brief: comparar los items con `tipos` de `panel-items.ts` contra la guarda de su
  página (y de sus subpáginas `[id]`); si otra ruta tiene el mismo hueco, se arregla en este PR con el mismo patrón y
  se lista. El QA solo encontró esta.
- Prueba: un caso e2e con el contador (o el encargado) en lavandería que abre `/panel/creditos` y termina en
  `/panel`. Se agrega junto a la prueba que ya cubre la redirección de `/panel/ordenes` fuera de lavandería (el
  subagente la ubica; hay specs de créditos en `web/tests/e2e/credito.spec.ts`).
- Verificación local: typecheck, lint, prettier, vitest y el spec tocado bajo `flock` (entorno compartido: una base
  y un puerto; script base `~/.cache/erp-recupera/fix-cierre/verificar.sh`).
- Revisión antes de mergear (regla 2), desde la sesión principal con el PR como objetivo: `/code-review` y
  `/ponytail-review`. `/security-review`: sí, toca control de acceso. Codex `verify-fix`: no verificado (sin cuota),
  se registra en el PR y en el handoff.
- Cierre: commit sin atribución de IA → push → PR → CI verde (`ci`, `importacion`, `gitleaks`) → merge → borrar rama
  y worktree.
- Verificación en producción tras el despliegue: el CTO no tiene que hacer nada; reactivo "QA Encargado (prueba)"
  con la sesión del dueño (Playwright), le pongo rol contador solo en Lider Clean, abro `/panel/creditos` y
  compruebo que vuelve a `/panel`; devuelvo el rol y desactivo la cuenta. Son escrituras solo sobre la cuenta de
  prueba, ya aprobadas en esta sesión para ese fin.

## Paso 3. Diagnóstico del cuelgue de "Cajas" (observación 2)

Hecho observado: 2026-11-12, 13:37 UTC (09:37 hora de Bolivia), cuenta de encargado, `/panel/cajas` justo después de
cerrar una caja con una venta: `page.goto` agotó 30 s con "Cargando…" en pantalla (el `loading.tsx` del panel). A las
17:52 UTC la misma ruta cargó en 879 ms sin errores de consola ni de red. Evidencia:
`~/.cache/erp-recupera/qa-roles/capturas-venta/paso13-error.png` y `paso13-aria.txt`.

1. **Evidencia de producción (la consulta la corre el CTO; es de solo lectura).** `errores_app` no es legible desde
   la web. En el editor SQL de Supabase:
   ```sql
   select created_at, origen, codigo, left(mensaje, 200) as mensaje, contexto
   from public.errores_app
   where created_at >= '2026-11-12 12:40+00' and created_at < '2026-11-12 18:10+00'
   order by created_at;
   ```
   Y en Vercel, los registros de la función entre 13:36 y 13:40 UTC de ese día para la ruta `/panel/cajas`
   (duración, tiempo agotado, error). El MCP de Vercel no tiene acceso a ese equipo. El resultado no entra al repo si
   trae datos del cliente; se resume.
2. **Lectura de código (subagente Explore, solo lectura):** `web/src/app/(panel)/panel/cajas/page.tsx`,
   `web/src/modules/caja/` (lecturas de la lista), `web/src/app/(panel)/panel/loading.tsx` y
   `web/src/lib/supabase/` (`TIEMPO_ENVIO_MS`, `leerSesion`, `actualizarSesion`). Pregunta única: ¿hay alguna espera
   sin límite de tiempo en el servidor (consulta sin tope, renovación de sesión, bloqueo por la transacción de
   cierre) que pueda dejar la página sin terminar?
3. **Reproducción local (subagente Sonnet, bajo `flock`):** diez repeticiones de la secuencia vender → cerrar caja →
   abrir `/panel/cajas` como encargado en menos de 2 s, midiendo el tiempo de carga.
4. **Criterio de cierre:**
   - Si 1, 2 o 3 señalan una causa: arreglo en PR propio con el ciclo completo (Sonnet, revisiones, CI). Si la causa
     no cede al primer intento, diagnóstico de Opus en paralelo (regla 13; Codex sin cuota).
   - Si nada aparece: se cierra como incidente aislado, probable arranque en frío o red, y se deja una línea en
     `docs/paralelo.md` para vigilarlo durante el paralelo. No se cambia código a ciegas.
5. El resultado se escribe en `docs/qa-roles-produccion.md` y en el handoff (PR de documentación al final).

## Paso 4. Cierre

- `docs/handoff.md` al día: plan culminado o lo que quede abierto, y el plan pasa al registro de planes cerrados
  cuando termine.
- Compactar el contexto tras el último merge.

## Lo que espera al cliente (sin acción nuestra)

Fecha del paralelo, cargas (precios, NIT, catálogo de frial y lavandería, tope de descuento, usuarios), las dos
páginas llenas, y con eso repetir el QA de lo que hoy no tiene datos. Antes del paralelo, la limpieza con `--desde`
anterior o igual a `2026-11-12T08:46:00-04:00` (`docs/despliegue.md`).

## Orden y tamaño

1. PR de documentación (paso 0 y 1): minutos.
2. En paralelo: paso 2 (subagente Sonnet) y paso 3.2 y 3.3 (Explore y Sonnet). El 3.1 depende del CTO.
3. PR del arreglo de créditos; verificación en producción.
4. PR de documentación con el resultado del diagnóstico y el cierre.

Tres subagentes como máximo, uno por tarea, con el modelo explícito (Sonnet; Explore para la lectura).

## Verificación

- Paso 1: `gitleaks` verde; el manual muestra la viñeta nueva; el handoff enlaza el plan.
- Paso 2: prueba e2e nueva en verde y que falle contra `main` sin el arreglo; CI verde; en producción, contador en
  Lider Clean abre `/panel/creditos` y termina en `/panel`; en Multitienda Lider "Créditos" sigue abriendo.
- Paso 3: tabla de tiempos de las diez repeticiones; respuesta a la pregunta del código con archivo y línea; resumen
  de `errores_app` y de Vercel, o "no consultado" si el CTO no lo corre.
- No verificado de antemano: que no exista otra ruta con el mismo hueco (lo cubre el barrido del paso 2), y la causa
  del cuelgue.
