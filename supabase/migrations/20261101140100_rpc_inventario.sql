-- RPC de inventario. Errores con código estable que la app traduce: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS,
-- ERP_LOTE_GRANDE, ERP_SERIE_DUPLICADA, ERP_SERIES_EXCEDEN_STOCK.
-- Las operaciones reciben p_operacion_id (UUID generado al abrir el formulario) y lo guardan como ref_id del
-- movimiento: repetirla no duplica nada y devuelve el resultado original (los parámetros repetidos se ignoran).
-- Un servicio no genera movimientos. Stock insuficiente se permite (RN-04).

-- Privado (sin grant): producto y ubicación del negocio, producto que mueve stock, cantidad bien formada.
-- La cantidad es entera si el producto se mide en unidad o controla serie.
create function public.validar_inventario(p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid, p_cantidad numeric)
returns public.productos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_producto public.productos;
begin
  select * into v_producto from public.productos where id = p_producto_id and negocio_id = p_negocio_id;
  if not found
     or v_producto.tipo = 'servicio'
     or not exists (select 1 from public.ubicaciones where id = p_ubicacion_id and negocio_id = p_negocio_id)
     or p_cantidad is null or p_cantidad = 'NaN' or p_cantidad <> round(p_cantidad, 3)
     or ((v_producto.unidad = 'unidad' or v_producto.controla_serie) and p_cantidad <> trunc(p_cantidad)) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  return v_producto;
end;
$$;

-- Privado: bloquea las series y exige que sean n, sin repetir, del producto, en la ubicación y disponibles.
create function public.bloquear_series(p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid, p_ids uuid[], p_cantidad numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_ids is null or cardinality(p_ids) <> p_cantidad or array_position(p_ids, null) is not null
     or (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select count(*) into v_n from (
    select 1 from public.series
    where id = any (p_ids) and negocio_id = p_negocio_id and producto_id = p_producto_id
      and ubicacion_id = p_ubicacion_id and estado = 'disponible'
    for update
  ) s;
  if v_n <> cardinality(p_ids) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
end;
$$;

-- Entrada de mercadería. Devuelve el id del movimiento. Costo nulo: la entrada no cambia el promedio.
create function public.registrar_entrada(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid,
  p_cantidad numeric, p_costo_unitario numeric, p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or p_cantidad is null or p_cantidad <= 0
     or (p_costo_unitario is not null
         and (p_costo_unitario < 0 or p_costo_unitario = 'NaN' or p_costo_unitario <> round(p_costo_unitario, 4))) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  perform public.validar_inventario(p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad);

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_ubicacion_id, p_producto_id, 'entrada', p_cantidad, p_costo_unitario, 'operacion',
    p_operacion_id, (select auth.uid()), nullif(btrim(p_motivo), '')
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.movimientos_inventario
    where ref_id = p_operacion_id and producto_id = p_producto_id and ubicacion_id = p_ubicacion_id and tipo = 'entrada';
  end if;
  return v_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- ajuste (signo libre, distinto de 0), danado, cambio_garantia y devolucion_proveedor (siempre salida). Motivo obligatorio.
-- En salidas, costo_unitario es el promedio vigente (foto). Con controla_serie, la salida exige p_serie_ids y las pasa a baja.
create function public.ajustar_inventario(
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
     or p_tipo is null or p_tipo not in ('ajuste', 'danado', 'cambio_garantia', 'devolucion_proveedor')
     or p_motivo is null or btrim(p_motivo) = ''
     or p_cantidad is null or p_cantidad = 0 or (p_tipo <> 'ajuste' and p_cantidad > 0) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_producto := public.validar_inventario(p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad);
  -- Las series se exigen en la salida de un producto con serie y no valen en ningún otro caso.
  if (p_serie_ids is not null) <> (v_producto.controla_serie and p_cantidad < 0) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if p_cantidad < 0 then
    select costo_promedio into v_costo from public.stock
    where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id;
  end if;

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_ubicacion_id, p_producto_id, p_tipo, p_cantidad, v_costo, 'operacion',
    p_operacion_id, (select auth.uid()), btrim(p_motivo)
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.movimientos_inventario
    where ref_id = p_operacion_id and producto_id = p_producto_id and ubicacion_id = p_ubicacion_id and tipo = p_tipo;
    return v_id;
  end if;

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

-- Dos movimientos con el costo promedio del origen: el valor total no cambia. Devuelve el id de traslado_salida.
create function public.trasladar_stock(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_origen_id uuid, p_destino_id uuid,
  p_cantidad numeric, p_motivo text, p_serie_ids uuid[] default null
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
  if p_operacion_id is null or p_origen_id is null or p_destino_id is null or p_origen_id = p_destino_id
     or p_cantidad is null or p_cantidad <= 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_producto := public.validar_inventario(p_negocio_id, p_producto_id, p_origen_id, p_cantidad);
  perform public.validar_inventario(p_negocio_id, p_producto_id, p_destino_id, p_cantidad);
  if (p_serie_ids is not null) <> v_producto.controla_serie then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Bloquea el origen: el promedio que se lleva es el vigente y no cambia a medio traslado.
  select costo_promedio into v_costo from public.stock
  where producto_id = p_producto_id and ubicacion_id = p_origen_id for update;

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_origen_id, p_producto_id, 'traslado_salida', -p_cantidad, v_costo, 'traslado',
    p_operacion_id, (select auth.uid()), nullif(btrim(p_motivo), '')
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.movimientos_inventario
    where ref_id = p_operacion_id and producto_id = p_producto_id and ubicacion_id = p_origen_id and tipo = 'traslado_salida';
    return v_id;
  end if;

  insert into public.movimientos_inventario (
    negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
  ) values (
    p_negocio_id, p_destino_id, p_producto_id, 'traslado_entrada', p_cantidad, v_costo, 'traslado',
    p_operacion_id, (select auth.uid()), nullif(btrim(p_motivo), '')
  )
  on conflict do nothing;

  if p_serie_ids is not null then
    perform public.bloquear_series(p_negocio_id, p_producto_id, p_origen_id, p_serie_ids, p_cantidad);
    update public.series set ubicacion_id = p_destino_id where id = any (p_serie_ids);
  end if;
  return v_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Items: [{producto_id, cantidad_contada}], máximo 500. Guarda lo que decía el sistema (con lock) y genera un
-- ajuste solo donde hay diferencia. Idempotencia por conteos.id. Devuelve cuántos ajustes generó.
create function public.registrar_conteo(
  p_operacion_id uuid, p_negocio_id uuid, p_ubicacion_id uuid, p_items jsonb, p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conteo_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_contada numeric;
  v_sistema numeric;
  v_costo numeric;
  v_diferencia numeric;
  v_ajustes integer := 0;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  if not exists (select 1 from public.ubicaciones where id = p_ubicacion_id and negocio_id = p_negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.conteos (id, negocio_id, ubicacion_id, usuario_id, motivo)
  values (p_operacion_id, p_negocio_id, p_ubicacion_id, (select auth.uid()), nullif(btrim(p_motivo), ''))
  on conflict do nothing
  returning id into v_conteo_id;

  if v_conteo_id is null then
    -- Repetido. Un conteo de otro negocio o de otra ubicación no se revela: mismo error.
    if not exists (select 1 from public.conteos where id = p_operacion_id and negocio_id = p_negocio_id and ubicacion_id = p_ubicacion_id) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    return (select count(*)::integer from public.movimientos_inventario where ref_id = p_operacion_id and ref_tipo = 'conteo');
  end if;

  -- Orden fijo por producto: dos conteos concurrentes no se bloquean en cruz.
  for v_item in select e from jsonb_array_elements(p_items) e order by e ->> 'producto_id' loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'producto_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'cantidad_contada') is distinct from 'number' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_contada := (v_item ->> 'cantidad_contada')::numeric;
    if v_contada < 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    perform public.validar_inventario(p_negocio_id, v_producto_id, p_ubicacion_id, v_contada);

    select cantidad, costo_promedio into v_sistema, v_costo from public.stock
    where producto_id = v_producto_id and ubicacion_id = p_ubicacion_id for update;
    v_sistema := coalesce(v_sistema, 0);

    -- Un producto repetido en el lote viola la clave de conteo_items.
    insert into public.conteo_items (conteo_id, negocio_id, producto_id, cantidad_sistema, cantidad_contada)
    values (v_conteo_id, p_negocio_id, v_producto_id, v_sistema, v_contada);

    v_diferencia := v_contada - v_sistema;
    if v_diferencia <> 0 then
      insert into public.movimientos_inventario (
        negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
      ) values (
        p_negocio_id, p_ubicacion_id, v_producto_id, 'ajuste', v_diferencia,
        case when v_diferencia < 0 then v_costo end, 'conteo', v_conteo_id, (select auth.uid()),
        coalesce(nullif(btrim(p_motivo), ''), 'Conteo de inventario')
      );
      v_ajustes := v_ajustes + 1;
    end if;
  end loop;
  return v_ajustes;
exception
  when invalid_text_representation or numeric_value_out_of_range or unique_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Carga números de serie de unidades que ya existen (sin movimientos). Las disponibles de la ubicación, con las
-- nuevas, no pueden superar el stock de la ubicación. Devuelve cuántas registró.
create function public.registrar_series(p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid, p_series text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series text[];
  v_stock numeric;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_series is null or cardinality(p_series) = 0 or array_position(p_series, null) is not null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if cardinality(p_series) > 500 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  if not exists (select 1 from public.productos where id = p_producto_id and negocio_id = p_negocio_id and controla_serie and tipo <> 'servicio')
     or not exists (select 1 from public.ubicaciones where id = p_ubicacion_id and negocio_id = p_negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  select array_agg(btrim(x)) into v_series from unnest(p_series) x;
  if array_position(v_series, '') is not null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if (select count(distinct x) from unnest(v_series) x) <> cardinality(v_series) then
    raise exception 'ERP_SERIE_DUPLICADA';
  end if;

  if exists (select 1 from public.series where negocio_id = p_negocio_id and producto_id = p_producto_id and serie = any (v_series)) then
    raise exception 'ERP_SERIE_DUPLICADA';
  end if;

  -- Serializa con otras cargas y con movimientos de esa ubicación.
  select cantidad into v_stock from public.stock
  where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id for update;
  if (select count(*) from public.series
      where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id and estado = 'disponible')
     + cardinality(v_series) > greatest(coalesce(v_stock, 0), 0) then
    raise exception 'ERP_SERIES_EXCEDEN_STOCK';
  end if;

  insert into public.series (negocio_id, producto_id, serie, ubicacion_id)
  select p_negocio_id, p_producto_id, x, p_ubicacion_id from unnest(v_series) x;
  return cardinality(v_series);
exception
  when unique_violation then
    raise exception 'ERP_SERIE_DUPLICADA';
end;
$$;

-- Items: [{producto_id, costo}], máximo 200. Un ajuste_costo por cada fila de stock del producto cuyo promedio
-- cambie; sin filas de stock no hace nada. Sin ref_id (no es idempotente por operación: es idempotente por valor).
-- Devuelve cuántos movimientos generó.
create function public.fijar_costos(p_negocio_id uuid, p_items jsonb, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_producto_id uuid;
  v_costo numeric;
  v_stock record;
  v_n integer := 0;
begin
  if not (public.tiene_permiso(p_negocio_id, 'ajustar_inventario') and public.tiene_permiso(p_negocio_id, 'ver_costos')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;

  for v_item in select e from jsonb_array_elements(p_items) e order by e ->> 'producto_id' loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'producto_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'costo') is distinct from 'number' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_costo := (v_item ->> 'costo')::numeric;
    if v_costo < 0 or v_costo <> round(v_costo, 4)
       or not exists (select 1 from public.productos where id = v_producto_id and negocio_id = p_negocio_id and tipo <> 'servicio') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    for v_stock in
      select ubicacion_id, costo_promedio from public.stock
      where producto_id = v_producto_id and negocio_id = p_negocio_id
      order by ubicacion_id for update
    loop
      if v_stock.costo_promedio is distinct from v_costo then
        insert into public.movimientos_inventario (
          negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, usuario_id, motivo
        ) values (
          p_negocio_id, v_stock.ubicacion_id, v_producto_id, 'ajuste_costo', 0, v_costo, 'costos',
          (select auth.uid()), nullif(btrim(p_motivo), '')
        );
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.validar_inventario(uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.bloquear_series(uuid, uuid, uuid, uuid[], numeric) from public, anon, authenticated;
revoke all on function public.registrar_entrada(uuid, uuid, uuid, uuid, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.ajustar_inventario(uuid, uuid, uuid, uuid, text, numeric, text, uuid[]) from public, anon, authenticated;
revoke all on function public.trasladar_stock(uuid, uuid, uuid, uuid, uuid, numeric, text, uuid[]) from public, anon, authenticated;
revoke all on function public.registrar_conteo(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.registrar_series(uuid, uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function public.fijar_costos(uuid, jsonb, text) from public, anon, authenticated;

grant execute on function public.registrar_entrada(uuid, uuid, uuid, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.ajustar_inventario(uuid, uuid, uuid, uuid, text, numeric, text, uuid[]) to authenticated;
grant execute on function public.trasladar_stock(uuid, uuid, uuid, uuid, uuid, numeric, text, uuid[]) to authenticated;
grant execute on function public.registrar_conteo(uuid, uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.registrar_series(uuid, uuid, uuid, text[]) to authenticated;
grant execute on function public.fijar_costos(uuid, jsonb, text) to authenticated;
