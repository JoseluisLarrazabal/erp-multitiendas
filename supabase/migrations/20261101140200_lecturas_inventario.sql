-- Lecturas de inventario que cruzan costos o reconcilian. Los costos solo salen por aquí, con ver_costos.

create function public.costos_stock(p_negocio_id uuid)
returns table (producto_id uuid, ubicacion_id uuid, costo_promedio numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_costos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select s.producto_id, s.ubicacion_id, s.costo_promedio
    from public.stock s
    where s.negocio_id = p_negocio_id;
end;
$$;

-- Más reciente primero. Paginación por (created_at, id): p_desde_id es el id del último movimiento de la página
-- anterior. costo_unitario es null sin ver_costos. Producto inexistente y de otro negocio dan el mismo error.
create function public.kardex_producto(
  p_producto_id uuid, p_ubicacion_id uuid default null, p_limite integer default 100, p_desde_id uuid default null
)
returns table (
  id uuid, ubicacion_id uuid, tipo text, cantidad numeric, costo_unitario numeric, ref_tipo text, ref_id uuid,
  usuario_id uuid, usuario_nombre text, motivo text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_ver_costos boolean;
  v_desde_fecha timestamptz;
begin
  select p.negocio_id into v_negocio_id from public.productos p where p.id = p_producto_id;
  if v_negocio_id is null or v_negocio_id not in (select public.mis_negocios()) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if p_desde_id is not null then
    select m.created_at into v_desde_fecha from public.movimientos_inventario m
    where m.id = p_desde_id and m.producto_id = p_producto_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  v_ver_costos := public.tiene_permiso(v_negocio_id, 'ver_costos');

  return query
    select m.id, m.ubicacion_id, m.tipo, m.cantidad, case when v_ver_costos then m.costo_unitario end,
      m.ref_tipo, m.ref_id, m.usuario_id, pf.nombre, m.motivo, m.created_at
    from public.movimientos_inventario m
    left join public.perfiles pf on pf.id = m.usuario_id
    where m.producto_id = p_producto_id
      and (p_ubicacion_id is null or m.ubicacion_id = p_ubicacion_id)
      and (p_desde_id is null or (m.created_at, m.id) < (v_desde_fecha, p_desde_id))
    order by m.created_at desc, m.id desc
    limit p_limite;
end;
$$;

-- Diferencias entre la caché y la suma del kardex, en ambos sentidos (RF-INV-08).
create function public.stock_inconsistente(p_negocio_id uuid)
returns table (producto_id uuid, ubicacion_id uuid, cantidad_stock numeric, cantidad_kardex numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select coalesce(s.producto_id, k.producto_id), coalesce(s.ubicacion_id, k.ubicacion_id),
      coalesce(s.cantidad, 0), coalesce(k.cantidad, 0)
    from (select st.producto_id, st.ubicacion_id, st.cantidad from public.stock st where st.negocio_id = p_negocio_id) s
    full join (
      select m.producto_id, m.ubicacion_id, sum(m.cantidad) as cantidad
      from public.movimientos_inventario m
      where m.negocio_id = p_negocio_id
      group by m.producto_id, m.ubicacion_id
    ) k on k.producto_id = s.producto_id and k.ubicacion_id = s.ubicacion_id
    where coalesce(s.cantidad, 0) <> coalesce(k.cantidad, 0);
end;
$$;

-- Suma de ubicaciones contra stock_minimo. Producto sin filas de stock cuenta 0; stock_minimo null no avisa.
-- Cualquier miembro del negocio (ya lee stock).
create function public.productos_stock_bajo(p_negocio_id uuid)
returns table (producto_id uuid, codigo text, nombre text, stock_minimo numeric, cantidad numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_negocio_id not in (select public.mis_negocios()) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query
    select p.id, p.codigo, p.nombre, p.stock_minimo, coalesce(sum(s.cantidad), 0)
    from public.productos p
    left join public.stock s on s.producto_id = p.id
    where p.negocio_id = p_negocio_id and p.activo and p.tipo <> 'servicio' and p.stock_minimo is not null
    group by p.id
    having coalesce(sum(s.cantidad), 0) < p.stock_minimo
    order by p.nombre;
end;
$$;

revoke all on function public.costos_stock(uuid) from public, anon, authenticated;
revoke all on function public.kardex_producto(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.stock_inconsistente(uuid) from public, anon, authenticated;
revoke all on function public.productos_stock_bajo(uuid) from public, anon, authenticated;

grant execute on function public.costos_stock(uuid) to authenticated;
grant execute on function public.kardex_producto(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.stock_inconsistente(uuid) to authenticated;
grant execute on function public.productos_stock_bajo(uuid) to authenticated;
