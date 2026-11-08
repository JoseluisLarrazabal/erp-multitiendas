-- Insumos de lavandería (fase 7, Entrega B, PR 2; RF-INS-01, RF-INS-02). Permiso `ajustar_inventario` en el consumo.
-- Errores: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_OPERACION_REPETIDA, ERP_LOTE_GRANDE.
-- Stock bajo (RF-INS-01): productos.stock_minimo, productos_stock_bajo e inventario_lista ya incluyen insumos
-- (excluyen solo servicios), así que no hay nada que agregar.
-- Consumo: movimiento 'consumo' (cantidad negativa) con el costo promedio vigente como foto, igual que las salidas de
-- ajustar_inventario. El stock negativo se permite (RN-04). Idempotente por reclamar_operacion.
-- reporte_insumos: gasto = suma de -cantidad * costo_unitario de los movimientos 'consumo'. Un consumo sin costo
-- (insumo que nunca tuvo costo) no suma al gasto y se cuenta en sin_costo, como lineas_sin_costo de reporte_ventas.
-- Los otros consumos (ref_tipo distinto) no existen hoy; el reporte cuenta todo movimiento 'consumo' del negocio.

create function public.registrar_consumo(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid, p_cantidad numeric, p_motivo text
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
  if p_operacion_id is null or p_cantidad is null or p_cantidad <= 0
     or p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_producto := public.validar_inventario(p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad);
  if v_producto.tipo <> 'insumo' or not v_producto.activo then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(p_operacion_id, p_negocio_id, md5(jsonb_build_array(
       'consumo', p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad, p_motivo)::text)) then
    return (select id from public.movimientos_inventario where ref_id = p_operacion_id);
  end if;

  perform public.bloquear_stock(p_negocio_id, p_ubicacion_id, array[p_producto_id]);
  select costo_promedio into v_costo from public.stock
  where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id;

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_ubicacion_id, p_producto_id, 'consumo', -p_cantidad, v_costo, 'consumo',
    p_operacion_id, (select auth.uid()), btrim(p_motivo)
  )
  returning id into v_id;
  return v_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
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
  v_n integer;
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
           p.codigo, p.nombre as producto
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
    select clave, etiqueta, count(*) as consumos, sum(cant) as cantidad,
           coalesce(sum(cant * cu) filter (where cu is not null), 0) as gasto,
           count(*) filter (where cu is null) as sin_costo
    from k
    group by clave, etiqueta
  ),
  t as (
    select count(*) as consumos, coalesce(sum(cant), 0) as cantidad,
           coalesce(sum(cant * cu) filter (where cu is not null), 0) as gasto,
           count(*) filter (where cu is null) as sin_costo
    from base
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'clave', g.clave, 'etiqueta', g.etiqueta, 'consumos', g.consumos, 'cantidad', g.cantidad,
        'gasto', g.gasto, 'sin_costo', g.sin_costo)
      order by case when p_agrupar = 'dia' then g.clave end, g.gasto desc, g.etiqueta), '[]'::jsonb) from g),
    (select count(*) from g),
    (select jsonb_build_object('consumos', t.consumos, 'cantidad', t.cantidad, 'gasto', t.gasto,
        'sin_costo', t.sin_costo) from t)
  into v_filas, v_n, v_tot;
  if v_n > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;

revoke all on function public.registrar_consumo(uuid, uuid, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.reporte_insumos(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.registrar_consumo(uuid, uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.reporte_insumos(uuid, date, date, text) to authenticated;

-- inventario_lista expone `tipo` (columna nueva al final: create or replace) para que el selector de producto del
-- consumo busque solo insumos.
create or replace view public.inventario_lista
with (security_invoker = true)
as
select
  p.id, p.negocio_id, p.codigo, p.codigo_barras, p.nombre, p.marca, p.unidad, p.controla_serie, p.activo,
  p.stock_minimo,
  coalesce(s.total, 0) as stock_total,
  (p.activo and p.stock_minimo is not null and coalesce(s.total, 0) < p.stock_minimo) as stock_bajo,
  coalesce(s.negativo, false) as stock_negativo,
  p.tipo
from public.productos p
left join lateral (
  select sum(st.cantidad) as total, bool_or(st.cantidad < 0) as negativo
  from public.stock st where st.producto_id = p.id
) s on true
where p.tipo <> 'servicio';
