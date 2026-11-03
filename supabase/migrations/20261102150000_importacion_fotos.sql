-- Fotos de la importación (scripts/importacion/). asignar_foto_producto exige tiene_permiso(), que necesita auth.uid():
-- service_role no lo tiene. Esta RPC hace lo mismo para la carga inicial, solo service_role y solo si el producto
-- aún no tiene foto (reimportar no pisa una foto que el panel ya cambió). El archivo lo sube el script a Storage.
-- p_items: [{producto_id, foto_path}], máximo 500. La ruta debe ser <negocio>/<producto>.(jpg|png|webp).
-- Devuelve {asignadas, ya_existian}. Todo o nada.
create function public.asignar_fotos_importacion(p_negocio_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_producto uuid;
  v_ruta text;
  v_actual text;
  v_asignadas integer := 0;
  v_existian integer := 0;
begin
  if p_negocio_id is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item -> 'foto_path') is distinct from 'string' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto := (v_item ->> 'producto_id')::uuid;
    v_ruta := v_item ->> 'foto_path';
    -- La ruta es exactamente <negocio>/<producto>.<ext>: el archivo del producto A no se asigna al B.
    if v_ruta !~ ('^' || p_negocio_id::text || '/' || v_producto::text || '\.(jpg|png|webp)$') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    select foto_path into v_actual from public.productos
      where id = v_producto and negocio_id = p_negocio_id for update;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_actual is not null then
      v_existian := v_existian + 1;
      continue;
    end if;
    update public.productos set foto_path = v_ruta where id = v_producto;
    v_asignadas := v_asignadas + 1;
  end loop;
  return jsonb_build_object('asignadas', v_asignadas, 'ya_existian', v_existian);
exception
  when invalid_text_representation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.asignar_fotos_importacion(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.asignar_fotos_importacion(uuid, jsonb) to service_role;
