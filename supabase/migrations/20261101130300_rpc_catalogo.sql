-- RPC de catálogo. Errores con código estable que la app traduce: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS,
-- ERP_CATEGORIA_DUPLICADA, ERP_CODIGO_DUPLICADO, ERP_CODIGO_BARRAS_DUPLICADO, ERP_LOTE_GRANDE, ERP_MONEDA_MIXTA.
-- No existe RPC de borrado: un producto se desactiva.

create function public.guardar_categoria(p_negocio_id uuid, p_id uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if v_id is null then
    insert into public.categorias (negocio_id, nombre) values (p_negocio_id, btrim(p_nombre))
    returning id into v_id;
  else
    update public.categorias set nombre = btrim(p_nombre) where id = v_id and negocio_id = p_negocio_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'ERP_CATEGORIA_DUPLICADA';
end;
$$;

-- Crea (sin `id`) o edita (con `id`). Al editar, cada campo ausente vuelve a su valor por defecto (el formulario
-- manda todos), salvo foto_path, que se conserva si la clave no viene. `activo` y precios no van aquí.
create function public.guardar_producto(p_negocio_id uuid, p_datos jsonb)
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

-- Producto inexistente y producto de otro negocio dan el mismo error: no se revela cuál existe.
create function public.desactivar_producto(p_producto_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
begin
  select negocio_id into v_negocio_id from public.productos where id = p_producto_id;
  if v_negocio_id is null or not public.tiene_permiso(v_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_activo is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  update public.productos set activo = p_activo where id = p_producto_id;
end;
$$;

-- Lote: [{producto_id, moneda, precios: {lista: monto | null}}]. null borra esa lista. Todo o nada.
-- Devuelve cuántos productos procesó.
create function public.guardar_precios(p_negocio_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_negocio text;
  v_listas text[];
  v_item jsonb;
  v_producto_id uuid;
  v_moneda text;
  v_monto numeric;
  v_precio record;
begin
  if not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;

  select tipo into v_tipo_negocio from public.negocios where id = p_negocio_id;
  v_listas := case v_tipo_negocio
    when 'lavanderia' then array['normal', 'express']
    else array['contado', 'credito', 'mayorista', 'minimo']
  end;

  -- Orden fijo por producto: dos lotes concurrentes no se bloquean en cruz.
  for v_item in select e from jsonb_array_elements(p_items) e order by e ->> 'producto_id' loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'precios') is distinct from 'object' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_moneda := v_item ->> 'moneda';
    if v_moneda is null or v_moneda not in ('BOB', 'USD')
       or v_producto_id is null then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    -- Bloquea el producto: no se desactiva ni cambia de moneda a medio lote.
    perform 1 from public.productos where id = v_producto_id and negocio_id = p_negocio_id for update;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    for v_precio in select key as lista, value from jsonb_each(v_item -> 'precios') loop
      if not (v_precio.lista = any (v_listas)) then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
      if jsonb_typeof(v_precio.value) = 'null' then
        delete from public.producto_precios where producto_id = v_producto_id and lista = v_precio.lista;
      elsif jsonb_typeof(v_precio.value) = 'number' and (v_precio.value #>> '{}')::numeric > 0 then
        insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda)
        values (p_negocio_id, v_producto_id, v_precio.lista, (v_precio.value #>> '{}')::numeric, v_moneda)
        on conflict (producto_id, lista) do update
          set monto = excluded.monto, moneda = excluded.moneda, updated_at = now()
          -- Guardar lo mismo no toca la fila: no deja ruido en la auditoría.
          where (producto_precios.monto, producto_precios.moneda) is distinct from (excluded.monto, excluded.moneda);
      else
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
    end loop;

    -- Una lista que el item no tocó puede conservar otra moneda: el producto queda con una sola.
    if exists (select 1 from public.producto_precios where producto_id = v_producto_id and moneda <> v_moneda) then
      raise exception 'ERP_MONEDA_MIXTA';
    end if;
  end loop;

  return jsonb_array_length(p_items);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Rige el más reciente. El valor es Bs por 1 USD.
create function public.registrar_tipo_cambio(p_negocio_id uuid, p_valor numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor = 'NaN' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.tipos_cambio (negocio_id, valor, usuario_id)
  values (p_negocio_id, p_valor, (select auth.uid()))
  returning id into v_id;
  return v_id;
exception
  when numeric_value_out_of_range or check_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.guardar_categoria(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.guardar_producto(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.desactivar_producto(uuid, boolean) from public, anon, authenticated;
revoke all on function public.guardar_precios(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.registrar_tipo_cambio(uuid, numeric) from public, anon, authenticated;

grant execute on function public.guardar_categoria(uuid, uuid, text) to authenticated;
grant execute on function public.guardar_producto(uuid, jsonb) to authenticated;
grant execute on function public.desactivar_producto(uuid, boolean) to authenticated;
grant execute on function public.guardar_precios(uuid, jsonb) to authenticated;
grant execute on function public.registrar_tipo_cambio(uuid, numeric) to authenticated;
