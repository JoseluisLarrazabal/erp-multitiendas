# Handoff — ERP Multitiendas

Documento vivo. Fuente de verdad para planificar y ejecutar el proyecto.
Última actualización: 2026-11-08.

## Próxima sesión (arrancar acá)

- **Plan activo: fase 7, Entrega B** (CTO, 2026-11-08: "no nos importa ya el contrato ahora mismo, implementa
  entrega B"). Plan en `docs/plan-fase-7.md`, con 4 PRs en serie: compras, insumos, reservas y crédito. Estado por PR
  en la tabla "Estado" del plan. D-01 queda sin resolver y no frena la fase.
- **Migraciones a producción (CTO, 2026-11-08):** `.claude/settings.json` permite a Claude correr
  `pnpm exec supabase --workdir <dir> db push --linked` y su `--dry-run`. Siempre se corre desde un worktree limpio en
  `origin/main`, con el dry-run primero y verificando `supabase/.temp/project-ref`. Para revertir, se borra la regla.
- **Auditoría de la Entrega A (2026-11-08):** `docs/auditoria-entrega-a.md`. El CTO pidió arreglar todo; estado por PR al final de ese documento.
- **Producción lista para cargar datos.** El backup diario con fotos está en verde, el script de limpieza está
  ensayado (PRs #71 a #79) y el CI está en verde en `main`.
- **Bloqueado por el cliente o el CTO, en orden:**
  1. Precios del cliente. Sin ellos no se puede vender (`ERP_PRODUCTO_SIN_PRECIO`) ni capacitar.
  2. Servicios de lavandería, catálogo del frial y tope de descuento (D-03).
  3. Conteo físico (P-17, P-02 a P-05).
  4. Usuarios del personal (correos y roles), al final.
  5. Prueba en el equipo real con lector.
  6. Capacitación. Antes del paralelo va la limpieza: seco y real con `--linked`, `SUPABASE_DB_PASSWORD` lo escribe el
     CTO, y se resetea el contador local en cada equipo (`docs/despliegue.md`).
  7. Paralelo de 3 días y acta.
  8. Fecha de firma (D-04), dominio (RF-TR-10), rotación de credenciales a la entrega y adenda D-01.
- **Codex:** cuando vuelva la cuota (2026-12-03, según el error de Codex del 2026-11-08), correr las revisiones pendientes de las fases 3 a 6 y `verify-fix`
  sobre los `fix:`.

## Estado actual

- **Contrato redactado**, pendiente de firma: `/home/shadowfreak/Downloads/Contrato_ERP_Hinojosa_Claros.docx`
  (basado en el contrato de Elegance Dominio Barbería). Solo falta la fecha de firma (a mano).
- **Anticipo cobrado** (50%). Saldo (50%) se cobra a la entrega, contra firma del acta de entrega.
- **Desarrollo:** fases 0 a 5 cerradas (frial, reportes y PWA: `docs/plan-fase-5.md`). En curso: fase 6 (salida), plan en
  `docs/plan-fase-6.md`; backup en `docs/backup.md`. Repo: `github.com/JoseluisLarrazabal/erp-multitiendas` (privado).
- **Formulario de relevamiento Lider: LISTO (2026-10-26, PR #1).** Apps Script `formularios/apps-script/relevamiento.gs`
  creó (cuenta Google del CTO):
  - Form (link cliente): https://docs.google.com/forms/d/e/1FAIpQLScKis-v3T917G29sN-J5wxRG5Y2in2HU8FjfbkmGBFEkNEUew/viewform
  - Editar form: https://docs.google.com/forms/d/1qrG1GulgtutvGeBt0dgFDI02BC5TsGryR6PyevU1L9U/edit
  - Planilla de carga: https://docs.google.com/spreadsheets/d/1YE1VWxSqo6-ZZlrT5Vn7-FgNjoCRcWf6cijJ2prCxQE/edit
  - Planilla de respuestas: https://docs.google.com/spreadsheets/d/1fgxt7zJ-Ly3w3am6LyrxBPPFrURKElRqSB_S3_BI9gU/edit
  - Alternativa offline: `formularios/plantillas/Multitienda-Lider-Datos-iniciales.xlsx` (mismas columnas; regenerar con
    `generar_plantilla_lider.py` si cambian las del `.gs`).
  - Verificado con Playwright: 13 páginas (intro + 12 secciones), 104 preguntas, link a la planilla en la intro, correo
    requerido, confirmación final obligatoria. **No verificado:** planilla de carga en vivo (privada; revisar a mano) ni
    respuesta de prueba punta a punta. Codex: no verificado.
  - **Pendiente CTO:** compartir planilla de carga con el correo del cliente (Editor) y mandar link del form por WhatsApp.
    Registrar aquí la fecha de envío.
  - Plan: `docs/plan-formulario-lider.md`.
- **Formularios lavandería y frial: CREADOS (2026-10-26, PR #2).** Mismo archivo, renombrado a
  `formularios/apps-script/relevamiento.gs`. Tiene 3 funciones: `crearTodoLavanderia` (82 preguntas, 9 secciones),
  `crearTodoFrial` (82 preguntas, 8 secciones) y `crearTodoLider_YA_EJECUTADO` (no volver a correrla).
  Las secciones 1 a 3 están parametrizadas por negocio. La sección "3 negocios juntos" solo va en Lider.
  - La traza de llamadas de Lider es idéntica antes y después del refactor (523 llamadas, `cmp`), así que el form
    publicado sigue coincidiendo con el código.
  - **No verificado:** la ejecución real en Google de lavandería y frial (solo probado con stubs), y la configuración
    regional de la cuenta (separador decimal en la planilla del frial). Codex: no verificado.
  - **Lavandería: creado (2026-10-26).** Verificado con Playwright: 10 páginas (intro + 9 secciones), 82 preguntas,
    link a la planilla de carga en la intro, correo requerido, confirmación final obligatoria.
    - Form (link cliente): https://docs.google.com/forms/d/e/1FAIpQLSfv9ohkgFW4KonwPzS5JPr7X8D9wMUU2_sf4Mn6_YiUGAKFYA/viewform
    - Editar form: https://docs.google.com/forms/d/1Pm86SGnQyvBAV-6emgasz3z6Ul1XSCiYLAekKkgSHKE/edit
    - Planilla de carga: https://docs.google.com/spreadsheets/d/178C1hezWtEZhyBNTpj_p0EtjRg63Ju437oamvydBoh0/edit
    - Planilla de respuestas: https://docs.google.com/spreadsheets/d/1jXJv1asWqeTRg0gpfyrBFsge186K0DkmR8CtefYr5EM/edit
  - **Frial: creado (2026-10-26).** Verificado con Playwright: 9 páginas (intro + 8 secciones), 82 preguntas,
    link a la planilla de carga en la intro, correo requerido, confirmación final obligatoria.
    - Form (link cliente): https://docs.google.com/forms/d/e/1FAIpQLSfHHtAmKOE0afEsGZCqHFOFqiD-FAKxMyk51wez7FkZ36lKaw/viewform
    - Editar form: https://docs.google.com/forms/d/1TJ72Tev4gBYKCvNUc89HY3aIr_8NB2FRilwPUXVhn4c/edit
    - Planilla de carga: https://docs.google.com/spreadsheets/d/12P5adY-tJmJQjg4P-2gnFfYY-tA1ePETXO_376ys2w0/edit
    - Planilla de respuestas: https://docs.google.com/spreadsheets/d/1FhamDhMmjFQ8NbVCLxMZ8CEH1N4Ym4sln-gYsjN9O9Y/edit
  - **No verificado (ambos):** planillas de carga en vivo (privadas), separador decimal en la del frial, respuesta de
    prueba punta a punta.
  - **Pendiente CTO (ambos):** compartir cada planilla de carga con el correo del cliente (Editor), mandar los links
    por WhatsApp y registrar aquí la fecha de envío.
  - Plan: `docs/plan-formularios-lavanderia-frial.md`.
- **Formularios ENVIADOS al cliente: 2026-10-26** (los 3 links por WhatsApp). El plazo de 30 días calendario corre
  desde la firma y la recepción de la información (cláusulas quinta y undécima).
  - **Planillas de carga: acceso "Cualquier persona con el enlace"** (decisión del CTO, 2026-10-27). El link solo se
    mandó al cliente. El CTO acepta el riesgo: el link también está en la intro del form, que se puede reenviar, y la
    planilla va a tener costos y datos personales. Recomendado pasarla a **Restringido** apenas termine la carga.
    Revisado 2026-10-30: las 3 se pueden leer y descargar sin login. En Lider, sin login se ve "Solo ver"; en lavandería
    y frial no se comprobó el permiso del enlace.
  - **Planilla Lider, revisión 2026-10-30:** 597 productos reales en `Productos`.
    - El cliente agregó las columnas `imagenes` (B) y `Ubicacion` (R). Hay 292 fotos en las filas 5 a 296; las 17
      revisadas al azar coinciden con su producto.
    - Columnas H a L y N a Q: estaban ocultas, ya visibles. No tienen datos reales: **ningún producto tiene precio** ni
      código interno.
    - Filas 569 a 594 (26): estaban pegadas sin formato ni validaciones. Reparadas el 2026-10-30, a pedido del CTO, con
      la cuenta `jencarlosmoral2`. Valores sin cambios (verificado por exportación). Siguen sin `Ubicacion`.
    - Respaldo previo: https://docs.google.com/spreadsheets/d/1tLSkAeGuOCQG0e41VDcPedof-iEpLrmOrRv1guLOGag/edit
    - Queja del cliente: filas muy altas. Las filas 1 a 601 estaban fijas en 50 px. Corregido el 2026-10-30 (opción A
      del CTO): 21 px en 2 a 4 y 297 a 601, 32 px en las filas con foto (5 a 296). Encabezado sin cambios. Datos y
      validaciones verificados por exportación. Las fotos van dentro de la celda.
    - Durante ese trabajo, A2 quedó con un espacio; causa no identificada. Se restauró `REF-001` a mano.
    - Para limpiar antes de importar: 4 filas con "aro 20/29" en código de barras, 17 códigos repetidos, 13 productos
      repetidos, 1 código en notación científica, categoría "Hornos" duplicada.
    - El síntoma que reportó el cliente sigue sin confirmar. Lavandería y frial solo tienen las filas de ejemplo.
  - **Revisión 2026-11-01:** informe: https://claude.ai/artifact/DJeZuyDC3x9TZpnPtqyK39
    - Planillas de carga exportadas sin login. Lider: 597 productos, 2.633 unidades, 0 precios. Clientes, Usuarios y
      Números de serie sin datos reales. Lavandería y frial: 0 filas reales.
    - Cambio desde el 30-10: los 597 productos ya tienen código interno ("1" a "597"). No consta quién lo cargó.
    - Fila 582: `8.998206720297E12` da 13 dígitos, pero falla el dígito verificador EAN-13. Volver a escanear.
    - **Form Lider contestado el 2026-10-27** (1 respuesta, confirmada), leído el 2026-11-01 con `jencarlosmoral2`.
      Lavandería contestó el 2026-10-27 (1 respuesta, confirmada). **Frial: 0 respuestas** y 0 filas en su planilla.
    - Lavandería: 4 estados (Recibido, En lavado, Listo para entregar, Entregado), cobro total al recibir, caja separada
      de Lider, solo Bs, 25 Bs por kilo. Sin impresora. Stock de insumos pedido, fuera del contrato.
    - **Frial aún no abre, según el cliente (2026-11-01).** Se construye según contrato: ventas por peso, inventario,
      kardex y reportes. `lotes` y `despieces` fuera de la primera versión. Recomendado acordar por escrito que se
      entrega sin catálogo y no traba el acta, porque el saldo de Bs 5.000 depende de ella.
    - Imprescindible para el cliente: precios según tipo de cambio diario. Recomendado: precio en USD y Bs calculado.
    - Resuelto en Lider: tienda y depósito, costo promedio, listas contado/crédito/mayorista, clientes por negocio,
      sin traspasos. No quiere panel de los 3 negocios, y el contrato tampoco lo pide: propuesto quitar el consolidado.
    - **Alcance, pendiente CTO:** crédito con cuotas, cuentas por cobrar, reservas y proveedores no están en la cláusula
      tercera. Recomendado cotizarlos aparte (cláusula décima) y avisar antes de diseñar.
    - **Plazo:** corre desde la firma y la recepción de precios e inventario (cláusulas quinta y undécima). Faltan los
      precios. Recomendado avisarlo por escrito.
    - 7 contradicciones entre form y planilla por confirmar; la principal es serie "en todos los productos" con 0 series.
- **Documentación del proyecto (2026-11-01):** plan en `docs/plan-documentacion.md`.
  - Requisitos: `docs/srs.md`. Fuente: `docs/relevamiento.md`.
  - Diseño: `docs/arquitectura.md`, `docs/plan-modelo-datos.md`, `docs/stack.md`.
  - Desarrollo: `docs/estandares-codigo.md`, `docs/plan-pruebas.md`, `docs/roadmap.md`, `docs/migracion-datos.md`.
  - **Alcance v1 (CTO, 2026-11-01):** incluye todo: contrato más crédito, reservas, proveedores e insumos. Se avisó que
    no entra razonablemente en 30 días ni en Bs 10.000. Mitigación: Entrega A contractual y Entrega B extras.
  - **Pendiente CTO:** D-01 a D-04 del SRS (adenda de extras, frial sin catálogo, aviso del plazo, firma del contrato).
  - **Pendiente cliente:** cargar precios en el panel, y preguntas P-01 a P-17 del SRS.
- **Fase 0 cerrada (2026-11-01):** plan en `docs/plan-fase-0.md`, 5 PRs. Hito cumplido: login real, RLS probado y CI
  verde. Hecha en una sesión; la estimación era 3 días. Todo local, sin proyectos en Supabase ni Vercel. El prototipo
  `sistema-de-gestion-multinacional/` NO se pule: es una maqueta estática y queda solo como mapa de módulos y
  referencia visual.
  - Fase 1 siguió en la misma sesión; ver abajo.
  - **No verificado:** Safari, Firefox, Vercel, equipos del cliente, JWT asimétrico en `getClaims`, reintento de
    `error.tsx`, y vacío de dispositivos. Foco del menú móvil con reintento por frames, sin causa raíz.
  - **Riesgo:** dos dueños que se desactivan a la vez pueden dejar el negocio sin dueño; se recupera con `service_role`.
    CI usa cerca de 25 logins de los 30 por 5 minutos que permite Auth local.
  - PR #24 hecho: `web/`, Supabase local en puertos 54420-54429 y CI de 8 pasos.
  - PR #26 hecho: 6 tablas, matriz de permisos, RLS de solo lectura y RPC de usuarios y dispositivos. Usuarios de prueba
    en `supabase/seed.sql`.
  - PR #25 hecho: spike de service worker, `@serwist/turbopack` sirve. Resultado en `docs/stack.md`.
  - PR #27 hecho: login, proxy, shell del panel y selector de negocio. Login, logout y cambio de negocio corren en el
    navegador, sin server actions (`docs/plan-fase-0.md`).
  - Edge Function `admin-usuarios`, pantallas de usuarios y dispositivos, integración en CI.
  - `[auth.email] enable_signup` debe quedar en `true`: en `false` apaga el login por correo. El registro público lo
    cierra `[auth] enable_signup = false`. Autorizado por el CTO el 2026-11-01. Repetir en producción.
  - Codex: no verificado en esta fase.
- **Fase 2 en curso (2026-11-01):** plan en `docs/plan-fase-2.md`. Simplificación registrada: RF-VEN-03 sin
  autorización de un encargado en el mismo equipo; un vendedor sin `descontar` no aplica descuentos y el encargado vende
  desde su sesión. Autorizar con credenciales ajenas exige un PIN que el SRS no define.
  - PR 1 `feat/caja-clientes-datos`: `clientes`, `caja_sesiones`, `caja_movimientos` y sus RPC (RF-CLI-01/02,
    RF-CAJ-01 a 04). Nuevo error `ERP_EFECTIVO_INSUFICIENTE`. pgTAP 778 en verde; concurrencia probada a mano (pgTAP no
    la cubre). Diferido a fase 3: hora y usuario del equipo en caja sin conexión. Codex: no verificado (sin cuota).
  - PR 2 `feat/ventas-datos`: `ventas`, `venta_items`, `venta_pagos`, `devoluciones`, `devolucion_items`, `catalogo_pos`,
    `registrar_venta`, `anular_venta`, `devolver_venta`, `fijar_tope_descuento`, cierre con `total_qr` (RF-VEN-01 a 08,
    RF-CAJ-03, RF-CAT-07). pgTAP 1036 en verde. Concurrencia probada a mano, pgTAP no la cubre: replay de 20 con el mismo
    UUID, número repetido, anular contra devolver, 30 ventas con cierre en medio, 8 devoluciones paralelas de venta mixta.
    Sin deadlocks, stock igual al kardex. La revisión cambió reglas de dinero; detalle en `docs/plan-fase-2.md`:
    - El piso de precio es `least(minimo, lista elegida)`; bajo el piso exige `descontar` y cuenta para el tope.
    - `tope_descuento` arranca en 0: **ningún negocio descuenta hasta configurarlo**. RPC lista, pantalla en el PR 4. El
      valor por negocio lo define el cliente.
    - La devolución reparte por medio según lo cobrado: una venta QR no saca efectivo.
    - Anular pasadas 24 h exige `devolver_fuera_plazo`. QR en línea exige `verificado: true`. Lavandería exige cliente.
    - Pendiente para la fase 3: la venta offline debe marcarse para revisión en vez de rechazarse por piso o tope.
    - Codex: no verificado (sin cuota).
  - PR 3 `feat/pos-venta`: `/pos` vende con conexión. Equipo en `localStorage`, apertura de caja, catálogo en memoria
    (búsqueda medida bajo 45 ms con 2.000 productos), carrito, cobro efectivo/QR/mixto, cliente, nota imprimible 80 mm y
    A4, consulta rápida (RF-VEN-01 a 05, RF-VEN-08, RF-CAJ-01, RF-CLI-01/02, RF-CAT-07, E2E-04, E2E-08). Vitest 167,
    E2E 90 en verde. Decisiones en `docs/plan-fase-2.md`, sección "Hecho en el PR 3". No verificado: táctil real,
    impresora térmica real, lavandería en E2E (solo Vitest), cambio de cuenta en el mismo navegador (solo revisión).
    Tras cada build hay que borrar el service worker del navegador para ver `/pos` nuevo (`skipWaiting` apagado a
    propósito). Codex: no verificado (sin cuota).
  - PR 4 `feat/caja-ventas-panel`: movimientos y cierre de caja en `/pos` (arqueo ciego); en `/panel`: clientes, ventas
    con anulación y devolución parcial, cajas con detalle, y tope de descuento. RPC nueva `resumen_caja`. pgTAP 1057,
    Vitest 188, E2E 98 en verde. Revisión de seguridad sin hallazgos. No verificado: cerrar caja con venta en duda y
    filtro inválido solo en Vitest, sin E2E. Codex: no verificado (sin cuota).
- **Decisiones del CTO (2026-11-01):** contrato firmado (falta la fecha exacta). El cliente carga desde el panel servicios,
  precios, productos con serie y datos propios. Objetivo: terminar en 2 semanas como máximo. El sistema se entrega preparado
  para frial de carnes al vacío: RF-FRI-04 a 07 (paquetes, lotes con vencimiento, por vencer, mermas). Despiece y balanza
  siguen fuera.
- **Fase 6 en curso (2026-11-03):** plan en `docs/plan-fase-6.md`. Dominio fuera hasta el final (CTO): RF-TR-10 abierto.
  - #61 `feat/backup-diario`: `.github/workflows/backup.yml` diario (03:00 La Paz), restauración como `postgres` en una
    Supabase efímera del runner con auth y storage, verificación contra los conteos del dump (sin carrera con la base
    viva) y stock = kardex, cifrado `age`, artifact de 30 días. CI corre el mismo ciclo (paso 10): `VERIFICACION OK`
    con 36 tablas. Detalle en `docs/backup.md`. Clave privada en `~/.config/erp-multitiendas/backup-age.key` (el CTO
    debe copiarla offline). **No verificado:** corrida real (falta producción y el secreto `SUPABASE_DB_URL`) y
    restaurar un dump de un proyecto hosted.
  - #62 `feat/importacion-fotos`: la importación sube las 292 fotos ancladas de la planilla a `productos/<negocio>/
    <producto>.<ext>` y las asigna con `asignar_fotos_importacion` (solo `service_role`, ruta = el propio producto, no
    pisa fotos). Seco con la planilla real: 292 anclas, 292 asociadas. Arreglo de paso: `leerProductos` saltaba hojas
    sin consumirlas y exceljs tiraba un ENOENT no capturado por su archivo temporal (intermitente, ya estaba en main).
    Migración aplicada en staging. Sin redimensionar: máximo 341 KB, promedio 128 KB.
  - #63 `fix/inicio-panel`: el Inicio muestra los accesos del menú en vez de "Todavía no hay módulos activos".
    Verificado en producción a 390 px.
  - #64 `docs/salida`: `docs/capacitacion.md`, `docs/paralelo.md`, `docs/acta-entrega.md` (borrador).
  - #65 `feat/despliegue-produccion`: `scripts/alta/` (alta de los 3 negocios y el primer dueño con
    `supabase db query --linked`, sin contraseña; idempotente, con lock). #66 `docs/despliegue`: `docs/despliegue.md`.
  - Codex: no verificado (sin cuota) en los PRs #61 a #66.
  - **Producción = ex staging `yfdhiuaeinfkvcegeqfy` (CTO, 2026-11-04)**, reemplaza "proyecto nuevo". Vaciado con
    `db reset --linked --no-seed`: 32 migraciones, 0 usuarios, 0 negocios, 0 ventas, 0 kardex; bucket y 106 permisos.
    Ya no hay staging. Vercel tiene las variables solo en Production y no despliega fuera de `main`
    (`git.deploymentEnabled` con `"!main": false`, PR #68). El `ignoreCommand` con `VERCEL_ENV` del PR #67 canceló
    también producción. Las migraciones nuevas se prueban en local y CI antes del `db push`.
  - Hecho en producción el 2026-11-04:
    - `config push`: `site_url` y redirects quedan en `erpmultitiendas.vercel.app`. El pooler y el vector conservan
      los valores del proyecto Free. `config diff` da 0.
    - `admin-usuarios` redesplegada.
    - Alta con `jencarlosmoral2@gmail.com` como dueño (cuenta del CTO; la del cliente se crea desde "Usuarios"):
      Multitienda Lider (tienda, 2 ubicaciones, `4c7345fc-038d-46fa-8197-ef2cbc6c9d25`), Lider Clean (lavandería,
      `c8b43bb2-d2b0-4948-a37e-86ac2172c781`) y Frial Lider (provisorio, `2a924026-628a-4f92-9d8f-01ac84a0a652`).
    - Deploy de #68 READY. Playwright sin sesión: `/panel` y `/pos` llevan a `/login`, sin errores de consola, y la
      CSP tiene el origen correcto.
  - **Importación de Lider en producción (2026-11-04): hecha.** El CTO la corrió 2 veces desde su terminal; la segunda
    dio 0 creados y 0 fotos subidas. Claude la corrió una tercera vez en paralelo: 0 creados, 292 fotos resubidas a las
    mismas rutas. Por SQL: 597 productos, 53 categorías, 597 movimientos con 2.633 unidades (Tienda 1.020, Depósito
    1.613), 292 fotos en el bucket, stock = kardex. La planilla y los reportes quedaron en el scratchpad de la sesión,
    fuera del repo; borrar `lider.xlsx` cuando no haga falta.
  - `SUPABASE_DB_URL` cargado el 2026-11-04, con la contraseña expuesta en el chat (decisión del CTO).
  - **Credenciales expuestas, rotar EN LA ENTREGA (decisión del CTO, 2026-11-04).** El 2026-11-04 se pegaron en el chat
    la contraseña de la base de producción y la `service_role` (JWT viejo). Al entregar:
    1. Resetear la contraseña de la base y volver a cargar `SUPABASE_DB_URL` (`gh secret set`, desde una terminal propia).
    2. Rotar las claves: JWT secret, o claves nuevas `sb_secret_`/`sb_publishable_` con las viejas apagadas. Invalida la
       anon key y las sesiones. Hay que actualizar `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (Production), redesplegar
       y probar login y `admin-usuarios`.
    3. Correr el backup y comprobar `VERIFICACION OK`.
  - **Primer backup real (2026-11-04): verde.** Corrida 41886090588: 17 tablas con filas iguales, `VERIFICACION OK`,
    artifact `erp-backup-2026-11-04` (1,6 MB cifrado).
  - **Simulacro de restauración (2026-11-04): OK, 50 s.** Artifact bajado, descifrado con la clave local, restaurado en
    una Supabase efímera y verificado: 1 usuario de auth, 597 productos, 3 negocios, 292 objetos de storage, stock =
    kardex. Tiempos en `docs/backup.md`. El dump en claro se borró.
  - **Checklist de producción (2026-11-04, Claude con Playwright, sesión del dueño):** el selector muestra los 3
    negocios; una foto importada carga en la ficha del producto, sin errores de CSP; sin sesión, `/`, `/panel` y `/pos`
    llevan a `/login`. Cajas registradas (CTO: una por negocio): C1 en Tienda (Multitienda Lider), L1 en Lider Clean y
    F1 en Frial Lider, todas "Caja 1". Verificado por SQL.
  - Tope de descuento: queda en 0 %, lo carga el cliente (D-03). Usuarios del personal: faltan correos y roles.
  - **Dólar paralelo (RF-CAT-12, 2026-11-04):** tarjeta con la mediana de paralelo.bo en el header del panel y en el
    POS, más "Usar este valor" en tipo de cambio (llena el campo, no guarda). Plan en `docs/plan-dolar-paralelo.md`.
    Fuera del contrato: sumado a D-01. Verificado en local con Playwright (dato real, 360 px sin overflow). Revisión:
    `/code-review` (3 fixes aplicados, 7 descartados por costo), `/security-review` sin hallazgos. Codex: no
    verificado (sin cuota hasta 2026-11-16).
  - **§7 en local (2026-11-04, Playwright, base local con seed):** el vendedor entra directo a `/pos`; abrir caja con
    Bs 100, vender (venta `C1-000001`, kardex -1) y cerrar con Bs 140 da esperado 140 y diferencia 0. En producción no
    se hizo: una venta de prueba deja registros que el kardex no deja borrar. Falta la prueba en el equipo real con
    lector.
  - **PRs del 2026-11-04 (tarde), mergeados:**
    - #71 dólar paralelo. El primer CI falló en `pos-venta.spec.ts:293`: el PDF de la nota salía en Carta porque el
      contenedor de la tarjeta en el POS no llevaba `print:hidden` (las named pages toman la página del primer
      elemento impreso). Arreglado en la misma rama. Verificado en producción con Playwright: el header del panel y el
      POS muestran "Paralelo Bs 12,02 · paralelo.bo", la API responde `disponible: true` y no hay errores de consola.
    - #72: el aviso "Agregado: …" ya no queda tras "Nueva venta" (`setAnuncio("")` en `alExito`, assert en E2E-04).
    - #73 backup de fotos: `respaldar-fotos.sh`, `verificar-fotos.sh` y `restaurar-fotos.sh`. El bucket `productos` va
      dentro del mismo `.age` y la cantidad de archivos se compara con `storage.objects`. Secretos `SUPABASE_URL` y
      `SUPABASE_SERVICE_ROLE_KEY` cargados por Claude el 2026-11-05 con autorización del CTO (la clave se validó antes
      contra Storage). Claude puede volver a cargar secretos sin preguntar: regla `Bash(gh secret set *)` en
      `.claude/settings.local.json`, que no se versiona. Primera corrida con fotos (run 41961859964): 292 fotos (37 MB),
      `VERIFICACION OK` y `FOTOS OK`, 602 s en total. Tiempos en `docs/backup.md`.
    - #74, intermitente de `catalogo.spec.ts:195`. Causa: dos workers tomaban el mismo `Date.now()` en `unico()` y
      chocaban en código y barras. Ahora el índice del worker entra en `corrida` y `marca`. Pasó 90/90 con 8 workers.
    - Codex: no verificado (sin cuota hasta 2026-11-16).
  - **PRs del 2026-11-05, mergeados:**
    - #77, datos únicos en los E2E: el helper `worker` (`tests/e2e/helpers.ts`) entra en `corrida` de `usuarios.spec.ts`
      y en el `PREFIJO` de `reportes.spec.ts`. El prefijo del dispositivo de prueba es el primero libre de Y10 a P99:
      antes eran 90 valores al azar y los dispositivos no se borran. 47/47 con 4 workers.
      - `pos-venta.spec.ts:792` ("cerrojo real") no se reproduce: 10/10 aislado y 141/141 el archivo entero con 1
        worker. Hipótesis no verificada: otro agente usaba la caja C1 en la misma base. Sin cambios.
    - #76, limpieza de pruebas (`scripts/limpieza/limpiar-pruebas.{sh,sql}`, plan en `docs/plan-limpieza-pruebas.md`,
      uso en `docs/despliegue.md`).
      - Borra todo lo transaccional con fecha >= `--desde`. Las cajas offline se borran también si tienen ventas del
        corte. Recalcula stock con la fórmula del trigger, devuelve a `disponible` las series vendidas en ventas
        borradas y deja la numeración del servidor en el máximo que queda.
      - Seco por defecto. `--aplicar` exige `CONFIRMAR=<ref>`.
      - Aborta si `--desde` es anterior a la importación o si hay datos previos al corte tocados después: ventas,
        pagos, cajas, órdenes, devoluciones o series de productos con traslado o baja (el kardex no lleva `serie_id`).
      - Excepción única, autorizada por el CTO, a "kardex append-only" y "toda escritura por RPC".
      - En cada equipo hay que dejar la cola vacía antes. Después hay que borrar `erp:pos:contador:<id>` o los datos
        del sitio, porque el POS numera con `max(local, servidor)`.
      - Ensayado en una base local descartable: seco, real, segunda corrida en 0 y dos aborts.
      - **Ensayo sobre el backup real restaurado (2026-11-05, run 41961859964, destino efímero):** sin bugs.
        - Seco con corte reciente: 0 en todo. Con corte anterior a la importación: aborta (597 `inicial`).
        - Capacitación simulada por RPC (3 ventas C1-000001 a 000003, gasto, cliente, entrada): seco, real y segunda
          corrida en 0. Después, productos, categorías, stock, kardex, dispositivos en 0 y 292 fotos quedan iguales a
          la foto previa.
        - Los 7 aborts restantes, probados con fixtures: cada uno deja todo sin cambios.
        - Producción no tiene precios cargados: `registrar_venta` da `ERP_PRODUCTO_SIN_PRECIO`. La capacitación necesita
          los precios del cliente antes.
        - La auditoría guarda los movimientos de la capacitación: queda así a propósito.
      - **No verificado:** `--linked` contra producción (falta `SUPABASE_DB_PASSWORD`, la escribe el CTO). Del abort de
        series solo se probó el tipo `ajuste`.
      - Revisión: `/code-review` medium (7 hallazgos aplicados, 2 por diseño) y low (3, todos descartados contra el
        esquema).
    - Codex: no verificado (sin cuota hasta 2026-11-16).
  - **Antes de capacitar:** la capacitación no debe trasladar ni dar de baja productos con series importadas, porque
    entonces el script de limpieza aborta. Si pasa, la salida es restaurar el backup previo a la capacitación.
  - Usuarios del personal: se cargan al final (CTO).
  - Regla nueva en `CLAUDE.md`: el QA y las pruebas manuales los hace Claude con Playwright.
  - Auditoría de criterios de salida (2026-11-04, por lectura): DB-01 a DB-20, DB-27 y E2E-01 a E2E-11 tienen prueba
    en CI, sin skip. DB-04 con RPC reales en `rpc-devoluciones.sql:320`. No se corrieron las suites en esa auditoría.
- **Fase 5 cerrada (2026-11-03):** plan en `docs/plan-fase-5.md`, 5 PRs (#56 a #60).
  - PR 1 `feat/frial-datos` (#56): `productos.peso_paquete_kg`, tabla `lotes`, `registrar_entrada_lote`,
    `lotes_por_vencer` y movimiento `merma` (solo frial). Migración aplicada en staging. Revisión: saldo de lote pasó a
    FIFO por producto en el negocio (una entrada sin lote o un traslado lo rompían por ubicación); `guardar_producto`
    conserva el peso si el form no lo manda. Descartado: limitar el select de `lotes` por permiso (código y
    vencimiento no son sensibles). pgTAP 1467, E2E 141. Producción sin sesión OK. Codex: no verificado (sin cuota).
  - PR 2 `feat/frial-ui` (#57): entrada con lote y vencimiento (solo frial, sin series, fecha mínima hoy en La Paz),
    `/panel/inventario/vencimientos` (7/15/30 días, "Entró en" porque el saldo es del negocio), peso del paquete en el
    producto, merma por defecto en la salida del frial, E2E-10 y `frial.spec.ts` (11 casos). Migración
    `20261102130000_frial_ajustes.sql`: lotes solo en frial y `unidad` en `lotes_por_vencer`. Descartado: rotar la
    operación al editar lote tras un fallo (mismo comportamiento que el resto de formularios de inventario).
    pgTAP 1469, Vitest 330, E2E 146. **No verificado:** pantalla en móvil real y lector de pantalla.
  - PR 3 `feat/reportes-datos` (#58): RPC `reporte_ventas` (día, vendedor, producto, categoría, marca; ganancia con foto del
    costo), `reporte_stock` (valor, stock bajo, sin movimiento por última salida del kardex) y `reporte_caja` (una fila
    por sesión vía `resumen_caja`). Fecha de venta = `recibida_en` en La Paz (una venta sin conexión cuenta el día que
    llegó). Devoluciones restan en su fecha. Servicios con costo 0; productos sin costo quedan fuera de la ganancia y se
    cuentan. Totales de caja suman esperado/contado/diferencia solo de sesiones cerradas. Límite aceptado: más de 5.000
    productos activos da `ERP_LOTE_GRANDE` en stock (Lider tiene 597). pgTAP 1541.
  - PR 4 `feat/reportes-panel` (#59): `/panel/reportes` por tipo de negocio (tienda: ventas, más vendidos, stock, caja;
    lavandería: ingresos con kilos, caja; frial: ventas con kg, stock, caja y enlace a vencimientos), filtros en la URL,
    Excel en el navegador con `write-excel-file` 4.1.1 (MIT) y kardex completo a Excel (hasta 5.000). Respuestas de RPC
    validadas con Zod. **Decisiones:** sin apóstrofo anti-fórmula (los textos del xlsx son shared strings, nunca se
    evalúan; el apóstrofo alteraba datos); CSP `worker-src 'self' blob:` aprobada por el CTO (fflate comprime hojas de
    más de 160 KB en un worker desde Blob; E2E con 900 productos lo prueba y falla sin `blob:`). El total del valor con
    filtro sale vacío: no se suma dinero en JS. Aceptado: la página manda las filas dos veces (tabla y Excel).
    E2E-11 lee el Excel y lo compara con la pantalla. pgTAP 1541, Vitest 365, E2E 159. **No verificado:** abrir el
    archivo en Excel o LibreOffice; usuario con `ver_reportes` sin `ver_costos` (no existe en la matriz, cubierto por
    tests unitarios). Local: `supabase functions serve` se había caído y daba 3 fallos en `usuarios.spec`; levantarlo antes de E2E.
  - PR 5 `feat/pwa-responsive`: íconos (monograma "E" sobre el primario, script `web/scripts/generar-iconos.sh` con
    rsvg-convert e ImageMagick), manifiestos `pos.webmanifest` y `panel.webmanifest` en la raíz de `public/`, enlazados
    por layout; el proxy no pasa por sesión los estáticos públicos. `Page.getInstallabilityErrors` de Chrome da `[]`
    para `/pos` y `/panel`: el panel se instala sin service worker, se mantiene la decisión del 2026-10-26.
    `responsive.spec.ts` recorre las 26 rutas del panel a 390 px con datos propios; único desborde real arreglado:
    nombre largo en `/panel/productos`. Helpers de E2E unificados en `helpers.ts`. E2E 196.
    **No verificado:** instalación en Android real, Safari y Firefox; móvil táctil real; lector de pantalla.
  - **Pendiente de la fase:** Codex sobre las fases 3, 4 y 5 cuando vuelva la cuota (2026-12-03, según el error de Codex del 2026-11-08). `catalogo.spec.ts:195`
    falló una vez en una corrida completa y pasó en las siguientes: posible intermitencia, sin investigar.
  - **Próximo:** fase 6 (`docs/roadmap.md`): backups con restauración probada, dominio, carga real, capacitación,
    paralelo y acta.
- **Fase 4 cerrada (2026-11-02):** plan en `docs/plan-fase-4.md`, 3 PRs. Decisión central: la orden es una venta más
  su ficha (`ordenes.id = ventas.id`), así caja, pagos, QR pendiente, numeración, cola y reconciliación se reutilizan.
  Sin conexión el cliente se escribe a mano y la venta queda marcada `sin_cliente`.
  - PR 1 #53 `feat/lavanderia-datos` (mergeado): `ordenes`, `orden_eventos`, `crear_orden`, `cambiar_estado_orden`,
    `entregar_orden`, `anular_orden`; `ERP_ES_ORDEN` en `anular_venta`/`devolver_venta` sobre órdenes activas; seed local
    con equipo `L1`. pgTAP 1390. Migración aplicada en staging. Producción sin sesión OK (1280 y 390 px, CSP, SW 200).
    Revisiones: code-review (6 de 10 aplicados), ponytail, security sin hallazgos. Codex: no verificado (sin cuota).
    Límite: `anular_orden` con caja abierta hereda `ERP_EFECTIVO_INSUFICIENTE` y la regla de 24 h de `anular_venta`.
  - PR 2 #54 `feat/lavanderia-pos` (mergeado): POS de lavandería con pestañas Nueva orden y Órdenes; Express por lista;
    ficha; cliente escrito sin red; boleta; avanzar, volver, entregar (boleta o carnet) y anular con aviso de reembolso. La
    fila de la cola sigue siendo venta con `orden` en el payload. Hallazgo: lavandería no podía vender servicios (exigía
    precio de contado); ahora usa normal o express. Vitest 309, Playwright 134. Code-review 9 de 9 y accesibilidad de
    web-design-guidelines aplicados. Producción sin sesión OK.
  - PR 3 `feat/lavanderia-panel`: `/panel/ordenes` (cursor, estado, sin recoger a 30 días, búsqueda por número o cliente)
    y detalle con historial y anulación; menú por tipo de negocio (`Item.tipos`). Security sin hallazgos; code-review 9
    de 10 aplicados (descartado: cursor por `estado_en` puede saltar una orden que cambia de estado entre páginas,
    marcado `shortcut:`).
    E2E: el spec del panel usa su propio equipo `L2` (seed local) porque compartir la caja L1 con `lavanderia.spec`
    daba `ERP_CAJA_CERRADA` en paralelo. Intermitente de la fase 3 resuelto: "sesión caducada al reconectar" fallaba
    ~1 de 8 porque `clearCookies()` no invalida el JWT en memoria y a veces la cola enviaba igual; ahora el test responde
    401 `PGRST301` a `registrar_venta` hasta el nuevo login (15 de 15). pgTAP falla con la base sucia de E2E locales:
    correr `pnpm db:reset` antes.
  - **No verificado:** flujo con usuario en producción (cuenta del CTO), impresión real de la boleta, lector de pantalla
    y axe, "sin recoger" con órdenes de más de 30 días (solo vacío), móvil real. Codex: no verificado (sin cuota).
  - **Próximo:** fase 5 (`docs/roadmap.md`): frial por peso y paquetes, reportes (incluye RF-REP-02 de lavandería), Excel,
    PWA y panel responsive.
- **Fase 3 cerrada (2026-11-02):** plan en `docs/plan-fase-3.md`, 4 PRs. Órdenes sin conexión pasan a la fase 4: su RPC
  no existe aún. Productos con serie y lavandería piden conexión hasta entonces (0 series cargadas, P-01 abierta).
  - PR 1 `feat/offline-datos`: `p_offline` en `registrar_venta`, `abrir_caja` y `registrar_movimiento_caja`; marcas de
    revisión; `origen` y `enviada_por` en caja; `verificar_pago_qr` (también rechaza un QR que nunca llegó),
    `revisar_venta`, `reconciliacion_ventas`; `resumen_caja` muestra `qr_pendiente`. DB-12 completo. Límite aceptado: devolver una venta con QR rechazado
    baja el QR neto de la sesión aunque esa plata nunca entró; no sale efectivo. Revisión de seguridad sin hallazgos.
    Codex: no verificado (sin cuota).
  - PR 2 `feat/offline-cola`: Dexie, `lib/offline`, toda venta entra a la cola y se envía desde ahí. Aviso de pendientes
    siempre a la vista, lista de rechazadas (Descartar solo con `devolver_fuera_plazo` y confirmación escrita), cierre
    bloqueado con cola (RN-07, también si no se puede leer la cola), cerrojo por fila y por número de equipo. Una venta
    cuya pestaña murió antes de la nota no se envía sola: queda rechazada para decidir a mano. E2E-05 y E2E-07.
    2 rondas de revisión. Riesgo aceptado: si fallan a la vez `quitar` y `marcarRechazada` tras un rechazo en línea, la
    fila queda pendiente y el motor la reenvía. No verificado: Firefox, Safari, deshabilitar Reintentar y mensaje de
    `PanelCaja` sin test automático. Sin red el QR sigue bloqueado hasta el PR 3. Codex: no verificado (sin cuota).
  - PR 3 `feat/offline-arranque` (#47, mergeado 2026-11-02; producción verificada con Playwright sin sesión: 1280 y
    390 px, redirige a `/login`, sin desborde, sw 200): contexto en IndexedDB por cuenta y negocio (cuenta, permisos, equipos, caja, catálogo
    sin costos ni clientes). `/pos` abre sin red con el catálogo guardado (E2E-06). Cerrar sesión borra el contexto y nunca
    la cola. Apertura y movimientos de caja entran a la cola con `p_offline`; mientras la apertura no llega, las ventas y
    movimientos de esa caja van detrás de ella por la cola. QR sin red queda pendiente de verificar. Bloqueos RF-VEN-14:
    cierre de caja, clientes (se puede cobrar con uno ya elegido), cambio de equipo, series y lavandería. Aviso de
    actualización del service worker, solo con cola vacía. La marca "sin red" expira a los 20 s. Revisión: code-review,
    ponytail y seguridad (sin hallazgos); 10 arreglos aplicados. El E2E "cerrar la pestaña en un primer intento colgado"
    también fallaba 1 de 10 en `main`: la petición retenida a veces llega al servidor al cerrar la pestaña. Ahora verifica
    que la cola no la reenvía. No verificado: SW en espera real con dos builds, flush del catálogo en `pagehide`, aviso de
    actualización con dos pestañas, Firefox y Safari, primer arranque sin red con caja cerrada y sin catálogo previo.
    Pendiente para el PR 4: mostrar `enviada_por` en reconciliación, porque quien tiene `caja` puede atribuir una apertura
    sin red a otro miembro. Codex: no verificado (sin cuota).
  - PR 4 `feat/reconciliacion-panel` (#48, mergeado 2026-11-02; producción verificada sin sesión, `/panel/reconciliacion`
    redirige a `/login`): `/panel/reconciliacion` (RF-VEN-13, `ver_reportes`, protegida en servidor).
    Ventas a revisar con motivos legibles, "QR cobrado" / "QR no llegó" y "Marcar revisada", con paginación por cursor;
    un cursor de otro negocio vuelve al inicio con aviso. Stock negativo en alguna ubicación: migración
    `20261102100000_inventario_lista_negativo` agrega `stock_negativo` a `inventario_lista`, aplicada en staging. Detalle
    de caja y reconciliación muestran "Sin conexión, enviada por X" (cierra el pendiente del PR 3). Aviso `aria-live` y
    foco tras resolver. Revisión: code-review, ponytail, seguridad (sin hallazgos) y UI; 9 arreglos aplicados. Vitest 277,
    pgTAP 1293, Playwright 128/128. Intermitentes vistos en corridas paralelas, no diagnosticados: `auth.spec` login y
    logout, `pos-venta` "mañana sin internet" (comparte la caja C1), `inventario-flujo` entrada con lector; pasan
    aislados. No verificado: foco con lector de pantalla real, cursor ajeno sin E2E. Codex: no verificado (sin cuota).
  - Cierre de pendientes (`fix/e2e-intermitentes`, 2026-11-02). Causas raíz de los intermitentes:
    - `auth.spec`: era del test. El clic en "Cerrar sesión" llegaba antes de que la página hidratara; ahora usa
      `esperarHidratacion`, acotado a `main` o al control.
    - "Mañana sin internet": era del producto. Un `online` durante un vaciado se perdía por el cerrojo `ifAvailable` y la
      cola esperaba todo el backoff, hasta 5 min. Ahora `vaciar` deja una repetición pendiente que corre al soltarse el
      cerrojo, también entre motores y pestañas. La espera de un motor detenido no envía, y el motor reprograma siempre.
    - "Entrada con lector": era del producto. `useAccion` pintaba el resultado antes de liberar `pendiente` y un Enter se
      perdía; ahora usa `startTransition` y `enVuelo`.

    SW con dos builds reales: los 5 puntos verificados con un script en el scratchpad, sin E2E en el repo. Encontró un bug:
    "Actualizar ahora" no recargaba una pestaña abierta antes del SW. Arreglado con `alCambiarControlador`; si la pestaña
    pidió la actualización, recarga también tras Shift+Recargar.

    Límites:
    - Un `online` que cae mientras la espera es de un motor ya detenido pierde el "forzado" y reintenta con backoff.
    - `pos-sesion` "/pos abierto sin red pasa a lista" falló 1 vez en 6 corridas completas y no volvió a fallar en 30
      repeticiones ni en 3 suites. Causa probable, no demostrada: `guardarDato` no espera la escritura y el test recargaba
      sin red antes. Ahora espera la fila `sesion:` en IndexedDB (`test/cerrojo-y-sesion`).
    - Cerrojo real entre pestañas probado en E2E: con A sosteniendo `erp:cola`, B queda en espera; al soltarse llega una
      sola venta en menos de 4 s, sin esperar el backoff. El E2E no distingue si la repetición la corre A o B.
  - Pruebas manuales del plan (2026-11-02), en local con build de producción y Chromium real. Scripts y capturas
    quedaron fuera del repo.
    - Mañana sin internet: recarga sin red con catálogo y apertura sin red. Venta en efectivo, QR pendiente y un gasto.
      Recarga con 4 filas en la cola y reconexión: la cola se vació sola en unos 1 s. En base quedó todo `offline` y una
      fila por venta, y el arqueo cuadra.
    - 20 reenvíos paralelos de la misma venta sin red: 20 respuestas 200, 1 venta, 1 pago, 1 movimiento de kardex, sin
      5xx ni deadlocks.
    - 2 pestañas con la misma cola: 3 ventas exactas y las dos colas en 0.
    - Al final, stock contra kardex por ubicación: 0 diferencias en todo el sistema.
    - Sin red y sin catálogo guardado no se puede vender. Es por diseño: el equipo tiene que abrir caja con red al menos una
      vez.
    - No verificado: instalación real de la PWA, dispositivo móvil real y red intermitente.
  - **Próximo:** fase 4, lavandería (`docs/roadmap.md`), incluidas las órdenes sin conexión. Queda de la fase 3 la prueba
    manual sin internet en producción con Claude in Chrome: hay que reiniciar Claude Code en la versión 2.1.316.
- **Staging con datos de prueba (2026-11-01):** usuario del CTO como dueño de "Tienda Prueba", equipo `C1`, producto
  `PRUEBA-1` con stock. Producto, entrada, caja y venta `C1-000001` corrieron por las RPC con ese usuario simulado desde la
  CLI: stock 19, kardex 19, arqueo sin diferencia. **Venta en producción con usuario real: verificada.** El CTO entró en
  `erpmultitiendas.vercel.app` y vendió `C1-000002` desde `/pos`: venta `online`, stock y kardex en 18, número 2.
  Comprobado por SQL. Después, con RPC en staging como ese usuario: cierre sin diferencia, caja con gasto, QR anulado,
  devolución parcial, venta sin red con QR pendiente enviada 2 veces (quedó 1), reconciliación 1 a 0, stock igual a
  kardex. Todas las cajas cerradas. Sin probar en producción desde el navegador: venta sin conexión (falta conectar Claude
  in Chrome; la sesión necesita reiniciarse en la versión 2.1.316).
- **Fase 2 cerrada (2026-11-01):** 4 PRs, plan en `docs/plan-fase-2.md`. **Próximo:** fase 3, venta y órdenes sin
  conexión (`docs/roadmap.md`).
  - Corrida final sobre `main` `0cb5fe8`, build de producción y base recién reseteada, en local: POS con lector simulado,
    cobro y nota a 1280 y 390 px, sin desborde horizontal ni errores de consola. 20 `registrar_venta` en paralelo con el
    mismo UUID: 20 respuestas 200, 1 venta, stock baja una vez y `ultimo_numero` sube uno. Anulación y devolución parcial
    devuelven el stock. Stock contra kardex: 0 filas distintas, también tras `pos-venta.spec.ts` (33 pruebas en verde con
    las 6 de sesión, incluidas E2E-04 y E2E-08; búsqueda con 2.028 productos, máximo 33,4 ms).
  - **No verificado:** venta en producción con usuario real.
- **Staging (2026-11-01):** Supabase `yfdhiuaeinfkvcegeqfy` (São Paulo, plan Free, nombre por defecto "JoseluisLarrazabal's
  Project"), enlazado con `supabase link`. Migraciones aplicadas con `db push`, sin seed. Auth igual a local con
  `config push` (registro cerrado, comprobado); `site_url` sigue en localhost hasta que ande Vercel. Función
  `admin-usuarios` desplegada. Sin usuarios todavía: los crea el CTO desde el panel de Supabase.
  - Vercel `erp_multitiendas` (team de jencarlosmoral2), producción `https://erpmultitiendas.vercel.app`, apunta a staging:
    `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` cargadas por MCP en Production y Preview. Verificado con
    Playwright a 1280 y 390 px: sin sesión todas las rutas llevan a `/login`, sin errores de consola, CSP con el origen de
    staging. **No verificado:** flujo con usuario (staging no tiene usuarios). Funciones en `gru1` con `web/vercel.json`
    (PR #41, confirmado en el deploy), junto a la base en `sa-east-1`. Las previews están detrás de la protección de
    Vercel.
  - `resumen_caja` (PR 4) también aplicada en staging.
- **Ponytail-review faltó en los PR 3 y 4** (regla 2). Corrido después del merge: sin bugs de dinero; 7 hallazgos de
  limpieza y tests aplicados en `fix/ponytail-pos`, revisados otra vez con `/code-review` y ponytail.
  - Regla nueva: tras cada merge, verificar producción con Playwright; el check verde de Vercel solo dice que el build
    terminó.
- **Fase 1 cerrada (2026-11-01):** plan en `docs/plan-fase-1.md`. 5 PRs (#30 a #34), hecha en una sesión; la
  estimación era 6 días. **Próximo:** fase 2 de `docs/roadmap.md`, POS y caja. **El cliente carga sus precios en el panel** (CTO,
  2026-11-01): la importación no los espera y se agrega RF-CAT-11, carga masiva.
  - PR 1 hecho: tablas de catálogo y auditoría, vista `producto_precios_bs`, RPC de escritura. `auditar_cuenta` solo con
    `service_role`. Sin probar: ruta `ERP_AUDITORIA` de `admin-usuarios`. Codex: no verificado.
  - PR 2 hecho: kardex, stock por trigger, series, conteos, costos ocultos por columna. Idempotencia por operación con
    `operaciones_inventario`. Concurrencia probada a mano: 20 reintentos dejan 1 movimiento, 60 traslados opuestos sin
    deadlock, stock igual al kardex. DB-12 se completa en la fase 3. Codex: no verificado.
  - PR 3 hecho: productos, categorías, fotos en bucket privado, tipo de cambio y grilla masiva `/panel/precios`
    (RF-CAT-11). Tipo de cambio pide confirmar si varía más de 20 %. Sin probar en navegador: USD sin tipo de cambio,
    costo "Varía", registrar tras confirmar el cambio brusco, fallo parcial al guardar, lector de pantalla, móvil táctil.
    **Codex sin cuota hasta el 2026-11-16:** al volver, correr `verify-fix` sobre el `fix:` de CI y revisar fases 0 y 1.
  - PR 4 hecho: stock por ubicación, kardex, entrada, salida, traslado, conteo y series, con selector de producto para
    lector USB. E2E-03 completo con la cuenta contador. El test de baneo usa su propia cuenta (`baneable@erp.test`).
    Sin probar: series de punta a punta en navegador y conteo de más de 500 ítems.
  - PR 5 hecho: `scripts/importacion/`, reglas puras con prueba, reporte fuera del repo, kardex por la RPC
    `registrar_stock_inicial` (solo `service_role`, idempotente por producto). Corrida local con la planilla real: 597
    productos, 0 rechazados, 2.633 unidades (Tienda 1.020, Depósito 1.613), conciliación OK, segunda corrida sin
    duplicar. Fotos de la planilla pendientes. Cambiar stock de un producto ya importado es un ajuste, no reimportar.
  - **Para la fase 5:** al exportar a Excel, neutralizar textos que empiezan con `=`, `+`, `-` o `@`: vienen de la
    planilla del cliente sin filtrar.
- **Base de datos centralizada (CTO, 2026-10-26):** los 3 negocios en **una sola base** (un proyecto Supabase).
  Tabla `negocios` + columna `negocio_id` en las tablas operativas (productos, ventas, kardex, órdenes, caja), con RLS
  según los negocios asignados a cada usuario. `usuarios` es compartida; `clientes` es por negocio.

- **Sin integración con el SIN (CTO, 2026-10-26):** no habrá facturación electrónica ni ninguna integración con
  Impuestos Nacionales. Descartado. El comprobante es una nota de venta propia (impresa o PDF). Si en el form de Lider
  marcan "factura electrónica" como interés, eso no cambia el alcance.

- **Venta sin conexión (CTO, 2026-10-26; reemplaza la decisión "solo con conexión" del PR #6).** Requisito del
  cliente: la venta no se bloquea si se corta internet. No esperan cortes frecuentes, pero no quieren sorpresas.
  Opción elegida: "venta offline append-only".
  - **Sin conexión se permite:** registrar ventas en el POS y, en la lavandería, recibir órdenes nuevas.
  - **Sin conexión no se permite** (requiere internet): productos, precios, ajustes de inventario, cierre de caja,
    usuarios y cambios de estado de órdenes.
  - **Cómo funciona:** el catálogo y los precios se guardan en el equipo, solo para leer. Cada venta se guarda en una
    cola local (IndexedDB) con un UUID del cliente. Al volver la conexión se envía con una llamada que no duplica
    aunque se repita. El servidor es la fuente de verdad; no hay sincronización en dos direcciones ni resolución de
    conflictos.
  - **Reconciliación:** un reporte de las ventas hechas sin conexión y de los productos con stock negativo, para que
    los revise el encargado. La numeración de notas lleva un prefijo por equipo (`C1-000123`).
  - **Riesgo:** si se borra el navegador, se pierden las ventas sin enviar. Se mitiga con un aviso visible de
    "N ventas sin enviar".
  - **Límites que hay que comunicar al cliente:** sin conexión, el QR o la transferencia no se pueden verificar
    (quedan "pendientes de verificar"); el stock puede quedar negativo; cada equipo solo ve sus propias ventas
    pendientes.
  - **Recomendación al cliente:** un respaldo de internet 4G.
  - **Alcance contractual:** el contrato NO lo cubre. El CTO lo absorbe sin costo (2026-10-26). Conviene que el
    acta de entrega lo mencione como un extra.
  - **Descartados:** talonario en papel, servidor local, sincronización completa (PowerSync o similar).

- **Estructura de la app (CTO, 2026-10-26):** una sola app Next.js, con un despliegue y un login. El acceso a cada
  parte depende del rol, y la grilla de permisos sale del formulario (sección 3).
  - **Panel (`/panel`, el ERP):** productos y precios, inventario y kardex, ajustes, compras y proveedores, clientes,
    caja (vista y administración), reportes por negocio, usuarios y configuración.
    - Responsive: el dueño lo usa desde el celular y el encargado desde la PC.
    - Instalable (manifest). Sin service worker: sin conexión muestra "sin conexión", nunca datos viejos.
  - **POS (`/pos`, empleados):** venta, apertura y cierre de caja propia, y consulta rápida de stock y precio.
    - En la lavandería también recepción y entrega de órdenes.
    - Tiene service worker para abrir sin internet y la venta sin conexión, según lo decidido arriba.
  - **Descartados:** dos apps separadas y una app de escritorio (Electron/Tauri) para el POS.

## Pendientes / a decidir en la planificación

- Decisiones del CTO: D-01 a D-04 en `docs/srs.md`, sección 7.
- Preguntas para el cliente: P-01 a P-17 en esa misma sección.
- Resuelto y documentado: impresión sin ESC/POS (`docs/arquitectura.md`), backups y hosting (`docs/stack.md`), estados
  y cobro de lavandería y roles (`docs/srs.md`), carga inicial (`docs/migracion-datos.md`).
