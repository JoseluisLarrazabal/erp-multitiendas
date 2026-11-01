# Plan de pruebas

La confianza sale de probar las reglas de dinero y stock donde viven: en Postgres. No hay meta de cobertura global.
Cada RPC y cada policy tienen casos obligatorios.

## Capas

| Capa | Herramienta | Qué cubre | Cuándo |
|---|---|---|---|
| Base | pgTAP con `supabase test db` | RPC, RLS, triggers, reconciliación | Cada PR |
| Unidad | Vitest | `domain.ts`, schemas Zod, cola offline, formatos | Cada PR |
| E2E | Playwright | Flujos críticos en navegador real | Cada PR |
| Estáticas | ESLint, `tsc`, Prettier | Tipos, límites de módulos, formato | Cada PR |
| Secretos | gitleaks | Claves en el repo | Cada PR |
| Dependencias | `pnpm audit` | Vulnerabilidades altas | Semanal |
| Accesibilidad | `web-design-guidelines`, `impeccable audit` | RNF-14 | Antes de cerrar UI |
| Restauración | Simulacro manual | RNF-08 y RNF-09 | Antes de producción y trimestral |

Sin mocks de la base: las pruebas de RPC corren contra Supabase local. Se simula solo lo externo.

## Base: casos obligatorios

### Reglas generales para toda RPC

Cada una de las RPC de `docs/plan-modelo-datos.md` debe probar:

1. Camino feliz con el efecto esperado.
2. Rechazo sin permiso.
3. Rechazo a un usuario de otro negocio.
4. Rechazo con datos inválidos.
5. Idempotencia, si recibe UUID del cliente.

La Edge Function `admin-usuarios` cumple los mismos casos 1 a 4, con prueba de integración contra Supabase local.

### Reglas generales para toda tabla

- Un usuario lee solo su negocio.
- Un usuario sin sesión no lee nada.
- Tablas contables rechazan `INSERT`, `UPDATE` y `DELETE` directos.
- Un test recorre `pg_tables` y falla si una tabla de `public` no tiene RLS.

### Casos específicos

| ID | Caso | Requisito |
|---|---|---|
| DB-01 | La misma venta enviada 2 veces deja 1 fila y 1 serie de movimientos | RF-VEN-09 |
| DB-02 | `UPDATE` y `DELETE` en `movimientos_inventario` fallan | RF-INV-02 |
| DB-03 | Un usuario del negocio A no lee ni escribe en B | RF-TR-03 |
| DB-04 | `stock` = suma del kardex tras ventas, entradas, anulaciones y ajustes; en la Entrega B, también compras y reservas | RF-INV-08 |
| DB-05 | Un rol sin `anular` no puede llamar `anular_venta` | RF-VEN-06 |
| DB-06 | `cerrar_caja` calcula el esperado con pagos mixtos, gastos y retiros | RF-CAJ-03 |
| DB-07 | Precio en USD cambia en Bs al registrar un tipo de cambio nuevo | RF-CAT-06 |
| DB-08 | Una venta pasada conserva su precio y tipo de cambio | RN-02 |
| DB-09 | `precio_bs` redondea según P-08 | RF-CAT-05 |
| DB-10 | Costo promedio correcto tras 2 entradas con costos distintos | RN-06 |
| DB-11 | Ventas con kg guardan 3 decimales y total con 2 | RF-FRI-01 |
| DB-12 | Stock negativo se permite y aparece en reconciliación | RN-04 |
| DB-13 | Descuento sobre el tope se rechaza | RF-VEN-03 |
| DB-14 | Devolución después de 24 h se rechaza sin `devolver_fuera_plazo` | RN-08 |
| DB-15 | Producto con serie exige serie disponible; no se vende 2 veces | RF-CAT-07 |
| DB-16 | Traslado no cambia el stock total | RF-INV-05 |
| DB-17 | Conteo genera ajustes solo donde hay diferencia | RF-INV-06 |
| DB-18 | Orden repetida no se duplica | RF-LAV-09 |
| DB-19 | Una transición de estado inválida se rechaza y cada cambio deja evento | RF-LAV-04 |
| DB-20 | Sesión de caja de un negocio no afecta a otro | RF-CAJ-04 |
| DB-21 | Cuotas suman capital más interés, según P-07 | RF-CRE-02 |
| DB-22 | Pago parcial y total actualizan el saldo; pagar de más se rechaza | RF-CRE-04 |
| DB-23 | Reserva descuenta disponible; completar no descuenta 2 veces | RF-RES-02 |
| DB-24 | Cancelar reserva libera stock y registra devolución | RF-RES-03 |
| DB-25 | Compra a crédito aumenta deuda; pago la reduce | RF-COM-03 |
| DB-26 | Consumo de insumo baja stock y suma al gasto | RF-INS-02 |
| DB-27 | Cambios de precio quedan en `auditoria` | RF-TR-09 |

## Unidad

- `domain.ts` de cada módulo: totales de carrito, descuentos, cambio, formato `Bs 1.234,50`.
- Schemas Zod: acepta lo válido, rechaza lo inválido.
- Cola offline: orden, reintento, conservación ante error de validación.
- Script de importación: cada regla de `docs/migracion-datos.md`.

## E2E

| ID | Flujo | Requisito |
|---|---|---|
| E2E-01 | Login y redirección sin sesión | RF-TR-01 |
| E2E-02 | Selector de negocio cambia los datos visibles | RF-TR-02 |
| E2E-03 | Vendedor no ve costos; dueño sí | RF-TR-05 |
| E2E-04 | Venta con conexión, pago mixto y nota | RF-VEN-01, RF-VEN-02, RF-VEN-05 |
| E2E-05 | Venta con `context.setOffline`, aviso y envío al reconectar sin duplicar | RF-VEN-09, RF-VEN-10 |
| E2E-06 | Recargar el POS sin conexión lo abre y conserva la cola | RF-VEN-09 |
| E2E-07 | Cierre de caja bloqueado con cola pendiente | RN-07 |
| E2E-08 | Búsqueda con lector simulado por teclado y 2.000 productos | RF-CAT-03, RNF-01 |
| E2E-09 | Orden de lavandería de recepción a entrega | RF-LAV-02 a RF-LAV-06 |
| E2E-10 | Venta por peso en frial | RF-FRI-01 |
| E2E-11 | Exportar un reporte a Excel | RF-REP-04 |
| E2E-12 | Venta a crédito y pago de cuota | RF-CRE-01, RF-CRE-04 |
| E2E-13 | Reserva y conversión en venta | RF-RES-02 |

## Datos de prueba

- `supabase/seed.sql` crea 3 negocios, un usuario por rol y un catálogo chico. Sin datos reales del cliente.
- Cada test SQL corre en transacción y hace rollback.
- E2E crea sus datos y no depende del orden.
- Para RNF-01 se genera un catálogo sintético de 2.000 productos.

## CI

GitHub Actions, en cada PR:

1. `pnpm install --frozen-lockfile`.
2. ESLint, Prettier y `tsc --noEmit`.
3. gitleaks.
4. Vitest.
5. `supabase start`, migraciones desde cero, `supabase test db`.
6. Tipos generados sin diferencias.
7. `next build`.
8. Playwright, con trazas guardadas si falla.

## Criterios de salida

**Por PR:** CI verde; casos nuevos para cada RPC, policy o flujo que cambie.

**Entrega A:**

- DB-01 a DB-20, DB-27 y E2E-01 a E2E-11 en verde.
- Prueba manual en los equipos reales del cliente, con lector.
- Importación de Lider con stock total conciliado.
- Simulacro de restauración aprobado: login correcto y `stock` = suma del kardex.
- 3 días de operación en paralelo con el cuaderno sin diferencias sin explicar.

**Entrega B:** DB-21 a DB-26 y E2E-12 a E2E-13 en verde; créditos iniciales conciliados con el cliente.

## Defectos

| Severidad | Ejemplo | Regla |
|---|---|---|
| Crítica | Datos de otro negocio visibles, venta perdida o duplicada, stock o caja incorrectos | Bloquea entrega |
| Alta | Flujo principal roto sin alternativa | Bloquea entrega |
| Media | Flujo con alternativa | Se agenda |
| Baja | Texto o estética | Se agenda |
