# Plan: SRS y documentos de planificación y desarrollo

## Contexto

Los formularios de Lider y lavandería ya están respondidos. Frial aún no abre. Toca convertir eso, el contrato y las
decisiones de `docs/handoff.md` en documentos que dejen implementar sin adivinar.

El CTO decidió que la v1 incluye todo lo pedido: contrato, crédito con cuotas y cuentas por cobrar, reservas con
anticipo, proveedores y sus deudas, y stock de insumos.

**Objeción registrada una vez:** ese alcance no entra razonablemente en 30 días ni en Bs 10.000. Se ejecuta completo.
La mitigación es de orden: primero lo contractual (Entrega A) y después los extras (Entrega B), para que el acta y el
saldo de Bs 5.000 no dependan de los extras.

Este plan solo produce documentos. No escribe código ni crea el scaffold.

## Documentos a entregar

Todos en `docs/`, en Markdown y en español. Se reutiliza lo que existe.

| Archivo | Acción | Contenido |
|---|---|---|
| `relevamiento.md` | Nuevo | Respuestas de Lider y lavandería, sin CI ni teléfonos. Fuente de requisitos versionada, hoy solo en Google y en el informe |
| `srs.md` | Nuevo | Propósito, alcance, actores, RF con ID y criterios de aceptación, reglas de negocio, RNF, fuera de alcance, preguntas abiertas y matriz de trazabilidad |
| `arquitectura.md` | Nuevo | Contexto, contenedores, módulos y sus límites, estructura de carpetas, flujos offline, seguridad y decisiones (formato ADR corto) |
| `plan-modelo-datos.md` | Actualizar | Cerrar los [FORM] y agregar tablas de extras, moneda y permisos |
| `estandares-codigo.md` | Nuevo | Código limpio y mantenible: reglas concretas, no principios genéricos |
| `plan-pruebas.md` | Nuevo | Estrategia, qué se prueba en cada capa, casos críticos, CI y criterios de salida |
| `migracion-datos.md` | Nuevo | Importación de los 597 productos, reglas de limpieza y pasos de arranque |
| `roadmap.md` | Nuevo | Fases, Entrega A y B, dependencias, riesgos y Definition of Done |
| `stack.md` | Actualizar | Librerías concretas y herramientas de prueba |
| `handoff.md` | Actualizar | Punteros y estado |
| `CLAUDE.md` (raíz del repo) | Nuevo | Máximo 15 líneas: dónde está cada documento y reglas que los subagentes deben seguir |

## Decisiones técnicas que fijan los documentos

**Estructura.** App nueva en `web/` y `supabase/` en la raíz. `sistema-de-gestion-multinacional/` queda como referencia
visual y no se pule.

```
web/src/app/(panel)/panel/...   web/src/app/(pos)/pos/...
web/src/modules/<modulo>/{schemas,queries,actions}.ts + components/
web/src/lib/   supabase/migrations/   supabase/tests/
```

Módulos: catálogo, inventario, ventas, caja, clientes, crédito, reservas, compras, lavandería, reportes, usuarios.
Un módulo solo importa otro por su `index.ts`.

**Dónde vive cada regla.** Toda escritura sensible va por RPC en Postgres. TypeScript valida con Zod en el borde y
usa funciones puras para cálculos de pantalla. Los tipos salen de `supabase gen types`, nunca a mano.

**Cambios al modelo de datos**

| Tema | Decisión |
|---|---|
| Moneda | `tipos_cambio` por negocio. Precio guardado en USD o Bs por producto; Bs calculado con el tipo vigente. Cobro solo en Bs. La venta guarda `tipo_cambio` |
| Offline y dólar | El snapshot del POS incluye el tipo de cambio. La venta conserva el que vio el vendedor |
| Permisos | `rol_permisos` por tipo de negocio. Roles `dueno`, `encargado`, `vendedor`, `contador`, `empleado` |
| Clientes | `negocio_id` obligatorio: no se comparten |
| Consolidado | Se quita del panel |
| Serie | `controla_serie` por producto. Sirve con cualquier respuesta del cliente |
| Lavandería | 4 estados más `cancelada`, cobro al recibir, `recibida_por` |
| Crédito | `creditos`, `credito_cuotas`, `credito_pagos`. Parámetros por negocio, no fijos en código |
| Reservas | `reservas`, `reserva_pagos`. La reserva aparta stock con movimiento propio del kardex |
| Proveedores | Se conserva `compras`. Se agrega `proveedor_pagos` para las deudas |
| Insumos | Se reutiliza `productos` con `tipo = insumo` y kardex, con movimiento `consumo`. Sin módulo aparte |
| Frial | Ventas por peso e inventario. `lotes` y `despieces` fuera de la v1 |
| Impresión | Nota por impresión del navegador o PDF. Sin ESC/POS ni apertura de cajón; el cajón se abre a mano |
| Lector | USB como teclado, sin integración |

**Fuera de la v1:** factura electrónica, recordatorios por WhatsApp, fotos de daños, integración con balanza, lotes y
despiece, tienda online.

**Herramientas.** Vitest para lógica pura. pgTAP con `supabase test db` para RPC, RLS y triggers. Playwright para E2E,
incluida la venta sin conexión con `context.setOffline`. ESLint de Next, Prettier y TypeScript `strict`. pnpm. GitHub
Actions corre lint, `tsc`, Vitest, pgTAP, build y Playwright en cada PR.

**Cobertura.** Sin porcentaje global, que premia tests vacíos. Es obligatorio probar cada RPC y cada policy de RLS, y
las 6 verificaciones de `plan-modelo-datos.md` más las nuevas de crédito, reservas y tipo de cambio.

**Fases de `roadmap.md`**

| Fase | Contenido | Entrega |
|---|---|---|
| 0 | Scaffold, CI, migraciones, auth, RLS, spike del service worker | A |
| 1 | Catálogo, inventario, kardex, tipo de cambio, importación de Lider | A |
| 2 | POS con conexión, caja, anulación y devolución | A |
| 3 | Venta y órdenes sin conexión | A |
| 4 | Lavandería | A |
| 5 | Frial por peso, reportes, usuarios, PWA | A |
| 6 | Backups con restauración probada, publicación, acta | A |
| 7 | Crédito, reservas, proveedores, insumos | B |

El roadmap da duración relativa, porque el plazo arranca al recibir precios e inventario.

## Pasos

1. Guardar este plan en `docs/plan-documentacion.md` y agregar el puntero en `docs/handoff.md` (regla 8).
2. Crear la rama `docs/srs-y-planificacion`.
3. Escribir `relevamiento.md` desde las respuestas leídas. Es la base del resto.
4. Escribir `srs.md`.
5. Actualizar `plan-modelo-datos.md` y escribir `arquitectura.md`.
6. Escribir `estandares-codigo.md`, `plan-pruebas.md` y `migracion-datos.md`.
7. Escribir `roadmap.md`, actualizar `stack.md` y crear `CLAUDE.md`.
8. Lanzar un subagente Sonnet que audite la trazabilidad contra contrato, relevamiento y modelo. Corregir lo que encuentre.
9. Commit, push y PR. Mergear con CI verde o sin checks, actualizar `handoff.md` (reglas 3 a 5).

## Archivos críticos

- Fuentes: `docs/handoff.md`, `docs/plan-modelo-datos.md`, `docs/stack.md`,
  `/home/shadowfreak/Downloads/Contrato_ERP_Hinojosa_Claros.docx`, informe
  https://claude.ai/artifact/DJeZuyDC3x9TZpnPtqyK39
- Referencia: `sistema-de-gestion-multinacional/` (Next 16.4.0, React 19, Tailwind 4, shadcn).

## Trampas

- **Datos personales:** `relevamiento.md` va al repo sin CI, teléfonos ni nombres de empleados (cláusula decimotercera).
- **Garantía de 5 años (cláusula novena):** cubre lo comprendido en el alcance. Si los extras se suman, el SRS debe
  dejar claro si entran en esa garantía. Recomendación: registrarlos por escrito como adenda o en el acta, y marcarlo
  como decisión pendiente del CTO.
- **Plazo:** sumar extras no cambia los 30 días del contrato. Entrega A debe cumplirlo por sí sola.
- **Crédito:** falta saber si el 2,5 % mensual es sobre saldo o sobre el total. Bloquea el cálculo de cuotas.
- **Redondeo de Bs:** falta la regla al convertir desde USD. Va a preguntas abiertas.
- **Contradicciones:** las 7 de Lider y 3 de lavandería entran en preguntas abiertas, con supuesto por defecto para que
  no frenen el diseño.
- **Vercel Hobby y Supabase Free:** más módulos no cambian el riesgo aceptado, pero el SRS debe exigir backups antes de
  producción, porque habrá saldos de crédito.
- **Rutas:** el directorio de trabajo cambió a `sistema-de-gestion-multinacional/`. Usar rutas absolutas o `git -C`.

## Verificación

- Cada ítem de la cláusula tercera y cada extra tiene al menos un RF.
- Cada RF tiene ID, origen (contrato, formulario o decisión) y criterio de aceptación comprobable.
- Cada RF tiene tabla o RPC en el modelo, y fase en el roadmap.
- `grep '\[FORM\]' docs/plan-modelo-datos.md` no devuelve pendientes sin decisión; frial queda marcado como diferido.
- Cada RPC y policy tiene caso en `plan-pruebas.md`.
- `grep` de CI y teléfonos del cliente en `docs/` no devuelve datos personales.
- Enlaces entre documentos resuelven a archivos existentes.
- Solo se tocan `docs/` y `CLAUDE.md`: `git diff --stat main` lo confirma. Commits solo-docs saltan la revisión de código
  (regla 2).
