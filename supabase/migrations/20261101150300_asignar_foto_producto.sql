-- Asigna (o limpia, con null) la foto de un producto sin tocar ningún otro campo: guardar_producto exige todos y
-- reenviarlos pisaría una edición concurrente. Producto inexistente y de otro negocio dan el mismo error.

create function public.asignar_foto_producto(p_producto_id uuid, p_foto_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio uuid;
  v_foto text := nullif(p_foto_path, '');
begin
  select negocio_id into v_negocio from public.productos where id = p_producto_id;
  if v_negocio is null or not public.tiene_permiso(v_negocio, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  -- Misma regla que guardar_producto: <negocio_id>/<uuid>.(jpg|png|webp), sin subcarpetas ni '..'.
  if v_foto is not null
     and v_foto !~ ('^' || v_negocio::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  update public.productos set foto_path = v_foto where id = p_producto_id;
end;
$$;

revoke all on function public.asignar_foto_producto(uuid, text) from public, anon, authenticated;
grant execute on function public.asignar_foto_producto(uuid, text) to authenticated;
