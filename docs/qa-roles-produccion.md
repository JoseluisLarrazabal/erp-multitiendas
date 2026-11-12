# QA de roles en producción (2026-11-11)

Qué puede y qué no puede tocar un vendedor y un encargado en los tres negocios, comprobado en producción
(<https://erpmultitiendas.vercel.app>) en **solo lectura**. Lo pidió el CTO el 2026-11-11. Es el punto "QA con roles
en producción" de la fase 2 de `docs/plan-paralelo-rediseno.md`.

## Cómo se hizo

- Dos cuentas de prueba creadas por Claude desde "Usuarios" con la sesión del dueño: "QA Vendedor (prueba)" y
  "QA Encargado (prueba)", con el mismo rol en Multitienda Lider, Lider Clean y Frial Lider. Son las únicas escrituras
  de este QA. Las claves están en `~/.cache/erp-recupera/qa-roles/cuentas.json` (permisos 600, fuera del repo).
- Un script de Playwright con un navegador aislado por cuenta (`~/.cache/erp-recupera/qa-roles/qa.mjs` y `qa2.mjs`):
  3 negocios × 28 rutas × 2 cuentas, más lecturas directas a la API con el token de cada cuenta. Solo navegación,
  lectura y funciones de lectura. No se abrió caja, no se vendió, no se pulsó ningún botón que guarde.
- Salida: `resultado.json`, `resultado-extra.json` y seis capturas en esa misma carpeta.

## Criterio (lo esperado)

Matriz de `docs/srs.md` sección 4 más la separación de funciones habitual en comercio:

- **Vendedor:** solo punto de venta (vender, caja, reservas en tienda y frial, órdenes en lavandería). Sin panel, sin
  costos ni ganancia, sin crédito, sin anular ni devolver, sin reportes, sin configuración. Descuento solo en lavandería.
- **Encargado:** opera el panel (ventas, clientes, productos, inventario, precios, compras, cajas, créditos, tipo de
  cambio, reportes). Sin "Usuarios", "Dispositivos", "Descuento" ni "Datos del negocio", salvo en lavandería, donde sí
  los tiene pero no gestiona al dueño ni a otros encargados.

## Resultado

**Sin desvíos en lo observado.**

| Rol y negocio | Comprobado | Resultado |
|---|---|---|
| Vendedor, los tres | Entra directo a `/pos`; las 28 rutas del panel lo devuelven a `/pos` | Cumple |
| Vendedor, los tres | Permisos leídos con su sesión: tienda y frial `caja`, `gestionar_reservas`, `vender`; lavandería `caja`, `cambiar_estado_orden`, `descontar`, `vender` | Cumple |
| Vendedor, los tres | No lee `errores_app` (403); no lee costos (`stock`, `venta_items.costo_unitario`, `movimientos_inventario.costo_unitario`: 403); `costos_stock`, `reporte_ventas` y `reporte_stock` responden `ERP_SIN_PERMISO` | Cumple |
| Encargado, tienda y frial | Abre las 12 áreas del panel; "Usuarios", "Dispositivos", "Descuento" y "Datos del negocio" no están en el menú y por dirección directa vuelven a `/panel` | Cumple |
| Encargado, lavandería | Abre además "Usuarios", "Dispositivos", "Descuento", "Datos del negocio" y "Órdenes"; no ve "Créditos" | Cumple |
| Encargado, lavandería | En "Usuarios", las filas del dueño y del encargado no tienen acciones; los selectores de rol ofrecen solo Contador, Vendedor y Empleado | Cumple |
| Encargado, los tres | No lee `errores_app` (403) | Cumple |

- **Anular, vendedor:** la matriz inicial (`20261101120100_rol_permisos_matriz.sql`) se lo daba; la migración
  `20261108130000_auditoria_entrega_a.sql` se lo quitó a vendedor y empleado. En producción no lo tiene. Coincide con
  lo dicho al cliente: el vendedor no anula.
- **`errores_app` no es legible desde la web:** confirmado en producción para estas dos cuentas (era un pendiente del
  PR #103).
- El vendedor no recibe un mensaje de "acceso negado" en el panel: se lo devuelve al punto de venta sin aviso
  (`web/src/modules/usuarios/contexto.ts`).

## No comprobado (exige escribir en producción)

Queda cubierto solo por las pruebas locales (pgTAP y Playwright):

- Los controles dentro del punto de venta del vendedor ("Vender a crédito", descuento, anular): con la caja cerrada el
  punto de venta solo muestra "Abrir caja". Por permisos no los tiene; el control no se vio.
- Que el servidor rechace una anulación, devolución o descuento enviado por un vendedor, y un cambio de rol sobre un
  encargado o el dueño enviado por un encargado. Solo se vio que la interfaz no lo ofrece.
- El formulario "Agregar persona de otro negocio" visto como encargado de lavandería (no apareció: no había personas
  por agregar).
- Abrir y cerrar caja, reservas, órdenes y cambio de estado.
- Costos con datos reales: producción tiene 0 ventas.
- Roles contador y empleado: no se crearon cuentas de prueba para ellos.

## Observaciones de separación de funciones (no son defectos; a decidir por el CTO)

- El encargado concentra vender, anular, ajustar inventario, comprar y revertir sus propias compras, y ve costos. Es
  lo habitual en un negocio chico con un encargado por local; el control que queda es la revisión del dueño
  (reconciliación, reportes y el registro de cambios).
- En lavandería el vendedor da descuento hasta el tope y el encargado gestiona al personal. Es lo que pide la matriz
  del SRS.
- El vendedor abre y cierra su caja solo; el cierre es a ciegas (no ve el esperado) y la revisión la hace el encargado.

## Pendiente

- Las dos cuentas de prueba siguen **activas** en producción. Desactivarlas desde "Usuarios" cuando ya no hagan falta, o
  antes del paralelo. Reversible con "Reactivar".
