-- M-2 (PR 2 de preentrega, Entrega B): reversos de compras por contraasiento, nunca borrado. Permiso `anular` Y `gestionar_compras`.
-- Errores nuevos: ERP_PAGO_NO_ES_ULTIMO, ERP_PAGO_AUTOMATICO (pago de una compra al contado: solo se revierte con anular_compra),
-- ERP_COMPRA_CON_SERIES, ERP_COMPRA_CON_PAGOS; se reusa ERP_STOCK_INSUFICIENTE. Replays: misma operación = mismo resultado,
-- otro motivo = ERP_OPERACION_REPETIDA, otra operación sobre lo ya revertido = estado `ya_anulada` / `ya_anulado` sin escribir.
--
-- Pagos: el reverso es una fila NEGATIVA en proveedor_pagos con anula_id = el pago original. Así la deuda (suma con signo) se
-- restaura sin cambiar sus lectores. Un pago está vivo si monto > 0 y nadie lo anula.
-- Orden entre pagos: `seq` (identity). created_at no sirve: dentro de una transacción todas las filas comparten now().
--
-- Bloqueos: anular_compra toma la fila del proveedor (for update) y luego el stock de las líneas (bloquear_stock), el mismo orden
-- que registrar_compra (proveedor, luego stock) y pagar_proveedor (proveedor): sin interbloqueo entre ellas.
--
-- Compra anulada = fila en compra_anulaciones (la compra es append-only). deuda_proveedor, deudas_proveedores y lotes_por_vencer
-- la excluyen. Su total sigue saliendo por totales_compras (la web la marca "Anulada").
--
-- shortcut: promedio aproximado si hubo ventas o traslados después de la compra; el cálculo (Q·A − q·c)/(Q − q) supone que el
-- stock y el promedio actuales vienen de las mismas entradas. Las ventas ya hechas conservan su costo (RN-06). Mejorar solo si
-- el cliente anula compras viejas con mucho movimiento posterior.
-- shortcut: una compra al contado se reconoce como "con pago automático" por contar pagos vivos ligados (exactamente 1 si el
-- total > 0); no hay marca en la fila. Un pago manual ligado a una compra al contado bloquea la anulación (ERP_COMPRA_CON_PAGOS).

-- 1. Tipo de movimiento nuevo (lista vigente de 20261102120000_frial.sql + anulacion_compra).
alter table public.movimientos_inventario drop constraint movimientos_inventario_tipo_check;
alter table public.movimientos_inventario add constraint movimientos_inventario_tipo_check check (tipo in (
  'inicial', 'compra', 'entrada', 'venta', 'anulacion_venta', 'ajuste', 'danado', 'cambio_garantia',
  'devolucion_cliente', 'devolucion_proveedor', 'traslado_salida', 'traslado_entrada', 'reserva',
  'reserva_liberada', 'consumo', 'ajuste_costo', 'merma', 'anulacion_compra'
)) not valid;
alter table public.movimientos_inventario validate constraint movimientos_inventario_tipo_check;

-- 2. Compras anuladas. Append-only: una fila por compra, no se deshace.
create table public.compra_anulaciones (
  compra_id uuid primary key,
  negocio_id uuid not null,
  operacion_id uuid not null unique,
  motivo text not null check (btrim(motivo) <> '' and length(motivo) <= 200),
  usuario_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (negocio_id, compra_id) references public.compras (negocio_id, id)
);
create index compra_anulaciones_negocio_idx on public.compra_anulaciones (negocio_id, created_at);
create trigger compra_anulaciones_solo_agregar
  before update or delete on public.compra_anulaciones
  for each row execute function public.rechazar_modificacion();
create trigger compra_anulaciones_sin_truncate
  before truncate on public.compra_anulaciones
  for each statement execute function public.rechazar_modificacion();
alter table public.compra_anulaciones enable row level security;
create policy compra_anulaciones_select on public.compra_anulaciones
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
revoke all on public.compra_anulaciones from anon, authenticated, public;
grant select on public.compra_anulaciones to authenticated;

-- 3. proveedor_pagos con reverso. El check automático de monto se llama proveedor_pagos_monto_check.
alter table public.proveedor_pagos
  add column anula_id uuid references public.proveedor_pagos (id),
  add column motivo text check (motivo is null or (btrim(motivo) <> '' and length(motivo) <= 200)),
  add column seq bigint generated always as identity;
alter table public.proveedor_pagos drop constraint proveedor_pagos_monto_check;
alter table public.proveedor_pagos add constraint proveedor_pagos_monto_ck check (
  monto <> 'NaN' and ((anula_id is null and monto > 0) or (anula_id is not null and monto < 0))
) not valid;
alter table public.proveedor_pagos validate constraint proveedor_pagos_monto_ck;
create unique index proveedor_pagos_anula_uq on public.proveedor_pagos (anula_id) where anula_id is not null;
-- Por columna: el monto sigue sin leerse directo (se lee por ultimo_pago_proveedor y deudas_proveedores).
grant select (anula_id, motivo) on public.proveedor_pagos to authenticated;

-- 4. Deuda: compras vivas menos pagos con signo (los reversos son negativos).
create or replace function public.deuda_proveedor(p_proveedor_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(c.total) from public.compras c
                   where c.proveedor_id = p_proveedor_id
                     and not exists (select 1 from public.compra_anulaciones a where a.compra_id = c.id)), 0)
       - coalesce((select sum(monto) from public.proveedor_pagos where proveedor_id = p_proveedor_id), 0)
$$;
revoke all on function public.deuda_proveedor(uuid) from public, anon, authenticated;

create or replace function public.deudas_proveedores(p_negocio_id uuid)
returns table (proveedor_id uuid, total_compras numeric, total_pagos numeric, deuda numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select p.id, s.compras, s.pagos, s.compras - s.pagos
    from public.proveedores p
    cross join lateral (
      select coalesce((select sum(c.total) from public.compras c
                       where c.proveedor_id = p.id
                         and not exists (select 1 from public.compra_anulaciones a where a.compra_id = c.id)), 0) as compras,
             coalesce((select sum(g.monto) from public.proveedor_pagos g where g.proveedor_id = p.id), 0) as pagos
    ) s
    where p.negocio_id = p_negocio_id;
end;
$$;
revoke all on function public.deudas_proveedores(uuid) from public, anon, authenticated;
grant execute on function public.deudas_proveedores(uuid) to authenticated;

-- 5. Último pago vivo del proveedor (el monto no se lee por columna). null si no hay.
-- `automatico`: está ligado a una compra al contado, así que solo se revierte con anular_compra.
create function public.ultimo_pago_proveedor(p_proveedor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
begin
  select negocio_id into v_negocio_id from public.proveedores where id = p_proveedor_id;
  if v_negocio_id is null or not public.tiene_permiso(v_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return (
    select jsonb_build_object(
      'id', p.id, 'monto', p.monto, 'created_at', p.created_at, 'compra_id', p.compra_id,
      'automatico', exists (select 1 from public.compras c where c.id = p.compra_id and c.condicion = 'contado'))
    from public.proveedor_pagos p
    where p.proveedor_id = p_proveedor_id and p.anula_id is null and p.monto > 0
      and not exists (select 1 from public.proveedor_pagos r where r.anula_id = p.id)
    order by p.seq desc
    limit 1
  );
end;
$$;

-- 6. Revierte un pago a proveedor. Solo el último pago vivo y no el automático de una compra al contado.
create function public.anular_pago_proveedor(p_operacion_id uuid, p_pago_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.proveedor_pagos;
  v_motivo text := btrim(p_motivo);
begin
  select * into v_pago from public.proveedor_pagos where id = p_pago_id;
  if not found
     or not (public.tiene_permiso(v_pago.negocio_id, 'gestionar_compras') and public.tiene_permiso(v_pago.negocio_id, 'anular')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or v_motivo is null or v_motivo = '' or length(v_motivo) > 200
     or v_pago.anula_id is not null or v_pago.monto <= 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(p_operacion_id, v_pago.negocio_id, md5('anular_pago_proveedor:' || p_pago_id || ':' || v_motivo)) then
    return jsonb_build_object('id', p_pago_id, 'estado', 'anulado');
  end if;

  perform 1 from public.proveedores where id = v_pago.proveedor_id and negocio_id = v_pago.negocio_id for update;
  if exists (select 1 from public.proveedor_pagos where anula_id = p_pago_id) then
    return jsonb_build_object('id', p_pago_id, 'estado', 'ya_anulado');
  end if;
  if exists (select 1 from public.compras c where c.id = v_pago.compra_id and c.condicion = 'contado') then
    raise exception 'ERP_PAGO_AUTOMATICO';
  end if;
  if exists (select 1 from public.proveedor_pagos p
             where p.proveedor_id = v_pago.proveedor_id and p.seq > v_pago.seq and p.anula_id is null and p.monto > 0
               and not exists (select 1 from public.proveedor_pagos r where r.anula_id = p.id)) then
    raise exception 'ERP_PAGO_NO_ES_ULTIMO';
  end if;

  insert into public.proveedor_pagos (id, negocio_id, proveedor_id, compra_id, monto, medio, usuario_id, anula_id, motivo)
  values (gen_random_uuid(), v_pago.negocio_id, v_pago.proveedor_id, v_pago.compra_id, -v_pago.monto, v_pago.medio,
          (select auth.uid()), p_pago_id, v_motivo);
  return jsonb_build_object('id', p_pago_id, 'estado', 'anulado');
end;
$$;

-- 7. Anula una compra: revierte el stock por línea, el costo promedio y, al contado, su pago automático.
create function public.anular_compra(p_operacion_id uuid, p_compra_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compra public.compras;
  v_motivo text := btrim(p_motivo);
  v_linea record;
  v_stock public.stock;
  v_vivos integer;
  v_esperados integer;
  v_auto public.proveedor_pagos;
  v_despues numeric;
  v_nuevo numeric;
begin
  select * into v_compra from public.compras where id = p_compra_id;
  if not found
     or not (public.tiene_permiso(v_compra.negocio_id, 'gestionar_compras') and public.tiene_permiso(v_compra.negocio_id, 'anular')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or v_motivo is null or v_motivo = '' or length(v_motivo) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(p_operacion_id, v_compra.negocio_id, md5('anular_compra:' || p_compra_id || ':' || v_motivo)) then
    return jsonb_build_object('id', p_compra_id, 'estado', 'anulada');
  end if;

  -- Mismo orden que registrar_compra: proveedor y después stock.
  perform 1 from public.proveedores where id = v_compra.proveedor_id and negocio_id = v_compra.negocio_id for update;
  perform public.bloquear_stock(v_compra.negocio_id, v_compra.ubicacion_id,
    array(select producto_id from public.compra_items where compra_id = p_compra_id));

  if exists (select 1 from public.compra_anulaciones where compra_id = p_compra_id) then
    return jsonb_build_object('id', p_compra_id, 'estado', 'ya_anulada');
  end if;
  if exists (select 1 from public.compra_items ci join public.productos p on p.id = ci.producto_id
             where ci.compra_id = p_compra_id and p.controla_serie) then
    raise exception 'ERP_COMPRA_CON_SERIES';
  end if;

  -- Pagos vivos ligados: al contado se espera exactamente el automático (si el total > 0); a crédito, ninguno.
  select count(*) into v_vivos from public.proveedor_pagos p
  where p.compra_id = p_compra_id and p.anula_id is null and p.monto > 0
    and not exists (select 1 from public.proveedor_pagos r where r.anula_id = p.id);
  v_esperados := case when v_compra.condicion = 'contado' and v_compra.total > 0 then 1 else 0 end;
  if v_vivos > v_esperados then
    raise exception 'ERP_COMPRA_CON_PAGOS';
  end if;
  if v_vivos = 1 then
    select * into v_auto from public.proveedor_pagos p
    where p.compra_id = p_compra_id and p.anula_id is null and p.monto > 0
      and not exists (select 1 from public.proveedor_pagos r where r.anula_id = p.id);
  end if;
  -- La deuda del proveedor no puede quedar negativa: al contado no cambia; a crédito baja el total de la compra.
  v_despues := public.deuda_proveedor(v_compra.proveedor_id) - v_compra.total + coalesce(v_auto.monto, 0);
  if v_despues < 0 then
    raise exception 'ERP_COMPRA_CON_PAGOS';
  end if;

  -- Sin escribir nada hasta confirmar que todas las líneas tienen stock.
  for v_linea in select ci.producto_id, ci.cantidad from public.compra_items ci where ci.compra_id = p_compra_id loop
    if coalesce((select cantidad from public.stock
                 where producto_id = v_linea.producto_id and ubicacion_id = v_compra.ubicacion_id), 0) < v_linea.cantidad then
      raise exception 'ERP_STOCK_INSUFICIENTE';
    end if;
  end loop;

  for v_linea in select ci.producto_id, ci.cantidad, ci.costo_unitario from public.compra_items ci
                 where ci.compra_id = p_compra_id order by ci.producto_id loop
    select * into v_stock from public.stock
    where producto_id = v_linea.producto_id and ubicacion_id = v_compra.ubicacion_id;
    insert into public.movimientos_inventario (
      negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
    ) values (
      v_compra.negocio_id, v_compra.ubicacion_id, v_linea.producto_id, 'anulacion_compra', -v_linea.cantidad,
      v_linea.costo_unitario, 'compra', p_compra_id, (select auth.uid()), v_motivo
    );
    -- El trigger del kardex no recalcula el promedio con cantidad negativa: se corrige con ajuste_costo.
    if v_stock.costo_promedio is not null and v_stock.cantidad - v_linea.cantidad > 0 then
      v_nuevo := round((v_stock.cantidad * v_stock.costo_promedio - v_linea.cantidad * v_linea.costo_unitario)
                       / (v_stock.cantidad - v_linea.cantidad), 4);
      if v_nuevo >= 0 and v_nuevo <> v_stock.costo_promedio then
        insert into public.movimientos_inventario (
          negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
        ) values (
          v_compra.negocio_id, v_compra.ubicacion_id, v_linea.producto_id, 'ajuste_costo', 0, v_nuevo, 'compra',
          p_compra_id, (select auth.uid()), v_motivo
        );
      end if;
    end if;
  end loop;

  insert into public.compra_anulaciones (compra_id, negocio_id, operacion_id, motivo, usuario_id)
  values (p_compra_id, v_compra.negocio_id, p_operacion_id, v_motivo, (select auth.uid()));
  if v_auto.id is not null then
    insert into public.proveedor_pagos (id, negocio_id, proveedor_id, compra_id, monto, medio, usuario_id, anula_id, motivo)
    values (gen_random_uuid(), v_compra.negocio_id, v_compra.proveedor_id, p_compra_id, -v_auto.monto, v_auto.medio,
            (select auth.uid()), v_auto.id, v_motivo);
  end if;
  return jsonb_build_object('id', p_compra_id, 'estado', 'anulada');
end;
$$;

-- 8. lotes_por_vencer (20261102130000) sin los lotes ni las entradas `compra` de compras anuladas: el lote anulado desaparece
-- y los lotes anteriores conservan su saldo (la entrada anulada ya no cuenta como "más nueva").
create or replace function public.lotes_por_vencer(p_negocio_id uuid, p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
begin
  if not (public.tiene_permiso(p_negocio_id, 'ajustar_inventario') or public.tiene_permiso(p_negocio_id, 'ver_reportes')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_dias is null or p_dias < 0 or p_dias > 3650 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'lote_id', t.id, 'codigo', t.codigo, 'vence', t.vence, 'dias_restantes', t.vence - v_hoy,
      'cantidad', t.cantidad, 'saldo', t.saldo,
      'producto_id', t.producto_id, 'producto_codigo', p.codigo, 'producto_nombre', p.nombre, 'unidad', p.unidad,
      'ubicacion_id', t.ubicacion_id, 'ubicacion_nombre', u.nombre
    ) order by t.vence, t.created_at, t.id)
    from (
      select l.*,
        greatest(0, least(l.cantidad,
          coalesce((select sum(s.cantidad) from public.stock s
                    where s.negocio_id = l.negocio_id and s.producto_id = l.producto_id), 0)
          - coalesce((select sum(m.cantidad) from public.movimientos_inventario m
                      where m.negocio_id = l.negocio_id and m.producto_id = l.producto_id
                        and m.tipo in ('inicial', 'compra', 'entrada') and m.cantidad > 0
                        and not (m.tipo = 'compra'
                                 and exists (select 1 from public.compra_anulaciones a where a.compra_id = m.ref_id))
                        and m.id <> l.movimiento_id and (m.created_at, m.id) > (lm.created_at, lm.id)), 0))) as saldo
      from public.lotes l
      join public.movimientos_inventario lm on lm.id = l.movimiento_id
      where l.negocio_id = p_negocio_id
        and not exists (select 1 from public.compra_anulaciones a where lm.tipo = 'compra' and a.compra_id = lm.ref_id)
    ) t
    join public.productos p on p.id = t.producto_id
    join public.ubicaciones u on u.id = t.ubicacion_id
    where t.saldo > 0 and t.vence <= v_hoy + p_dias
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.ultimo_pago_proveedor(uuid) from public, anon, authenticated;
revoke all on function public.anular_pago_proveedor(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.anular_compra(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.lotes_por_vencer(uuid, integer) from public, anon, authenticated;
grant execute on function public.ultimo_pago_proveedor(uuid) to authenticated;
grant execute on function public.anular_pago_proveedor(uuid, uuid, text) to authenticated;
grant execute on function public.anular_compra(uuid, uuid, text) to authenticated;
grant execute on function public.lotes_por_vencer(uuid, integer) to authenticated;
