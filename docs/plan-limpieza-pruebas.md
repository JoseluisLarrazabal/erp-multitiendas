# Plan: limpieza de las pruebas antes del paralelo

Pedido del CTO (2026-11-04): al entregar, borrar todo lo de prueba y conservar el inventario. Se corre una sola vez,
después de la capacitación y antes del paralelo. Nunca después del paralelo: esas ventas son reales.

## Diseño

- **Corte por fecha.** El script borra todo lo transaccional con fecha >= `--desde` (el inicio de la capacitación) y
  conserva lo anterior: la importación, el conteo físico (P-17) si se hizo antes y la configuración.
- **Se borra (>= desde):** ventas y sus líneas, pagos y series vendidas; anulaciones y devoluciones; sesiones y
  movimientos de caja; órdenes de lavandería y sus estados; clientes creados; movimientos de inventario de cualquier
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
