-- Insumos de lavandería (fase 7, Entrega B, PR 2; RF-INS-01, RF-INS-02). Permiso `ajustar_inventario`.
-- Errores: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_OPERACION_REPETIDA.
-- Stock bajo (RF-INS-01): productos.stock_minimo, productos_stock_bajo e inventario_lista ya incluyen insumos
-- (excluyen solo servicios), así que no hay nada que agregar.
-- Consumo: es un tipo de ajustar_inventario ('consumo', cantidad negativa, costo foto, idempotente). Solo vale para un
-- insumo activo; el chequeo va después de reclamar_operacion para que repetir una operación ya confirmada devuelva
-- el movimiento original aunque el insumo se haya desactivado después. Stock negativo permitido (RN-04).
-- revertir_consumo: contra-movimiento 'consumo' positivo con el mismo costo del original (ref_tipo
-- 'consumo_revertido', ref_id = movimiento original). El gasto del reporte lo netea solo.
-- reporte_insumos: gasto = suma de -cantidad * costo_unitario de los movimientos 'consumo' (con las reversiones).
-- Un consumo sin costo no suma al gasto y se cuenta en sin_costo. Por día solo hay consumos y gasto (insumos de
-- unidades distintas no se suman); por insumo, además, la cantidad con su unidad. Gasto redondeado a 2 decimales.

-- Misma firma que la de 20261102120000_frial.sql; agrega el tipo 'consumo'.
create or replace function public.ajustar_inventario(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid,
  p_tipo text, p_cantidad numeric, p_motivo text, p_serie_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos;
  v_costo numeric;
  v_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null
     or p_tipo is null or p_tipo not in ('ajuste', 'danado', 'cambio_garantia', 'devolucion_proveedor', 'merma', 'consumo')
     or p_motivo is null or btrim(p_motivo) = ''
     or p_cantidad is null or p_cantidad = 0 or (p_tipo <> 'ajuste' and p_cantidad > 0) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- La merma es del frial.
  if p_tipo = 'merma' and (select tipo from public.negocios where id = p_negocio_id) is distinct from 'frial' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_producto := public.validar_inventario(p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad);
  -- Las series se exigen en la salida de un producto con serie y no valen en ningún otro caso.
  if (p_serie_ids is not null) <> (v_producto.controla_serie and p_cantidad < 0) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(p_operacion_id, p_negocio_id, md5(jsonb_build_array(
       'ajuste', p_negocio_id, p_producto_id, p_ubicacion_id, p_tipo, p_cantidad, p_motivo, to_jsonb(p_serie_ids))::text)) then
    return (select id from public.movimientos_inventario where ref_id = p_operacion_id);
  end if;

  -- Solo un insumo activo se consume.
  if p_tipo = 'consumo' and (v_producto.tipo <> 'insumo' or not v_producto.activo) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if p_cantidad < 0 then
    if p_tipo = 'consumo' then
      perform public.bloquear_stock(p_negocio_id, p_ubicacion_id, array[p_producto_id]);
    end if;
    select costo_promedio into v_costo from public.stock
    where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id;
  end if;

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_ubicacion_id, p_producto_id, p_tipo, p_cantidad, v_costo, 'operacion',
    p_operacion_id, (select auth.uid()), btrim(p_motivo)
  )
  returning id into v_id;

  if p_serie_ids is not null then
    perform public.bloquear_series(p_negocio_id, p_producto_id, p_ubicacion_id, p_serie_ids, -p_cantidad);
    update public.series set estado = 'baja' where id = any (p_serie_ids);
  end if;
  return v_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.ajustar_inventario(uuid, uuid, uuid, uuid, text, numeric, text, uuid[]) from public, anon, authenticated;
grant execute on function public.ajustar_inventario(uuid, uuid, uuid, uuid, text, numeric, text, uuid[]) to authenticated;

-- Revierte un consumo (el kardex es append-only). El negocio sale del movimiento. Un consumo se revierte una sola vez.
create function public.revertir_consumo(p_operacion_id uuid, p_movimiento_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mov public.movimientos_inventario;
  v_id uuid;
begin
  select * into v_mov from public.movimientos_inventario where id = p_movimiento_id;
  if not found or not public.tiene_permiso(v_mov.negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or p_motivo is null or btrim(p_motivo) = ''
     or v_mov.tipo <> 'consumo' or v_mov.cantidad >= 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if not public.reclamar_operacion(p_operacion_id, v_mov.negocio_id, md5(jsonb_build_array(
       'revertir_consumo', p_movimiento_id, p_motivo)::text)) then
    return (select id from public.movimientos_inventario where ref_id = p_movimiento_id and tipo = 'consumo');
  end if;
  if exists (select 1 from public.movimientos_inventario where ref_id = p_movimiento_id and tipo = 'consumo') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  perform public.bloquear_stock(v_mov.negocio_id, v_mov.ubicacion_id, array[v_mov.producto_id]);
  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    v_mov.negocio_id, v_mov.ubicacion_id, v_mov.producto_id, 'consumo', -v_mov.cantidad, v_mov.costo_unitario,
    'consumo_revertido', p_movimiento_id, (select auth.uid()), btrim(p_motivo)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Fecha de un consumo = created_at en La Paz. Exige ver_reportes y ver_costos: el gasto es costo.
create function public.reporte_insumos(p_negocio_id uuid, p_desde date, p_hasta date, p_agrupar text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ini timestamptz;
  v_fin timestamptz;
  v_filas jsonb;
  v_tot jsonb;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') or not public.tiene_permiso(p_negocio_id, 'ver_costos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 365
     or p_agrupar is null or p_agrupar not in ('dia', 'insumo') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_ini := p_desde::timestamp at time zone 'America/La_Paz';
  v_fin := (p_hasta + 1)::timestamp at time zone 'America/La_Paz';

  with base as (
    select m.created_at as ts, m.producto_id, -m.cantidad as cant, m.costo_unitario as cu,
           p.codigo, p.nombre as producto, p.unidad
    from public.movimientos_inventario m
    join public.productos p on p.id = m.producto_id
    where m.negocio_id = p_negocio_id and m.tipo = 'consumo' and m.created_at >= v_ini and m.created_at < v_fin
  ),
  k as (
    select x.clave, x.etiqueta, b.*
    from base b
    cross join lateral (values
      ('dia', (b.ts at time zone 'America/La_Paz')::date::text, (b.ts at time zone 'America/La_Paz')::date::text),
      ('insumo', b.producto_id::text, b.codigo || ' ' || b.producto)
    ) x (modo, clave, etiqueta)
    where x.modo = p_agrupar
  ),
  g as (
    select clave, etiqueta, max(unidad) as unidad, count(*) as consumos, sum(cant) as cantidad,
           round(coalesce(sum(cant * cu) filter (where cu is not null), 0), 2) as gasto,
           count(*) filter (where cu is null) as sin_costo
    from k
    group by clave, etiqueta
  ),
  t as (
    select count(*) as consumos,
           round(coalesce(sum(cant * cu) filter (where cu is not null), 0), 2) as gasto,
           count(*) filter (where cu is null) as sin_costo
    from base
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'clave', g.clave, 'etiqueta', g.etiqueta, 'consumos', g.consumos, 'gasto', g.gasto,
        'sin_costo', g.sin_costo) || case when p_agrupar = 'insumo'
          then jsonb_build_object('cantidad', g.cantidad, 'unidad', g.unidad) else '{}'::jsonb end
      order by case when p_agrupar = 'dia' then g.clave end, g.gasto desc, g.etiqueta), '[]'::jsonb) from g),
    (select jsonb_build_object('consumos', t.consumos, 'gasto', t.gasto, 'sin_costo', t.sin_costo) from t)
  into v_filas, v_tot;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;

revoke all on function public.revertir_consumo(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reporte_insumos(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.revertir_consumo(uuid, uuid, text) to authenticated;
grant execute on function public.reporte_insumos(uuid, date, date, text) to authenticated;
