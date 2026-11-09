# Plan: manual de usuario final y capacitación con la fase 7

Estado: hecho el 2026-11-09. Se agregó una sección "En el punto de venta" al manual del encargado (venta a crédito), que no estaba prevista.

## Contexto

El CTO pidió el 2026-11-09 que el manual de usuario final y los documentos de entrega incluyan todas las reglas del
sistema. Esas reglas ya están en `docs/decisiones-manual.md`, pero el manual todavía no existe. Además,
`docs/capacitacion.md` no cubre la fase 7 (crédito, reservas, compras e insumos), que ya está en producción.

Nada de esto depende del cliente: se puede hacer ahora, y hay que tenerlo antes de la capacitación y del paralelo.

Decisiones del CTO (2026-11-09):
- **Formato:** la fuente es Markdown versionado en `docs/manual/`. Se exporta a un PDF por rol para imprimir y
  entregar con el acta.
- **Capturas:** solo de los pasos clave, entre 15 y 25. Se sacan con Playwright en local, con datos de `seed.sql`.
  Nunca con datos del cliente.

Resultado: un PR (`docs/manual-usuario`) con 4 manuales por rol, sus capturas, un script que rehace capturas y PDFs, y
`capacitacion.md` al día.

## Estructura

```
docs/manual/
  README.md                índice, a quién va cada PDF, cómo regenerar capturas y PDFs
  vendedor.md              POS: entrar, equipo, caja, vender, cobrar, cliente, sin internet, movimientos, cierre,
                           reservas y crédito/cuotas (tienda y frial), venta por kg (frial)
  lavanderia.md            empleado de lavandería: nueva orden, órdenes, estados, entrega, anulación
  encargado-y-dueno.md     panel completo. Incluye una sección "Solo el dueño": usuarios, dispositivos y descuento
                           en tienda y frial
  contador.md              panel de solo lectura, reportes y costos
  img/*.png                capturas (nombres fijos, ver abajo)
  manual.css               estilo de impresión A4
  dist/                    PDFs generados (en .gitignore; se entregan, no se versionan)
```

Reglas de redacción, las mismas de `capacitacion.md`:
- infinitivo o imperativo con "usted", sin voseo;
- los textos de pantalla van entre comillas y se copian exactos del código;
- cada manual se lee solo, sin depender de los otros.

Cada manual cierra con "Si aparece este mensaje". Toma los mensajes de `web/src/lib/erp-errores.ts` que ve ese rol y
dice qué hacer con cada uno.

Cada regla _vigente_ de `decisiones-manual.md` que afecta a un rol entra en su manual. Cada _supuesto_ (por ejemplo,
P-07, interés sobre saldo) va escrito como supuesto y no como regla. Lo interno no entra: riesgos técnicos, RLS,
hosting.

## Capturas (nombres que comparten el script y los manuales)

**POS de la tienda:**
- `login`
- `pos-elegir-equipo`
- `pos-abrir-caja`
- `pos-carrito`
- `pos-cobro`
- `pos-nota`
- `pos-sin-conexion`
- `pos-cerrar-caja`
- `pos-reserva`
- `pos-credito`
- `pos-cobro-cuota`

**Lavandería y frial:**
- `lav-nueva-orden`
- `lav-ordenes`
- `frial-venta-kg`

**Panel:**
- `panel-inicio`
- `panel-precios`
- `panel-inventario-entrada`
- `panel-venta-detalle`
- `panel-reconciliacion`
- `panel-compra-nueva`
- `panel-proveedores`
- `panel-creditos`
- `panel-insumo-consumo`
- `panel-reportes`
- `panel-usuarios`

## Pasos

1. Guardar este plan en `docs/plan-manual-usuario.md` y poner el puntero en la reanudación de `docs/handoff.md`
   (reglas 8 y 8.b). Rama `docs/manual-usuario`.
2. **En paralelo, 4 subagentes Sonnet:**
   - **A, capturas y exportación (código):**
     - `web/playwright.manual.config.ts`, una config aparte con `testDir: tests/manual`, para que el CI no la corra;
     - `web/tests/manual/capturas.spec.ts`, que reusa `helpers.ts`, `pos-helpers.ts` y el `storageState` de
       `auth.setup.ts`, crea los datos de cada flujo como lo hacen las specs de E2E (`credito.spec.ts`,
       `reservas.spec.ts`, `compras.spec.ts`, `insumos.spec.ts`), usa un viewport fijo de 1280×800 y guarda en
       `docs/manual/img/`;
     - `scripts/manual/exportar.sh`, que pasa cada `.md` a HTML con pandoc 3.1.3
       (`-s --embed-resources --css manual.css`) y el HTML a PDF A4 con `pnpm exec playwright pdf`;
     - el script `manual:capturas` en `package.json` y `docs/manual/dist/` en `.gitignore`.
   - **B, `vendedor.md` y `lavanderia.md`:** desde `decisiones-manual.md`, `capacitacion.md` y los componentes del POS
     (`web/src/modules/{ventas,caja,reservas,credito,lavanderia}`).
   - **C, `encargado-y-dueno.md`, `contador.md` y `README.md`:** desde `decisiones-manual.md`, las páginas de
     `web/src/app/(panel)/panel/**` y `panel-items.ts` (menú y permisos).
   - **D, `capacitacion.md`:**
     - en "Quién ve qué", sumar `gestionar_compras` y los permisos de crédito y reservas, tomados de §1 del registro;
     - una sección POS de reservas y crédito, con cobro de cuotas;
     - filas del panel para Proveedores, Compras, Créditos, consumo de insumos y reporte de Insumos;
     - en "Práctica", sumar reserva con anticipo, venta a crédito, cobro de cuota, compra al contado y a crédito, pago a
       proveedor y consumo de insumo;
     - revisar todo el documento contra `decisiones-manual.md`;
     - quitar el pendiente de la fase 7 y decir que cada persona recibe el PDF de su rol.
3. El chairman corre las capturas en local: `supabase db reset`, después `pnpm build && pnpm manual:capturas`. Mira cada
   PNG para confirmar que muestra el paso que describe el texto, sin datos raros ni errores en pantalla, y lo reintenta
   con el subagente A si falla.
4. **Revisión de trazabilidad, con un subagente Sonnet nuevo:**
   - cada ítem _vigente_ o _supuesto_ de `decisiones-manual.md` que afecta a un rol tiene su lugar en el manual de ese
     rol, o queda marcado como interno;
   - cada texto entre comillas de `docs/manual/*.md` y `capacitacion.md` existe en `web/src` (grep);
   - cada `img/*.png` referenciada existe, y ninguna sobra.

   Lo que encuentre lo corrige otro Sonnet.
5. `/code-review` y `/ponytail-review` sobre el script, la config y la spec de capturas. Los hallazgos los arregla un
   Sonnet. Codex: no verificado (sin cuota).
6. Exportar con `scripts/manual/exportar.sh` y revisar 2 o 3 páginas de cada PDF con Read.
7. Cerrar:
   - commit, push y PR, sin atribución de IA;
   - esperar el CI y mergear;
   - borrar la rama;
   - actualizar el handoff: sacar el manual de los pendientes y anotar en "Cómo usar" de `decisiones-manual.md` que un
     cambio visible también actualiza `docs/manual/` y su captura.

## Trampas

- **Datos:** las capturas salen solo del seed local. Nunca de producción, que puede tener datos del cliente.
- **Textos inventados:** un manual que cita un botón que no existe confunde más que no tener manual. Por eso el grep del
  paso 4 es obligatorio.
- **Capturas inestables:** fechas, números de nota y el dólar paralelo cambian en cada corrida. El script mockea
  `/api/dolar-paralelo` con `page.route`, igual que `catalogo.spec.ts`, para que las capturas no muestren un error de
  red. No se compara contra imágenes de referencia: solo se regeneran.
- **El CI no corre las capturas:** van en una config aparte. Si se agregaran como un proyecto en `playwright.config.ts`,
  el CI las correría.
- **Peso del repo:** unas 25 PNG de alrededor de 100 KB cada una (aproximado). Los PDFs no se versionan.
- **Contradicción D-04 (firma):** no afecta al manual. Sigue abierta para el CTO.

## Verificación

- `pnpm manual:capturas` genera las 25 PNG sin fallos, y cada una se revisó a ojo.
- El grep de los textos entre comillas contra `web/src` no deja ninguno sin encontrar.
- La tabla de cobertura del subagente de trazabilidad queda sin huecos.
- `scripts/manual/exportar.sh` genera 4 PDFs A4 legibles, con las imágenes embebidas.
- El CI está en verde. El PR toca solo `docs/`, `web/tests/manual/`, `web/playwright.manual.config.ts`,
  `scripts/manual/`, `package.json` y `.gitignore`.

## Aparte (no es parte de este plan)

Hay que borrar las 20 ramas remotas y las 9 locales ya mergeadas. El clasificador bloqueó el borrado dos veces, así que
lo corre el CTO con `!`.
