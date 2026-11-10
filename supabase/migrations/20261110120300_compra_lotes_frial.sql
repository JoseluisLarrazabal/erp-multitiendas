-- M-8 (PR 2 de preentrega, Entrega B): la compra en el frial pide lote y vencimiento por línea.
-- registrar_compra se copia íntegra de 20261108120000_compras.sql (for share del proveedor, validar_inventario, forma de
-- respuesta, huella md5(p_compra::text), grants) con las líneas de lote. Sin errores nuevos: todo es ERP_DATOS_INVALIDOS.
-- La base pasa a exigir lote en el frial: la web anterior a este PR ya no puede comprar en el frial (producción: 0 compras).

-- p_compra: id, negocio_id, proveedor_id, ubicacion_id, condicion, medio (solo contado, obligatorio), total, items
-- [{producto_id, cantidad, costo_unitario, lote, vence}]. Devuelve {id, total, condicion}.
-- M-8: en el frial cada línea exige lote (1 a 40 caracteres) y vence (YYYY-MM-DD, desde hoy en La Paz) y crea su fila en
-- `lotes` con el movimiento de la compra (misma lógica que registrar_entrada_lote); fuera del frial no llevan lote ni vence.
-- Un producto con serie no se compra en el frial.
create or replace function public.registrar_compra(p_compra jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_id uuid;
  v_proveedor_id uuid;
  v_ubicacion_id uuid;
  v_condicion text;
  v_medio text;
  v_total numeric;
  v_total_items numeric := 0;
  v_items jsonb;
  v_item jsonb;
  v_ids uuid[] := '{}';
  v_cants numeric[] := '{}';
  v_costos numeric[] := '{}';
  v_lotes text[] := '{}';
  v_vences date[] := '{}';
  v_lote text;
  v_vence date;
  v_frial boolean;
  v_mov_id uuid;
  v_pid uuid;
  v_cant numeric;
  v_costo numeric;
  i integer;
  v_producto public.productos;
  v_existente public.compras;
begin
  perform public.payload_claves(p_compra, array[
    'id', 'negocio_id', 'proveedor_id', 'ubicacion_id', 'condicion', 'medio', 'total', 'items']);
  v_negocio_id := public.payload_uuid(p_compra, 'negocio_id', false);
  if not public.tiene_permiso(v_negocio_id, 'gestionar_compras') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  v_frial := (select tipo from public.negocios where id = v_negocio_id) = 'frial';
  v_id := public.payload_uuid(p_compra, 'id', false);
  v_proveedor_id := public.payload_uuid(p_compra, 'proveedor_id', false);
  v_ubicacion_id := public.payload_uuid(p_compra, 'ubicacion_id', false);
  v_condicion := public.payload_texto(p_compra, 'condicion', 10);
  v_total := public.payload_numero(p_compra, 'total', 2);
  v_items := p_compra -> 'items';
  if v_condicion not in ('contado', 'credito') or jsonb_typeof(v_items) is distinct from 'array'
     or jsonb_array_length(v_items) not between 1 and 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_condicion = 'contado' then
    v_medio := public.payload_texto(p_compra, 'medio', 20);
    if v_medio not in ('efectivo', 'qr', 'transferencia') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  elsif p_compra ? 'medio' and jsonb_typeof(p_compra -> 'medio') <> 'null' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Validación pura de los ítems y recálculo del total (el servidor manda).
  for v_item in select * from jsonb_array_elements(v_items) loop
    perform public.payload_claves(v_item, array['producto_id', 'cantidad', 'costo_unitario', 'lote', 'vence']);
    v_pid := public.payload_uuid(v_item, 'producto_id', false);
    v_cant := public.payload_numero(v_item, 'cantidad', 3);
    v_costo := public.payload_numero(v_item, 'costo_unitario', 4);
    if v_cant <= 0 or v_pid = any (v_ids) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_lote := null;
    v_vence := null;
    if v_frial then
      v_lote := public.payload_texto(v_item, 'lote', 40);
      if jsonb_typeof(v_item -> 'vence') is distinct from 'string' or v_item ->> 'vence' !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
      v_vence := (v_item ->> 'vence')::date;
    elsif (v_item ? 'lote' and jsonb_typeof(v_item -> 'lote') <> 'null')
       or (v_item ? 'vence' and jsonb_typeof(v_item -> 'vence') <> 'null') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_ids := v_ids || v_pid;
    v_lotes := v_lotes || v_lote;
    v_vences := v_vences || v_vence;
    v_cants := v_cants || v_cant;
    v_costos := v_costos || v_costo;
    v_total_items := v_total_items + round(v_cant * v_costo, 2);
  end loop;
  if v_total_items <> v_total then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if not public.reclamar_operacion(v_id, v_negocio_id, md5(p_compra::text)) then
    select * into v_existente from public.compras where id = v_id;
    return jsonb_build_object('id', v_existente.id, 'total', v_existente.total, 'condicion', v_existente.condicion);
  end if;
  -- Depende del reloj: va después de reclamar para que un reintento pasada la medianoche devuelva la respuesta original.
  if exists (select 1 from unnest(v_vences) v where v < (now() at time zone 'America/La_Paz')::date) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  perform 1 from public.proveedores where id = v_proveedor_id and negocio_id = v_negocio_id and activo for share;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.compras (id, negocio_id, proveedor_id, ubicacion_id, total, condicion, usuario_id)
  values (v_id, v_negocio_id, v_proveedor_id, v_ubicacion_id, v_total, v_condicion, (select auth.uid()));

  for i in 1 .. cardinality(v_ids) loop
    v_producto := public.validar_inventario(v_negocio_id, v_ids[i], v_ubicacion_id, v_cants[i]);
    if not v_producto.activo or (v_frial and v_producto.controla_serie) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  -- Mismo orden de bloqueo que las ventas (por producto): sin interbloqueo con una venta concurrente.
  perform public.bloquear_stock(v_negocio_id, v_ubicacion_id, v_ids);
  for i in 1 .. cardinality(v_ids) loop
    insert into public.compra_items (compra_id, negocio_id, producto_id, cantidad, costo_unitario)
    values (v_id, v_negocio_id, v_ids[i], v_cants[i], v_costos[i]);
    insert into public.movimientos_inventario (
      negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id
    ) values (
      v_negocio_id, v_ubicacion_id, v_ids[i], 'compra', v_cants[i], v_costos[i], 'compra', v_id, (select auth.uid())
    ) returning id into v_mov_id;
    if v_frial then
      insert into public.lotes (negocio_id, producto_id, ubicacion_id, codigo, vence, cantidad, movimiento_id, usuario_id)
      values (v_negocio_id, v_ids[i], v_ubicacion_id, v_lotes[i], v_vences[i], v_cants[i], v_mov_id, (select auth.uid()));
    end if;
  end loop;

  if v_condicion = 'contado' and v_total > 0 then
    insert into public.proveedor_pagos (id, negocio_id, proveedor_id, compra_id, monto, medio, usuario_id)
    values (gen_random_uuid(), v_negocio_id, v_proveedor_id, v_id, v_total, v_medio, (select auth.uid()));
  end if;
  return jsonb_build_object('id', v_id, 'total', round(v_total, 2), 'condicion', v_condicion);
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation
       or invalid_datetime_format or datetime_field_overflow then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.registrar_compra(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_compra(jsonb) to authenticated;
