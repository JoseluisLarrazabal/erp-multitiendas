-- Arrastres del PR 2: reporte_stock no cuenta anulacion_compra como salida; pagar_proveedor solo acepta en compra_id una compra a crédito no anulada.
-- Copias íntegras de sus últimas definiciones (reportes.sql, compras.sql); solo cambian los filtros indicados. Mismos grants.

create or replace function public.reporte_stock(p_negocio_id uuid, p_dias_sin_movimiento integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_costos boolean;
  v_filas jsonb;
  v_tot jsonb;
  v_n integer;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_dias_sin_movimiento is null or p_dias_sin_movimiento not between 1 and 3650 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_costos := public.tiene_permiso(p_negocio_id, 'ver_costos');

  with f as (
    select p.codigo, p.nombre, c.nombre as categoria, p.marca, p.unidad, p.stock_minimo,
           coalesce(s.cantidad, 0) as stock, s.valor, coalesce(s.sin_costo, false) as sin_costo, us.ultima_salida
    from public.productos p
    left join public.categorias c on c.id = p.categoria_id
    left join lateral (
      select sum(st.cantidad) as cantidad, sum(greatest(st.cantidad, 0) * coalesce(st.costo_promedio, 0)) as valor,
             bool_or(st.cantidad > 0 and st.costo_promedio is null) as sin_costo
      from public.stock st where st.producto_id = p.id
    ) s on true
    left join lateral (
      select m.created_at as ultima_salida
      from public.movimientos_inventario m
      where m.producto_id = p.id and m.cantidad < 0 and m.tipo not in ('traslado_salida', 'anulacion_compra')
      order by m.created_at desc limit 1
    ) us on true
    where p.negocio_id = p_negocio_id and p.activo and p.tipo <> 'servicio'
  ),
  r as (
    select f.*, f.stock_minimo is not null and f.stock < f.stock_minimo as stock_bajo,
           f.stock > 0 and (f.ultima_salida is null or f.ultima_salida < now() - make_interval(days => p_dias_sin_movimiento))
             as sin_movimiento
    from f
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'codigo', r.codigo, 'nombre', r.nombre, 'categoria', r.categoria, 'marca', r.marca, 'unidad', r.unidad,
        'stock', r.stock, 'stock_minimo', r.stock_minimo, 'stock_bajo', r.stock_bajo,
        'ultima_salida', r.ultima_salida, 'sin_movimiento', r.sin_movimiento,
        'valor', case when v_costos then coalesce(r.valor, 0) end) order by r.nombre, r.codigo), '[]'::jsonb) from r),
    (select count(*) from r),
    (select jsonb_build_object('productos', count(*), 'stock_bajo', count(*) filter (where r.stock_bajo),
        'sin_movimiento', count(*) filter (where r.sin_movimiento),
        'valor', case when v_costos then coalesce(sum(r.valor), 0) end,
        'productos_sin_costo', case when v_costos then count(*) filter (where r.sin_costo) end) from r)
  into v_filas, v_n, v_tot;
  if v_n > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;

create or replace function public.pagar_proveedor(p_pago jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_id uuid;
  v_proveedor_id uuid;
  v_compra_id uuid;
  v_monto numeric;
  v_medio text;
  v_deuda numeric;
begin
  perform public.payload_claves(p_pago, array['id', 'negocio_id', 'proveedor_id', 'compra_id', 'monto', 'medio']);
  v_negocio_id := public.payload_uuid(p_pago, 'negocio_id', false);
  if not public.tiene_permiso(v_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  v_id := public.payload_uuid(p_pago, 'id', false);
  v_proveedor_id := public.payload_uuid(p_pago, 'proveedor_id', false);
  v_compra_id := public.payload_uuid(p_pago, 'compra_id', true);
  v_monto := public.payload_numero(p_pago, 'monto', 2);
  v_medio := public.payload_texto(p_pago, 'medio', 20);
  if v_monto <= 0 or v_medio not in ('efectivo', 'qr', 'transferencia') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(v_id, v_negocio_id, md5(p_pago::text)) then
    return v_id;
  end if;

  perform 1 from public.proveedores where id = v_proveedor_id and negocio_id = v_negocio_id for update;
  if not found
     or (v_compra_id is not null
         and not exists (select 1 from public.compras
                         where id = v_compra_id and negocio_id = v_negocio_id and proveedor_id = v_proveedor_id
                           and condicion = 'credito'
                           and not exists (select 1 from public.compra_anulaciones a where a.compra_id = v_compra_id))) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_deuda := public.deuda_proveedor(v_proveedor_id);
  if v_monto > v_deuda then
    raise exception 'ERP_PAGO_EXCEDE_DEUDA';
  end if;

  insert into public.proveedor_pagos (id, negocio_id, proveedor_id, compra_id, monto, medio, usuario_id)
  values (v_id, v_negocio_id, v_proveedor_id, v_compra_id, v_monto, v_medio, (select auth.uid()));
  return v_id;
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;
