# Plan: limpieza de las pruebas antes del paralelo

Pedido del CTO (2026-11-04): al entregar, borrar todo lo de prueba y conservar el inventario. Se corre una sola vez,
después de la capacitación y antes del paralelo. Nunca después del paralelo: esas ventas son reales.

## Diseño

- **Corte por fecha.** El script borra todo lo transaccional con fecha >= `--desde` (el inicio de la capacitación) y
  conserva lo anterior: la importación, el conteo físico (P-17) si se hizo antes y la configuración.
- **Se borra (>= desde):** ventas y sus líneas, pagos y series vendidas; anulaciones y devoluciones; sesiones y
  movimientos de caja; órdenes de lavandería y sus estados; clientes creados; compras, sus líneas, pagos a proveedores y proveedores creados; movimientos de inventario de cualquier
  tipo; cola y reconciliación offline. El mapa exacto de tablas sale del esquema, no de esta lista.
- **Se conserva:** negocios, ubicaciones, usuarios y membresías, dispositivos, permisos, productos, categorías,
  precios, tipos de cambio, tope de descuento, fotos y auditoría.
- **Después de borrar:** recalcular `stock` desde el kardex que queda y dejar la numeración de cada dispositivo en el
  máximo que quede (0 si no hay ventas), para que la primera venta real sea `C1-000001`.
- **Una transacción** como `postgres`, con los triggers append-only desactivados solo dentro de ella
  (`session_replication_role = replica`, igual que `restaurar.sh`). Al final se verifica stock = kardex y se aborta si
  no coincide.
- **Seco por defecto:** sin `--aplicar` solo cuenta qué borraría. Con `--aplicar` exige `CONFIRMAR=<ref del proyecto>`.

## Verificación

- Ensayo en local: seed + ventas de prueba hechas por RPC, corrida en seco, corrida real y comprobación (0 ventas
  >= desde, stock = kardex, numeración reiniciada, productos y precios intactos).
- Antes de producción: el mismo ensayo sobre el último backup restaurado en local (`docs/backup.md`), y un backup
  manual en verde justo antes de aplicar.

- Ensayo del 2026-11-10 (PR 3 de la preentrega, base local): `db reset`, la suite completa de Playwright (269 pruebas:
  92 ventas, compras, anulaciones, reversos, reservas, créditos y lotes), corrida en seco con `--desde` un segundo
  después del seed (cuenta y termina en rollback; las 92 ventas siguen) y corrida con `--aplicar`: 0 ventas, 0
  compras, 0 `compra_anulaciones`, 0 pagos de cuota, 0 pagos a proveedor, 0 reservas, 0 movimientos posteriores al
  corte y `stock` igual a la suma del kardex en todos los pares. El script cubre desde ese PR `compra_anulaciones` y
  `caja_revisiones`, con tres abortos nuevos (compra o pago a proveedor previos anulados después del corte; revisión
  de caja posterior sobre algo que se conserva). No verificado en ese ensayo: que la numeración de cada equipo vuelva
  a la del seed y un humo de Playwright después de limpiar. El ensayo sobre el último backup restaurado sigue
  pendiente antes de producción.

## Excepción autorizada

Este script es una excepción **única**, autorizada por el CTO, a dos reglas del proyecto: "el kardex es append-only" y
"toda escritura contable va por RPC". Vale solo para `scripts/limpieza/limpiar-pruebas.sql`, una vez, antes del paralelo.
No sirve de precedente para borrar datos después.

## Reglas de abortar (corren también en seco)

El script aborta, sin cambiar nada, si: hay stock inicial (`inicial`) dentro del corte (`--desde` es anterior a la
importación); una venta previa a `--desde` fue anulada o revisada después, o un pago previo fue verificado después; una
caja previa se cerró después o recibió movimientos; una venta previa cuelga de una caja que se borra; una orden previa
tiene eventos después; hay una devolución sobre una venta previa; o un producto con series tuvo traslado, baja, ajuste o
daño dentro del corte (el kardex no lleva `serie_id`, así que no se puede reconstruir el estado de la serie). En todos los
casos se elige otro `--desde`. Las cajas se borran también si tienen alguna venta del corte (la caja offline usa la hora
del cliente).
