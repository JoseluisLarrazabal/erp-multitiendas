-- Borra lo transaccional con fecha >= :desde y deja el resto intacto (docs/plan-limpieza-pruebas.md).
-- Uso (lo corre limpiar-pruebas.sh): psql -v desde='<ISO>' -v aplicar=true|false -f limpiar-pruebas.sql
-- Una transacción: en seco (aplicar=false) termina en ROLLBACK e imprime solo conteos. Cualquier verificación que falle aborta todo.
-- Excepción única y autorizada al kardex append-only y a "toda escritura por RPC": solo este script, antes del paralelo.
\set ON_ERROR_STOP 1
\pset footer off
begin;
-- Apaga triggers append-only y FKs solo dentro de esta transacción (igual que restaurar.sh). El orden de borrado
-- igual va de hijos a padres. No se toca auth.*, usuario_negocio, productos, precios, categorías, fotos ni auditoría.
set local session_replication_role = replica;
select set_config('limpieza.desde', :'desde'::timestamptz::text, true) as _ \gset

create temp table _resumen (orden serial, tabla text, filas bigint) on commit drop;
-- Ventas del corte por la hora del servidor; las cajas por abierta_en o por tener una de esas ventas
-- (la caja offline usa la hora del cliente, que puede ir desfasada).
create temp table _ventas on commit drop as
  select id from public.ventas where recibida_en >= current_setting('limpieza.desde')::timestamptz;
create temp table _sesiones on commit drop as
  select id from public.caja_sesiones where abierta_en >= current_setting('limpieza.desde')::timestamptz
  union select caja_sesion_id from public.ventas where id in (select id from _ventas);
create temp table _stock_afectado on commit drop as
  select distinct producto_id, ubicacion_id from public.movimientos_inventario
  where created_at >= current_setting('limpieza.desde')::timestamptz;
-- Series de las ventas que se borran: vuelven a disponible.
create temp table _series_a_revertir on commit drop as
  select distinct i.serie_id as id from public.venta_items i
  where i.venta_id in (select id from _ventas) and i.serie_id is not null;

do $$
declare
  v_desde timestamptz := current_setting('limpieza.desde')::timestamptz;
  n bigint;
  m record;
begin
  if v_desde > now() then
    raise exception 'desde (%) está en el futuro', v_desde;
  end if;

  -- Verificaciones previas: lo anterior a desde no se toca. Si algo previo cambió después del corte, se aborta
  -- (también en seco) y hay que elegir otro --desde. Solo se nombran ids, nunca datos.
  select count(*) into n from public.movimientos_inventario where tipo = 'inicial' and created_at >= v_desde;
  if n > 0 then
    raise exception 'ABORTA: --desde es anterior a la importación (% movimientos de stock inicial dentro del corte)', n;
  end if;
  for m in select id from public.ventas
           where id not in (select id from _ventas) and (anulada_en >= v_desde or revisada_en >= v_desde) limit 1 loop
    raise exception 'ABORTA: la venta previa % fue anulada o revisada después de --desde; elegí otro --desde', m.id;
  end loop;
  for m in select p.id from public.venta_pagos p
           where p.venta_id not in (select id from _ventas) and p.verificado_en >= v_desde limit 1 loop
    raise exception 'ABORTA: el pago previo % fue verificado después de --desde; elegí otro --desde', m.id;
  end loop;
  for m in select id from public.caja_sesiones
           where id not in (select id from _sesiones) and cerrada_en >= v_desde limit 1 loop
    raise exception 'ABORTA: la caja previa % se cerró después de --desde; elegí otro --desde', m.id;
  end loop;
  for m in select id from public.caja_movimientos
           where sesion_id not in (select id from _sesiones) and created_at >= v_desde limit 1 loop
    raise exception 'ABORTA: el movimiento de caja % entró en una caja previa después de --desde; elegí otro --desde', m.id;
  end loop;
  for m in select id from public.ventas
           where id not in (select id from _ventas) and caja_sesion_id in (select id from _sesiones) limit 1 loop
    raise exception 'ABORTA: la venta previa % está en una caja que se borra; elegí otro --desde', m.id;
  end loop;
  for m in select distinct e.orden_id from public.orden_eventos e
           where e.orden_id not in (select id from _ventas) and e.created_at >= v_desde limit 1 loop
    raise exception 'ABORTA: la orden previa % tiene eventos después de --desde; elegí otro --desde', m.orden_id;
  end loop;
  for m in select d.id from public.devoluciones d
           where d.venta_id not in (select id from _ventas) and d.created_at >= v_desde limit 1 loop
    raise exception 'ABORTA: la devolución % es sobre una venta previa a --desde; elegí otro --desde', m.id;
  end loop;
  -- Una reserva previa completada o cancelada después del corte quedaría con su venta o su devolución borradas.
  for m in select id from public.reservas where created_at < v_desde and cerrada_en >= v_desde limit 1 loop
    raise exception 'ABORTA: la reserva previa % se completó o canceló después de --desde; elegí otro --desde', m.id;
  end loop;
  -- movimientos_inventario no lleva serie_id: el kardex no dice qué serie tocó cada movimiento. Si el producto de una
  -- serie previa tuvo traslado, baja, ajuste o daño dentro del corte, no se puede saber a qué estado o ubicación volver.
  for m in select s.producto_id from public.series s
           join public.movimientos_inventario k on k.producto_id = s.producto_id
           where s.created_at < v_desde and k.created_at >= v_desde
             and k.tipo in ('traslado_salida', 'traslado_entrada', 'ajuste', 'danado', 'cambio_garantia',
                            'devolucion_proveedor', 'consumo') limit 1 loop
    raise exception 'ABORTA: el producto con series % tuvo traslado, baja o ajuste dentro del corte; las series no se pueden reconstruir', m.producto_id;
  end loop;

  -- Hijos primero.
  with d as (delete from public.devolucion_items di
             using public.devoluciones dv
             where di.devolucion_id = dv.id and (dv.created_at >= v_desde or dv.venta_id in (select id from _ventas))
             returning 1)
    insert into _resumen (tabla, filas) select 'devolucion_items', count(*) from d;
  with d as (delete from public.devoluciones
             where created_at >= v_desde or venta_id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'devoluciones', count(*) from d;
  with d as (delete from public.reserva_pagos where created_at >= v_desde or caja_sesion_id in (select id from _sesiones) returning 1)
    insert into _resumen (tabla, filas) select 'reserva_pagos', count(*) from d;
  with d as (delete from public.reservas where created_at >= v_desde or venta_id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'reservas', count(*) from d;
  with d as (delete from public.orden_eventos
             where created_at >= v_desde or orden_id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'orden_eventos', count(*) from d;
  with d as (delete from public.ordenes where id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'ordenes', count(*) from d;
  with d as (delete from public.venta_pagos where venta_id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'venta_pagos', count(*) from d;
  with d as (delete from public.venta_items where venta_id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'venta_items', count(*) from d;
  with d as (delete from public.ventas where id in (select id from _ventas) returning 1)
    insert into _resumen (tabla, filas) select 'ventas', count(*) from d;
  with d as (delete from public.caja_movimientos where sesion_id in (select id from _sesiones) or created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'caja_movimientos', count(*) from d;
  with d as (delete from public.caja_sesiones where id in (select id from _sesiones) returning 1)
    insert into _resumen (tabla, filas) select 'caja_sesiones', count(*) from d;
  with d as (delete from public.proveedor_pagos where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'proveedor_pagos', count(*) from d;
  with d as (delete from public.compra_items ci using public.compras c
             where ci.compra_id = c.id and c.created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'compra_items', count(*) from d;
  with d as (delete from public.compras where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'compras', count(*) from d;
  with d as (delete from public.proveedores where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'proveedores', count(*) from d;
  with d as (delete from public.clientes where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'clientes', count(*) from d;
  with d as (delete from public.conteo_items ci using public.conteos c
             where ci.conteo_id = c.id and c.fecha >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'conteo_items', count(*) from d;
  with d as (delete from public.conteos where fecha >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'conteos', count(*) from d;
  with d as (delete from public.lotes where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'lotes', count(*) from d;
  with d as (delete from public.movimientos_inventario where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'movimientos_inventario', count(*) from d;
  with d as (delete from public.operaciones_inventario where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'operaciones_inventario', count(*) from d;
  with d as (delete from public.series where created_at >= v_desde returning 1)
    insert into _resumen (tabla, filas) select 'series', count(*) from d;

  -- Series previas vendidas en ventas que se borraron: vuelven a disponible.
  with d as (update public.series set estado = 'disponible'
             where id in (select id from _series_a_revertir) and estado in ('vendida', 'devuelta') returning 1)
    insert into _resumen (tabla, filas) select 'series revertidas a disponible', count(*) from d;

  -- Stock: se rehace (mismo cálculo que aplicar_movimiento_a_stock) solo donde se borró kardex, en el orden del kardex.
  delete from public.stock s using _stock_afectado a
  where s.producto_id = a.producto_id and s.ubicacion_id = a.ubicacion_id;
  for m in
    select k.* from public.movimientos_inventario k
    join _stock_afectado a on a.producto_id = k.producto_id and a.ubicacion_id = k.ubicacion_id
    order by k.created_at, k.id
  loop
    insert into public.stock as s (negocio_id, producto_id, ubicacion_id, cantidad, costo_promedio)
    values (m.negocio_id, m.producto_id, m.ubicacion_id, m.cantidad,
            case when m.tipo = 'ajuste_costo' or m.cantidad > 0 then m.costo_unitario end)
    on conflict (producto_id, ubicacion_id) do update set
      cantidad = s.cantidad + m.cantidad,
      costo_promedio = case
        when m.tipo = 'ajuste_costo' then m.costo_unitario
        when m.cantidad > 0 and m.costo_unitario is not null then
          case when s.costo_promedio is null then m.costo_unitario
               else (greatest(s.cantidad, 0) * s.costo_promedio + m.cantidad * m.costo_unitario)
                    / (greatest(s.cantidad, 0) + m.cantidad) end
        else s.costo_promedio end,
      updated_at = now();
  end loop;
  select count(*) into n from _stock_afectado;
  insert into _resumen (tabla, filas) values ('stock recalculado (pares producto-ubicación)', n);

  -- Numeración: cada equipo queda en el mayor número que sobrevive (0 sin ventas). Se calcula una sola vez.
  create temp table _numero on commit drop as
    select dv.id as dispositivo_id, coalesce(max(right(v.numero, 6)::integer), 0) as maximo
    from public.dispositivos dv left join public.ventas v on v.dispositivo_id = dv.id
    group by dv.id;
  with d as (update public.dispositivos dv set ultimo_numero = x.maximo
             from _numero x where x.dispositivo_id = dv.id and dv.ultimo_numero <> x.maximo returning 1)
    insert into _resumen (tabla, filas) select 'dispositivos con numeración reiniciada', count(*) from d;

  -- Aserciones: si una falla, todo se deshace.
  if exists (
    select 1 from public.stock s
    full join (select producto_id, ubicacion_id, sum(cantidad) as q from public.movimientos_inventario
               group by 1, 2) k using (producto_id, ubicacion_id)
    where coalesce(s.cantidad, 0) <> coalesce(k.q, 0)) then
    raise exception 'ABORTA: stock distinto de la suma del kardex';
  end if;
  select (select count(*) from public.ventas where recibida_en >= v_desde or anulada_en >= v_desde or revisada_en >= v_desde)
       + (select count(*) from public.ventas where caja_sesion_id not in (select id from public.caja_sesiones))
       + (select count(*) from public.venta_items where venta_id not in (select id from public.ventas))
       + (select count(*) from public.venta_pagos where venta_id not in (select id from public.ventas) or verificado_en >= v_desde)
       + (select count(*) from public.devoluciones where created_at >= v_desde or caja_sesion_id not in (select id from public.caja_sesiones))
       + (select count(*) from public.devolucion_items where devolucion_id not in (select id from public.devoluciones))
       + (select count(*) from public.ordenes where id not in (select id from public.ventas))
       + (select count(*) from public.orden_eventos where created_at >= v_desde or orden_id not in (select id from public.ordenes))
       + (select count(*) from public.caja_sesiones where abierta_en >= v_desde or cerrada_en >= v_desde
            or id in (select id from _sesiones))
       + (select count(*) from public.caja_movimientos where created_at >= v_desde or sesion_id not in (select id from public.caja_sesiones))
       + (select count(*) from public.clientes where created_at >= v_desde)
       + (select count(*) from public.proveedor_pagos where created_at >= v_desde
            or compra_id not in (select id from public.compras))
       + (select count(*) from public.compra_items where compra_id not in (select id from public.compras))
       + (select count(*) from public.compras where created_at >= v_desde)
       + (select count(*) from public.proveedores where created_at >= v_desde)
       + (select count(*) from public.conteos where fecha >= v_desde)
       + (select count(*) from public.conteo_items where conteo_id not in (select id from public.conteos))
       + (select count(*) from public.lotes where created_at >= v_desde)
       + (select count(*) from public.movimientos_inventario where created_at >= v_desde)
       + (select count(*) from public.operaciones_inventario where created_at >= v_desde)
       + (select count(*) from public.series where created_at >= v_desde
            or (estado = 'vendida' and id not in (select serie_id from public.venta_items where serie_id is not null)))
       + (select count(*) from _numero x join public.dispositivos dv on dv.id = x.dispositivo_id where dv.ultimo_numero <> x.maximo)
    into n;
  if n <> 0 then
    raise exception 'ABORTA: % filas transaccionales >= desde, huérfanas o inconsistentes', n;
  end if;
end;
$$;

select 'desde' as dato, :'desde'::timestamptz::text as valor
union all select 'modo', case when :aplicar then 'APLICAR' else 'SECO (rollback)' end;
select tabla, filas from _resumen order by orden;

\if :aplicar
commit;
\echo 'COMMIT hecho.'
\else
rollback;
\echo 'ROLLBACK: corrida en seco, no se cambió nada.'
\endif
