-- kardex_producto desde su definición de 20261108140000, con `referencia`: texto legible del documento de origen (M-13).
-- Solo las ventas tienen número; el resto se describe por tipo y fecha. Sin el proveedor de la compra (lo ve quien no
-- tiene gestionar_compras). Se conservan todas las columnas anteriores: la web vieja sigue leyendo igual.
drop function public.kardex_producto(uuid, uuid, integer, uuid);
create function public.kardex_producto(
  p_producto_id uuid, p_ubicacion_id uuid default null, p_limite integer default 100, p_desde_id uuid default null
)
returns table (
  id uuid, ubicacion_id uuid, tipo text, cantidad numeric, costo_unitario numeric, ref_tipo text, ref_id uuid,
  usuario_id uuid, usuario_nombre text, motivo text, created_at timestamptz, revertido boolean, referencia text
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
  if not (public.tiene_permiso(v_negocio_id, 'ajustar_inventario') or public.tiene_permiso(v_negocio_id, 'ver_reportes')) then
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
      m.ref_tipo, m.ref_id, m.usuario_id, pf.nombre, m.motivo, m.created_at,
      (m.tipo = 'consumo' and m.cantidad < 0 and exists (
        select 1 from public.movimientos_inventario r where r.ref_id = m.id and r.ref_tipo = 'consumo_revertido')) as revertido,
      case m.ref_tipo
        when 'venta' then case when m.tipo = 'anulacion_venta' then 'Anulación de la venta ' else 'Venta ' end
          || (select v.numero from public.ventas v where v.id = m.ref_id)
        when 'devolucion' then 'Devolución de la venta '
          || (select v.numero from public.devoluciones d join public.ventas v on v.id = d.venta_id where d.id = m.ref_id)
        when 'compra' then case when m.tipo = 'anulacion_compra' then 'Anulación de la compra del ' else 'Compra del ' end
          || (select to_char(c.created_at at time zone 'America/La_Paz', 'DD/MM/YYYY') from public.compras c where c.id = m.ref_id)
        when 'conteo' then 'Conteo del '
          || (select to_char(c.fecha at time zone 'America/La_Paz', 'DD/MM/YYYY') from public.conteos c where c.id = m.ref_id)
        when 'reserva' then 'Reserva' || coalesce((
          select ' · venta ' || v.numero from public.reservas r join public.ventas v on v.id = r.venta_id where r.id = m.ref_id), '')
        when 'costos' then 'Ajuste de costos'
        when 'consumo_revertido' then 'Reversión de consumo'
      end as referencia
    from public.movimientos_inventario m
    left join public.perfiles pf on pf.id = m.usuario_id
    where m.producto_id = p_producto_id
      and (p_ubicacion_id is null or m.ubicacion_id = p_ubicacion_id)
      and (p_desde_id is null or (m.created_at, m.id) < (v_desde_fecha, p_desde_id))
    order by m.created_at desc, m.id desc
    limit p_limite;
end;
$$;
revoke all on function public.kardex_producto(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.kardex_producto(uuid, uuid, integer, uuid) to authenticated;
