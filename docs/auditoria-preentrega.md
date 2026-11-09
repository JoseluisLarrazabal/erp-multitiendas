# Auditoría funcional previa a la entrega (2026-11-09)

Pedida por el CTO el 2026-11-09: auditar el producto en funcionalidad y definir qué tan preparado está para entregarse.
Se hizo sobre `main` en `a910b49`.

## Veredicto

**No está listo para firmar el acta hoy. Sí está listo para que el cliente cargue sus datos, una vez cerrados los
bloqueantes de código de la sección 2.**

| Frente | Estado | Motivo en una línea |
|---|---|---|
| Entrega A, código (contrato) | Amarillo | Suites en verde y 0 críticos; 1 defecto alto y 3 huecos que se topan el primer día |
| Entrega B, código (extras) | Amarillo | Cumple 10 de 14 requisitos; 2 altos (stock y crédito) y no hay forma de corregir un cobro mal cargado |
| Producción | Verde con 1 defecto | Deploy, migraciones y CI al día; el backup corre con hasta 10 h de atraso |
| Paquete de entrega (acta, paralelo, manuales) | Rojo | El acta no nombra los extras, el paralelo omite la limpieza, faltan 17 reglas en los manuales |
| Lo que depende del cliente, del CTO y de hardware | Rojo | Precios, usuarios, equipos reales, dominio, credenciales, paralelo: nada de eso empezó |

No se encontró ningún defecto crítico (pérdida de dinero o de datos, fuga entre negocios, bloqueo de la operación).

## 1. Qué se hizo y con qué evidencia

**Ejecutado por el chairman (evidencia directa):**

- Los pasos 1 a 8 del CI en local, sobre una base recién reseteada: ESLint, Prettier y `tsc` en 0; Vitest 464 de 464;
  pgTAP 2.186 en 47 archivos; tipos generados sin diferencias; `next build`; integración de `admin-usuarios` 12 de 12;
  Playwright 237 de 237 (Chromium, más Pixel 7 e iPhone 14 emulados). Búsqueda del POS con 2.137 productos: máximo
  33,4 ms (RNF-01 pide menos de 200).
- Producción: deploy `READY` en `a910b49`; 0 errores de runtime en 7 días (Vercel); 38 migraciones, local igual a remoto;
  sin sesión `/`, `/panel` y `/pos` llevan a `/login`; cabeceras de seguridad presentes; CI verde en `main`; backup
  verde 7 de 7.
- Lectura puntual del código de cada hallazgo marcado "verificado" abajo.

**Hecho por subagentes, solo lectura (6 informes):** trazabilidad de los 80 requisitos de la Entrega A contra código y
pruebas (2 subagentes); lógica SQL de la Entrega B (Opus); web de la Entrega B; supervivencia de los arreglos de
`docs/auditoria-entrega-a.md`; paquete de entrega. Un séptimo subagente hizo QA en navegador siguiendo los manuales
(sección 6).

**Trazabilidad de requisitos (por lectura):**

| Bloque | Cumple | Parcial | No cumple | No verificado |
|---|---|---|---|---|
| Transversales, catálogo, inventario, clientes, carga (34) | 29 | 4 | 1 (RF-TR-10, dominio) | 0 |
| Ventas, caja, lavandería, frial, reportes y reglas (46) | 40 | 5 | 0 | 1 (RF-FRI-03) |
| Entrega B (14) | 10 | 4 | 0 | 0 |

La matriz de permisos final coincide celda por celda con el SRS (100 filas). No hay `.skip`, `.only` ni `.fixme`.
Los arreglos de la auditoría de la Entrega A siguen en el código: 21 confirmados, 5 parciales y 0 pisados por las
migraciones de la fase 7. Los 5 parciales son pruebas que no discriminan, no arreglos ausentes (sección 4).

## 2. Bloqueantes de código

Cada uno se topa en la primera semana de uso. Son cambios chicos. B-1, B-2, B-3 y B-6 se reprodujeron en el navegador
(sección 6); B-2 y B-6 quedaron además comprobados por SQL en la base local.

| # | Sev. | Hallazgo | Evidencia | Arreglo propuesto |
|---|---|---|---|---|
| B-1 | Alto | **El POS puede agregar el producto equivocado.** Código interno y código de barras van al mismo `Map`; si el código interno de un producto es igual al código de barras de otro, gana el último y entra al carrito sin aviso. Lider tiene códigos internos "1" a "597" y la importación conserva códigos de barras cortos | `web/src/modules/ventas/domain.ts:177-178`, `use-venta.ts:228-230`. Verificado en código. Sin prueba. **No verificado si hay colisiones en los datos reales** (consulta abajo) | El código de barras gana; si hay dos candidatos, mostrar ambos y pedir que se elija. Mismo criterio en el selector del panel (`inventario/components/selector-producto.tsx:118`) |
| B-2 | Alto | **El conteo físico ignora lo reservado y crea stock fantasma.** La reserva baja el stock con un movimiento `reserva`; el conteo compara lo contado contra ese stock. Stock 10, se reservan 3, el conteo encuentra 10 y ajusta +3; al cancelar la reserva quedan 13 en sistema y 10 en el local. Ni la pantalla ni el manual avisan | `20261108150000_reservas.sql:231`, `20261108130000_auditoria_entrega_a.sql:1354-1364`. Verificado en código. Sin pgTAP | Mostrar lo reservado en la pantalla de conteo y comparar contra stock más reservado activo. pgTAP del caso |
| B-3 | Medio | **La nota y la boleta salen sin dirección ni teléfono.** `negocios.datos_nota` no lo escribe nadie: ni migración, ni script de alta, ni pantalla. RF-VEN-05 y RF-LAV-03 lo piden y el acta verifica "nota impresa" | `20261101120000_tenencia.sql:11`, `web/src/modules/ventas/queries.ts:38`. Verificado en código | Pantalla "Datos del negocio" para el dueño (dirección, teléfono, NIT), por RPC con auditoría |
| B-4 | Medio | **El backup no cumple RNF-09.** Programado a las 03:00 de La Paz, GitHub lo arranca entre 09:39 y 12:58. Entre las corridas del 8 y del 9 de noviembre pasaron 27 h (pérdida máxima pedida: 24 h) y cae en horario de venta | `gh run list --workflow "Backup diario"`. Verificado | Dos corridas por día en `backup.yml`; con eso el hueco máximo queda bajo 24 h aun con el atraso observado |
| B-5 | Medio | **No hay forma de cambiar ni de restablecer una contraseña.** Un empleado que la olvida solo se resuelve desde el panel de Supabase, y la cuenta no se puede recrear con el mismo correo. No está en el SRS, pero va a pasar | Sin `resetPassword`, `updateUser` ni recuperación en `web/src` ni en `supabase/functions`. Verificado | Acción "Restablecer contraseña" en `admin-usuarios`, para quien tiene `usuarios` |
| B-6 | Alto | **Una recarga a mitad del cobro deja una venta a crédito registrada y el POS sin rastro.** El cobro de una venta a crédito o de reserva sin confirmar vive solo en memoria. En la prueba, la venta `C1-000005` (Bs 1.531,20) quedó en el servidor con su crédito y el POS volvió con el carrito vacío y sin nota: el cajero la repite y duplica el crédito, que no se puede anular (`ERP_VENTA_CON_CREDITO`) ni revertir (M-2). El cierre de caja tampoco mira esos cobros pendientes | `web/.../use-envio.ts:106-116`, `venta-en-curso.tsx:116`. Las cuotas sí se guardan (`cobro-cuota.ts:20`) | Guardar el cobro pendiente en `sessionStorage` como las cuotas, avisar antes de salir y contarlo para bloquear el cierre |

Consulta de solo lectura para saber si B-1 ya existe en producción (la tiene que correr o autorizar el CTO: el
clasificador de permisos bloqueó la lectura a producción en esta sesión):

```sql
select a.negocio_id, a.codigo, a.nombre as por_codigo, b.nombre as por_barras
from public.productos a
join public.productos b
  on b.negocio_id = a.negocio_id and b.id <> a.id
 and lower(btrim(b.codigo_barras)) = lower(btrim(a.codigo));
```

## 3. Hallazgos medios

No bloquean la carga de datos. Cada uno se arregla o se entrega escrito como límite conocido; los marcados "CTO"
necesitan una decisión.

**Dinero y control (Entrega B):**

| # | Hallazgo | Evidencia |
|---|---|---|
| M-1 | CTO. El vendedor puede cancelar una reserva y devolver el anticipo en efectivo sin supervisión: `cancelar_reserva` solo pide `gestionar_reservas` y `caja`, y el arqueo cuadra. Es el mismo riesgo que P-11 cerró al quitarle `anular` | `20261108150000_reservas.sql:263-264`. Verificado |
| M-2 | No existe reverso para un pago de cuota, un pago a proveedor ni una compra. Un cobro cargado al crédito equivocado o una compra por 1.000 en vez de 100 quedan así para siempre | `20261108160000_credito.sql:355`, `20261108120000_compras.sql:10,340` |
| M-3 | CTO y cliente. Pagar todo el crédito por adelantado cobra el interés de los meses que no corrieron (1.000 al 2,5 % en 3 cuotas se cancela con 1.050,41 al día siguiente). Se suma a P-07 | `20261108160000_credito.sql:160-172,297-298`. Hipótesis de negocio |
| M-4 | Pasó a bloqueante: B-6 | |
| M-5 | `/panel/ventas` no distingue las ventas a crédito ni las de reserva y siempre ofrece Anular y Devolver: pide confirmar y recién después rechaza. En la venta a crédito, "Pagos" muestra solo la inicial. Reproducido | `lecturas-panel.ts:161`, `ventas/[id]/page.tsx:88-132` |
| M-6 | El plan de cuotas no se puede reimprimir, y los documentos del crédito (CI, domicilio, pagaré) solo se marcan al vender | `plan-credito.tsx`, `20261108160000_credito.sql:754-767` |
| M-7 | En reserva, cuota y cancelación, `ERP_OPERACION_REPETIDA` habla de "carrito"; si la respuesta se perdió y el cajero cambió un dato, no hay salida | `erp-errores.ts:15-16`, `form-reserva.tsx:412,454` |

**Frial:**

| # | Hallazgo | Evidencia |
|---|---|---|
| M-8 | "Compras" se ve en el frial y entra stock sin lote ni vencimiento: esas unidades no salen en "Por vencer" y desordenan el saldo de los lotes anteriores (RF-FRI-05) | `20261108120000_compras.sql:263-267` (sin lote), `panel-items.ts:94`. Verificado |

**Operación diaria:**

| # | Hallazgo | Evidencia |
|---|---|---|
| M-9 | Los reportes de Ventas y de Caja usan criterios distintos y la pantalla no lo dice: Ventas cuenta lo vendido (una venta a crédito entra entera; las cuotas, el interés y los anticipos no entran), Caja cuenta lo cobrado. Una venta sin conexión del lunes enviada el martes cuenta el martes en Ventas y el lunes en Caja | `20261102140000_reportes.sql:35-113,236-241` |
| M-10 | En una caja cerrada a la que llega una venta sin conexión tardía, "Esperado" se recalcula y "Contado" y "Diferencia" quedan congelados: los tres números dejan de cuadrar entre sí | `20261108160000_credito.sql:1448`, `detalle-sesion.tsx:100-113` |
| M-11 | Una venta rechazada en la cola bloquea el cierre de caja del equipo, y descartarla exige `devolver_fuera_plazo`. Sin encargado, la caja queda abierta | `use-cola.ts:92`, `decisiones-manual.md:208` |
| M-12 | Las búsquedas de clientes y las de productos del panel distinguen acentos: "maria" no encuentra a "María" y la cajera crea un duplicado. La búsqueda del POS sí los ignora | `clientes/queries.ts:21`, `catalogo/queries.ts:40-45` |
| M-13 | El kardex muestra como referencia la palabra cruda ("venta", "operacion") sin número de documento: no se sabe qué venta o compra generó el movimiento (RF-INV-02) | `lista-kardex.tsx:86-88` |
| M-14 | Un producto desactivado con stock no se puede elegir en salida, traslado ni conteo: hay que reactivarlo para darlo de baja, y la pantalla no lo dice | `inventario/queries.ts:206-211,268-274` |
| M-15 | RNF-16 sin cumplir: no hay registro de errores de RPC. Un fallo en producción solo se conoce si el cliente llama | `docs/auditoria-entrega-a.md:75` |
| M-16 | En el POS de tienda y de frial a 390 px, la barra de modos desborda la página (541 px contra 375): "Cuotas" y "Caja" quedan fuera de pantalla. `responsive.spec.ts` recorre el panel, no el POS | QA en navegador, 390×844 |
| M-17 | En el POS, "Nuevo cliente" con un documento repetido responde 400 y no muestra "Ya existe un cliente con ese documento" (`manual/vendedor.md:108`); pasa al buscador sin explicar | QA en navegador |

No es defecto: RN-07 solo se impone en el cliente (`cerrar_caja` no mira la cola). El servidor no puede ver la cola de
un navegador; queda como límite conocido.

## 4. Pruebas que no discriminan y brechas

- Orden de bloqueos por uuid: la prueba es una búsqueda de texto en `prosrc` y pasa aunque se borre el `ORDER BY`
  (`supabase/tests/auditoria-entrega-a.sql:169-173`). `registrar_compra` bloquea en el orden en que llegan los ítems
  (`20261108120000_compras.sql:252-257`): puede dar un deadlock que aborta sin corromper.
- Permiso antes de `FOR UPDATE` en las 3 RPC de órdenes: la prueba solo ve `ERP_SIN_PERMISO`, que sale igual con el
  orden viejo.
- `ERP_ULTIMO_DUENO` como 409 en la Edge Function: sin prueba de integración. La carrera de dos dueños tampoco.
- RNF-02 (venta en menos de 2 s): medido contra la base local del mismo equipo, no contra producción.
- RF-FRI-03: ninguna prueba arranca un frial vacío ni un POS sin productos.
- Sin pgTAP: conteo con reserva activa, compra sobre stock negativo, compra con costo 0, reserva con anticipo igual al
  total, crédito con descuento, vencimientos de un crédito hecho un 29, 30 o 31, prepago total.
- Sin E2E: cobro de cuota con respuesta perdida, crédito pagado completo, inicial por QR, cancelar reserva con QR o con
  efectivo insuficiente, Anular y Devolver desde la UI en ventas a crédito o de reserva, compra de varias líneas,
  recarga a mitad de cobro, `reporte_ventas` con crédito o reserva.
- axe cubre 7 pantallas; no cubre lavandería, crédito, reservas ni reconciliación. Android e iOS corren 5 pruebas de humo.
- La limpieza de pruebas (`scripts/limpieza/`) ya borra reservas y créditos, pero no corre en CI y su último ensayo
  registrado es del 2026-11-05, anterior a la fase 7.

## 5. Paquete de entrega

| Documento | Problema |
|---|---|
| `acta-entrega.md` | El punto 6 es un marcador sin redactar (D-01). No nombra venta sin conexión, precios en USD ni dólar paralelo. Verifica el frial con un negocio sin catálogo. Queda una nota suelta en la fila de lavandería (línea 29). La lista "Para preparar la firma" omite la rotación de credenciales, D-02 y los riesgos aceptados. Verificado |
| `paralelo.md` | No incluye la limpieza de pruebas ni el reseteo del contador por equipo (`despliegue.md:107-119`): la primera nota real no sería `<prefijo>-000001`. No controla anticipos, cuotas, compras ni insumos. Verificado |
| `capacitacion.md` | Pone el cierre de caja antes de las anulaciones de práctica (líneas 152 a 156). No avisa que trasladar o dar de baja productos con serie hace abortar la limpieza |
| `despliegue.md` | La sección de secretos solo nombra `SUPABASE_DB_URL`; el backup de fotos necesita 2 más (`backup.md:46-49`) |
| `docs/manual/` | Faltan 17 reglas de `decisiones-manual.md` en el manual del rol afectado. Las que pesan: cómo instalar la app (el acta la verifica instalada); backup, pérdida máxima de 24 h y clave `age` para el dueño; riesgos aceptados (créditos y caja legibles por todo el personal del negocio); la venta que completa una reserva no admite descuento ni crédito. Las 25 imágenes existen |
| `handoff.md` | Tres contradicciones: contrato "pendiente de firma" (línea 81) y "firmado" (223); "en curso: fase 6" (84) con la 7 cerrada; cuota de Codex el 2026-11-16 y el 2026-12-03 |
| `auditoria-entrega-a.md`, `decisiones-manual.md` | Siguen listando como pendientes brechas que #91 cerró |

Criterios de salida de `plan-pruebas.md` sin cumplir: prueba manual en los equipos reales con lector, 3 días de
paralelo, acta firmada y créditos iniciales conciliados (P-06). El simulacro de restauración está parcial: se verificó
`stock` igual a kardex, pero no un inicio de sesión sobre la base restaurada.

Requisitos no funcionales: cumplen 01, 02, 04, 05, 06 y 10. Parciales 07, 08, 09 (B-4), 11, 12, 13, 14 y 15. Sin
evidencia 03 (estimación de tamaño) y 16 (registro de errores).

## 6. QA en navegador siguiendo los manuales

Un subagente recorrió la app en local (build de producción, base con el seed) con cada rol, siguiendo
`docs/manual/`. Cobertura: vendedor 13 de 15 flujos, dueño 17 de 20, lavandería 9 de 10, frial 4 de 4, contador 6 de
7, más el panel y el POS a 390×844.

**Funciona como dice el manual:** el vendedor no entra al panel ni a usuarios, reportes o créditos (redirige a
`/pos`); el contador ve su menú y no puede escribir; un doble clic en "Confirmar cobro" genera una sola venta; el
esperado de caja, los totales del reporte de ventas, el interés del crédito y el redondeo por peso (1,250 kg × 33,33 =
41,66) se recalcularon a mano y coinciden; los 5 reportes bajan a Excel con filas; el selector de negocio cambia datos
y menú.

**Comprobaciones dirigidas:**

| Caso | Resultado |
|---|---|
| B-1, código "25" repetido | Reproducido: entra el producto del código interno; el del código de barras nunca entra. Sin aviso |
| B-2, reserva y conteo | Reproducido: entrada 10, reserva −3, conteo ajusta +3, cancelación libera +3. Stock 13 con 10 en el local |
| B-3, datos de la nota | Reproducido: nota y boleta sin NIT, dirección ni teléfono. No hay pantalla donde cargarlos |
| B-5, contraseña | Confirmado: ni el login ni "Usuarios" tienen cambio o restablecimiento |
| B-6, recarga durante el cobro a crédito | Reproducido (recarga 120 ms después de confirmar) |
| M-5, M-8, M-12 | Reproducidos |

**Diferencias entre manual y producto:**

- `vendedor.md:143`: la nota "lleva NIT, dirección, teléfono" y descuentos. No lleva ninguno de los tres, ni la línea
  de descuento.
- `vendedor.md:63`: ofrece la lista Crédito por línea; el vendedor no la tiene.
- `encargado-y-dueno.md:305`: "confirmar" la devolución; el producto devuelve sin diálogo.
- `encargado-y-dueno.md:132`: la grilla de precios rechaza 3 decimales con "Hay montos inválidos" sin señalar la fila.

**No concluyente, a reproducir antes de la entrega:**

- La primera carga de `/pos` mostró solo "Vender" y "Consulta rápida", sin Reservas, Cuotas ni Caja: el service
  worker servía un build anterior y un chunk daba 404; no salió "Actualización disponible". Puede ser un resto de
  builds anteriores en `localhost:3000`. Si pasa en producción tras un deploy, el equipo queda sin poder cerrar caja.
- Un precio de crédito guardado en el panel no llegó al POS tras recargar; el tipo de cambio sí llegó al elegir
  equipo. Falta precisar cuándo se refresca el catálogo guardado.

**No probado:** venta sin internet (la cubren los E2E), descartar rechazadas, impresión del plan de cuotas,
parámetros del crédito, anular un saldo inicial, cierre de caja con un cobro pendiente, servicio por kilo en
lavandería (el seed no trae ninguno), "Marcar revisada" en reconciliación.

## 7. Lo que no depende del código

En el orden en que conviene hacerlo. Los dos primeros son objeciones al plan vigente.

1. **Rotar las credenciales antes de cargar datos reales, no "en la entrega"** (`handoff.md:265-271`). La contraseña
   de la base y la `service_role` quedaron expuestas el 2026-11-04; con precios, costos y clientes cargados, el daño
   de una fuga deja de ser teórico.
2. **Comprar el dominio antes de instalar la app en los equipos.** El equipo elegido, el contador de notas, el
   catálogo guardado y la cola sin conexión viven en el almacenamiento del navegador, que es por origen. Cambiar de
   `erpmultitiendas.vercel.app` al dominio final después de capacitar obliga a reinstalar y reconfigurar cada equipo,
   y una venta en cola en el origen viejo no viaja al nuevo.
3. Precios del cliente. Sin ellos no hay venta, capacitación ni paralelo.
4. Servicios de lavandería, tope de descuento, usuarios del personal y datos de la nota (B-3).
5. Prueba en los equipos reales: lector, impresora térmica, PWA instalada en Android e iPhone.
6. Limpieza de pruebas, paralelo de 3 días y acta.
7. Decisiones del CTO: D-01 (extras y garantía), D-02 (frial sin catálogo por escrito), D-04 (fecha del contrato),
   copia fuera de línea de la clave `age`.
8. Preguntas al cliente que frenan la Entrega B: P-06 (saldos de crédito), P-07 y M-3 (interés y prepago), P-12
   (anticipo al cancelar).

## 8. Camino propuesto

1. PR de bloqueantes: B-1 a B-6.
2. PR de la Entrega B: M-1 (según decida el CTO), M-2, M-5 a M-8.
3. PR de operación diaria: M-9 a M-14, M-16, M-17, las pruebas de la sección 4 y los dos "no concluyentes" de la 6.
4. PR de documentos: acta, paralelo, capacitación, despliegue, manuales y handoff.
5. En paralelo, los puntos 1 a 4 de la sección 7.

## No verificado

- Datos reales de producción: colisiones de B-1 y contenido de `datos_nota`. La lectura a producción quedó bloqueada.
- Los hallazgos de las secciones 3 a 5 sin la marca "Verificado" o "Reproducido" salen de la lectura de subagentes; el
  chairman revisó el código de B-1 a B-3, B-5, M-1, M-8 y los documentos del acta y del paralelo, y comprobó por SQL
  en la base local los movimientos de B-2 y la venta de B-6.
- El QA en navegador fue en local con el seed, no en producción ni en los equipos del cliente.
- Hardware real: impresora térmica, lector, Android e iPhone, lector de pantalla.
- Codex no corrió (sin cuota hasta el 2026-12-03). No se convocó `/council` para el veredicto.
- Los 40 hallazgos bajos no se revisaron uno por uno; están en el anexo.

## Anexo: hallazgos bajos

- Catálogo e inventario: la hora del dólar paralelo se oculta bajo 640 px (RF-CAT-12 en celular); `guardar_precios` no
  captura `check_violation`; el tipo de cambio acepta 8 enteros y la columna 6; los dispositivos POS no se editan; no
  hay pantalla de auditoría (RF-TR-09 guarda, no muestra); la entrada de un producto con serie no avisa que hay que
  cargar las series; el stock bajo no se avisa en el Inicio; `stock_inconsistente` sin consumidor en la web; el costo
  de `ajustar_inventario` se lee sin bloqueo; sin E2E de edición de producto.
- Ventas, lavandería y frial: las reservas subvalúan el valor del stock; el saldo de lote es una estimación sin
  ubicación; mensaje genérico en `anular_orden` pasadas 24 h; "sin recoger" no avisa en el Inicio (RN-09); el POS sin
  productos no orienta.
- Entrega B, web: carrera al cambiar de cliente en Cuotas; `guardarProveedor` sin id de operación ni nombre único;
  interés mostrado como "2.5 %"; `ERP_LOTE_GRANDE` sin mensaje; `ERP_PAGO_EXCEDE_SALDO` en un crédito ya pagado; un
  crédito inexistente responde "sin permiso"; `reservas_activas` corta en 200 y las reservas no vencen; compra con
  costo 0 sin aviso; el formulario de compra no avisa al salir; cuota vencida con pago parcial sin su pendiente;
  `/panel/creditos` accesible por URL en lavandería.
- Entrega B, SQL: 7, de los que pesa el orden de bloqueos de `registrar_compra` (sección 4). Los otros 6 son atajos ya
  documentados o casos raros.
- QA en navegador (7): la fecha de la nota y de la boleta sale "9/11/26, 5:29 p. m." y no `dd/mm/aaaa` (RNF-13); la
  nota no muestra la línea de descuento; devolver no pide confirmación; una cuenta desactivada ve "Correo o contraseña
  incorrectos"; ayuda "Entera." en la merma por kilos; la pestaña "Órdenes" de lavandería es `role=tab`; interés con
  punto (repetido arriba).
- Arreglos de la Entrega A: la hora de un movimiento de caja sin conexión sube a `abierta_en`; la caducidad del
  contexto usa el reloj del equipo; el backoff del motor llega a 30 s y no se detiene.
