-- guardar_producto: un producto con movimientos no cambia unidad ni tipo, ni deja de controlar series (rompería el kardex y las series). Nuevo error: ERP_PRODUCTO_CON_MOVIMIENTOS.

-- Crea (sin `id`) o edita (con `id`). Al editar, cada campo ausente vuelve a su valor por defecto (el formulario
-- manda todos), salvo foto_path, que se conserva si la clave no viene. `activo` y precios no van aquí.
create or replace function public.guardar_producto(p_negocio_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_negocio text;
  v_id uuid;
  v_codigo text;
  v_barras text;
  v_nombre text;
  v_tipo text;
  v_foto text;
  v_constraint text;
  v_actual public.productos;
begin
  if not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  select tipo into v_tipo_negocio from public.negocios where id = p_negocio_id;
  v_id := nullif(p_datos ->> 'id', '')::uuid;
  v_codigo := btrim(p_datos ->> 'codigo');
  v_barras := nullif(btrim(p_datos ->> 'codigo_barras'), '');
  v_nombre := btrim(p_datos ->> 'nombre');
  v_tipo := p_datos ->> 'tipo';
  v_foto := nullif(p_datos ->> 'foto_path', '');

  if v_codigo is null or v_codigo = '' or v_nombre is null or v_nombre = ''
     or v_tipo is null
     or not (v_tipo = any (case v_tipo_negocio when 'lavanderia' then array['servicio', 'insumo'] else array['producto'] end))
     -- La foto es <negocio_id>/<uuid>.(jpg|png|webp): sin subcarpetas ni '..'.
     or (v_foto is not null and v_foto !~ ('^' || p_negocio_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if v_id is null then
    insert into public.productos (
      negocio_id, codigo, codigo_barras, nombre, marca, modelo, categoria_id, tipo, unidad,
      controla_serie, garantia_meses, stock_minimo, foto_path
    ) values (
      p_negocio_id, v_codigo, v_barras, v_nombre, nullif(btrim(p_datos ->> 'marca'), ''),
      nullif(btrim(p_datos ->> 'modelo'), ''), (p_datos ->> 'categoria_id')::uuid, v_tipo,
      coalesce(p_datos ->> 'unidad', 'unidad'), coalesce((p_datos ->> 'controla_serie')::boolean, false),
      (p_datos ->> 'garantia_meses')::integer, (p_datos ->> 'stock_minimo')::numeric, v_foto
    ) returning id into v_id;
  else
    select * into v_actual from public.productos where id = v_id and negocio_id = p_negocio_id for update;
    if found and exists (select 1 from public.movimientos_inventario where producto_id = v_id)
       and (v_actual.tipo is distinct from v_tipo
            or v_actual.unidad is distinct from coalesce(p_datos ->> 'unidad', 'unidad')
            or (v_actual.controla_serie and not coalesce((p_datos ->> 'controla_serie')::boolean, false))) then
      raise exception 'ERP_PRODUCTO_CON_MOVIMIENTOS';
    end if;
    update public.productos set
      codigo = v_codigo,
      codigo_barras = v_barras,
      nombre = v_nombre,
      marca = nullif(btrim(p_datos ->> 'marca'), ''),
      modelo = nullif(btrim(p_datos ->> 'modelo'), ''),
      categoria_id = (p_datos ->> 'categoria_id')::uuid,
      tipo = v_tipo,
      unidad = coalesce(p_datos ->> 'unidad', 'unidad'),
      controla_serie = coalesce((p_datos ->> 'controla_serie')::boolean, false),
      garantia_meses = (p_datos ->> 'garantia_meses')::integer,
      stock_minimo = (p_datos ->> 'stock_minimo')::numeric,
      foto_path = case when p_datos ? 'foto_path' then v_foto else foto_path end
    where id = v_id and negocio_id = p_negocio_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  return v_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    raise exception '%', case v_constraint when 'productos_codigo_uq' then 'ERP_CODIGO_DUPLICADO' else 'ERP_CODIGO_BARRAS_DUPLICADO' end;
  -- Cast de uuid, número o booleano mal formado, check de tabla, FK a una categoría de otro negocio.
  when invalid_text_representation or check_violation or foreign_key_violation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.guardar_producto(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_producto(uuid, jsonb) to authenticated;
