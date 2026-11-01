-- costos_stock ahora recibe los productos a leer: sin filtro devolvía una fila por producto y ubicación del negocio y
-- el tope de filas de PostgREST (max_rows = 1000) la truncaba en silencio. Los costos solo salen por aquí, con ver_costos.

drop function public.costos_stock(uuid);

create function public.costos_stock(p_negocio_id uuid, p_producto_ids uuid[])
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
    where s.negocio_id = p_negocio_id and s.producto_id = any (p_producto_ids);
end;
$$;

revoke all on function public.costos_stock(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.costos_stock(uuid, uuid[]) to authenticated;
