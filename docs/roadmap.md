# Roadmap

La v1 se entrega en 2 partes. La Entrega A cumple el contrato y habilita el acta. La Entrega B suma crédito, reservas,
proveedores e insumos, por decisión del CTO del 2026-11-01.

**Riesgo aceptado:** el alcance total no entra razonablemente en 30 días ni en Bs 10.000. El orden protege lo
contractual: si el tiempo falta, se recorta B, nunca A.

## Estado al 2026-11-11

Fases 0 a 7 cerradas en código y en producción. Después vinieron la auditoría previa a la entrega y dos planes más.
Estado y evidencia, detalle en `docs/handoff.md`:

| Fase o plan | Estado | Evidencia |
|---|---|---|
| 0 a 6 (Entrega A) | Cerradas en código y en producción | Historial del handoff; auditoría de la Entrega A cerrada con #91 |
| 7 Extras (Entrega B) | Cerrada el 2026-11-09 | #83 compras, #86 insumos, #87 reservas, #88 crédito |
| Preentrega (`plan-preentrega.md`) | Culminado el 2026-11-10 | #95 bloqueantes, #97 Entrega B, #99 operación diaria, #101 documentos |
| Registro de errores (M-15, RNF-16) | En producción desde el 2026-11-10 | #103 (`543824d`) |
| Rediseño visual y tablero | En producción desde el 2026-11-11, en un solo PR | #109 (`ee132a7`) |
| Verificación (fase 2 del plan paralelo-rediseño) | Pendiente: hardware real y QA de roles en producción (en curso) | Handoff |
| Paralelo y acta | Sin fecha | Depende de las cargas del cliente |

- El objetivo de "terminar en 2 semanas" fijado el 2026-11-01 venció sin replanteo.
- El plazo contractual, contado desde la firma del 2026-11-01, vence el 2026-12-01. La cláusula también lo cuenta desde
  la recepción de la información, que sigue incompleta.
- La fecha de inicio del paralelo no está fijada en ningún documento: la decide el CTO.

## Fases

Las duraciones son estimaciones del plan, en días de trabajo, sin validar con velocidad real. El plazo contractual
arranca con la firma y la recepción de precios e inventario; ver D-03 y D-04 en `docs/srs.md`. El contrato se firmó el
2026-11-01 (D-04).

| Fase | Entrega | Contenido | Requisitos | Estimación | Depende de |
|---|---|---|---|---|---|
| 0 Cimientos | A | Scaffold, CI, migraciones base, auth, RLS, usuarios, spike de service worker | RF-TR-01 a RF-TR-05, RF-TR-08 | 3 | Stack |
| 1 Catálogo e inventario | A | Productos, precios, tipo de cambio, kardex, ubicaciones, auditoría, importación | RF-CAT-*, RF-INV-*, RF-MIG-*, RF-TR-09 | 6 | Fase 0 |
| 2 POS y caja | A | Venta, pagos, descuentos, nota, anulación, devolución, caja, clientes | RF-VEN-01 a RF-VEN-08, RF-CAJ-*, RF-CLI-* | 5 | Fase 1 |
| 3 Sin conexión | A | Cola, snapshot, service worker, reconciliación | RF-VEN-09 a RF-VEN-14 | 4 | Fase 2 |
| 4 Lavandería | A | Servicios, órdenes, estados, cobro, entrega | RF-LAV-* | 4 | Fases 2 y 3 |
| 5 Frial, reportes y PWA | A | Venta por peso, reportes, Excel, instalación, panel responsive | RF-FRI-*, RF-REP-*, RF-TR-06, RF-TR-07 | 5 | Fases 2 y 4 |
| 6 Salida | A | Backups, restauración, dominio, carga real, capacitación, paralelo, acta | RF-TR-10, RNF-08, RNF-09, RNF-12 | 3 | Todo lo anterior |
| 7 Extras | B | Crédito, reservas, proveedores, insumos | RF-CRE-*, RF-RES-*, RF-COM-*, RF-INS-* | 10 a 15 | Fase 6; D-01, P-07 y P-12 |

Entrega A suma 30 días de trabajo y el contrato da 30 días **calendario**. Decisión del CTO (2026-11-01): se trabaja
todos los días, sin descansos, así que el plan entra justo y sin margen. Un solo día perdido se recupera adelantando:
fases 0 a 3 y 5 no necesitan al cliente, salvo la importación, y pueden empezar antes de que corra el plazo. El panel
crece desde la fase 1; la fase 5 cierra su versión responsive.

Objetivo del CTO (2026-11-01): terminar en 2 semanas como máximo, con trabajo diario. Contrato firmado. Las estimaciones
de la tabla no se recalculan. La fase 5 suma RF-FRI-04 a 07 y queda sin validar en esa misma estimación.

## Orden dentro de cada fase

1. Migración con RLS y pruebas pgTAP.
2. RPC con sus casos.
3. Módulo: schemas, queries y actions.
4. Pantallas.
5. E2E del flujo.
6. Revisión y PR.

Cada PR queda desplegable. Lo incompleto no se muestra en navegación.

## Hitos

| Hito | Se comprueba con |
|---|---|
| Cimientos listos | Login real, RLS probado, CI verde en PR |
| Venta real con kardex | E2E-04 y DB-01, DB-04 |
| Venta sin conexión | E2E-05 y E2E-06 |
| Entrega A | Criterios de salida de `docs/plan-pruebas.md` y acta firmada |
| Entrega B | Criterios de salida de `docs/plan-pruebas.md` |

## Spike de la fase 0

Duración máxima: 1 día. Confirmar `@serwist/turbopack` con Next 16. Si falla, service worker manual con `src/sw.ts` y
esbuild, según `docs/stack.md`. Resultado escrito en ese mismo archivo.

## Bloqueos del cliente

Detalle en `docs/migracion-datos.md` y en la sección 7 del SRS. El cliente carga sus precios en el sistema (CTO, 2026-11-01):
la importación no los espera.

| Bloqueo | Frena |
|---|---|
| Precios y costos de Lider, cargados por el cliente en el panel | Arranque |
| Respuestas P-02 a P-05 | Corrida final de la importación; corre antes con supuestos |
| Servicios y precios de lavandería, cargados por el cliente en el panel | Uso real de lavandería; no frena el desarrollo |
| Productos con serie y tope de descuento, cargados por el cliente en el panel | Uso real; no frena el desarrollo |
| P-07 interés de crédito | Fase 7 |
| P-12 anticipo de reservas | Fase 7 |

## Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Alcance mayor al contrato | Atraso, costo no pagado | Fases A y B, adenda (D-01) |
| Entrega A excede 30 días calendario | Incumplimiento de plazo | Trabajo diario (decisión CTO) y adelantar fases sin cliente antes de que corra el plazo |
| Cliente no entrega precios | Sin arranque | Aviso escrito (D-03); plazo ampliado por cláusula quinta |
| Frial sin abrir | Acta discutida | Acuerdo escrito (D-02) |
| Service worker con Turbopack | Fase 3 se alarga | Spike en fase 0 |
| Pérdida de ventas sin enviar | Dinero sin registrar | Aviso visible, cierre bloqueado |
| Supabase Free pausado o sin backup | Pérdida de datos | Backups, prueba de restauración, paso a Pro |
| Suspensión de Vercel Hobby | Sistema caído | Cuenta separada, despliegue reproducible |
| Garantía de 5 años sobre extras | Soporte sin pago | Definir en D-01 |
| Personal poco habituado | Errores de uso | Capacitación y 3 días en paralelo |
| Datos sucios | Duplicados, stock erróneo | Reglas y conciliación de `docs/migracion-datos.md` |

## Definition of Done

Por tarea: `docs/estandares-codigo.md`. Por entrega: criterios de salida de `docs/plan-pruebas.md`.

## Mantener este documento

Al cerrar cada fase: estado y fecha en `docs/handoff.md`, y ajuste de estimaciones con lo que realmente tardó.
