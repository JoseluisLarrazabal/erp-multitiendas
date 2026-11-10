-- Conteo con reservas (B-2): una reserva baja el stock con un movimiento 'reserva', pero la mercadería sigue en el
-- local. El conteo esperaba solo stock.cantidad y ajustaba +reservado; al cancelar la reserva quedaba de más.
-- Ahora lo esperado es stock + reservado activo. Si lo contado es menor que lo reservado el stock queda negativo:
-- es deliberado, delata reservas sin mercadería.

create view public.stock_reservado
with (security_invoker = true)
as
select r.negocio_id, r.producto_id, r.ubicacion_id, sum(r.cantidad) as cantidad
from public.reservas r
where r.estado = 'activa'
group by r.negocio_id, r.producto_id, r.ubicacion_id;

revoke all on public.stock_reservado from public, anon, authenticated;
grant select on public.stock_reservado to authenticated;

create or replace function public.registrar_conteo(
  p_operacion_id uuid, p_negocio_id uuid, p_ubicacion_id uuid, p_items jsonb, p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conteo_id uuid;
  v_producto public.productos;
  v_item jsonb;
  v_producto_id uuid;
  v_contada numeric;
  v_sistema numeric;
  v_reservado numeric;
  v_costo numeric;
  v_diferencia numeric;
  v_serie_ids uuid[];
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

  if not public.reclamar_operacion(p_operacion_id, p_negocio_id, md5(jsonb_build_array(
       'conteo', p_negocio_id, p_ubicacion_id, p_items, p_motivo)::text)) then
    return (select count(*)::integer from public.movimientos_inventario where ref_id = p_operacion_id and ref_tipo = 'conteo');
  end if;

  insert into public.conteos (id, negocio_id, ubicacion_id, usuario_id, motivo)
  values (p_operacion_id, p_negocio_id, p_ubicacion_id, (select auth.uid()), nullif(btrim(p_motivo), ''))
  returning id into v_conteo_id;

  -- Orden fijo por producto: dos conteos concurrentes no se bloquean en cruz.
  for v_item in select e from jsonb_array_elements(p_items) e order by (e ->> 'producto_id')::uuid loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'producto_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'cantidad_contada') is distinct from 'number' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_contada := (v_item ->> 'cantidad_contada')::numeric;
    if v_contada < 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto := public.validar_inventario(p_negocio_id, v_producto_id, p_ubicacion_id, v_contada);

    -- Crea la fila si falta: el for update serializa también el primer conteo de ese producto.
    insert into public.stock (negocio_id, producto_id, ubicacion_id, cantidad)
    values (p_negocio_id, v_producto_id, p_ubicacion_id, 0)
    on conflict do nothing;
    select cantidad, costo_promedio into v_sistema, v_costo from public.stock
    where producto_id = v_producto_id and ubicacion_id = p_ubicacion_id for update;
    v_sistema := coalesce(v_sistema, 0);
    -- Lo reservado sigue en el local aunque el kardex ya lo descontó: se suma a lo esperado. Sentencia aparte,
    -- posterior al for update: en READ COMMITTED ve las reservas confirmadas hasta ahora, no una foto previa al bloqueo.
    select coalesce(sum(cantidad), 0) into v_reservado from public.reservas
    where producto_id = v_producto_id and ubicacion_id = p_ubicacion_id and estado = 'activa';
    v_sistema := v_sistema + v_reservado;

    -- Un producto repetido en el lote viola la clave de conteo_items.
    insert into public.conteo_items (conteo_id, negocio_id, producto_id, cantidad_sistema, cantidad_contada)
    values (v_conteo_id, p_negocio_id, v_producto_id, v_sistema, v_contada);

    v_diferencia := v_contada - v_sistema;
    if v_diferencia <> 0 then
      v_serie_ids := null;
      if v_producto.controla_serie and v_diferencia < 0 then
        if jsonb_typeof(v_item -> 'serie_ids') is distinct from 'array' then
          raise exception 'ERP_DATOS_INVALIDOS';
        end if;
        select array_agg(x::uuid) into v_serie_ids from jsonb_array_elements_text(v_item -> 'serie_ids') x;
      end if;
      insert into public.movimientos_inventario (
        negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, motivo
      ) values (
        p_negocio_id, p_ubicacion_id, v_producto_id, 'ajuste', v_diferencia,
        case when v_diferencia < 0 then v_costo end, 'conteo', v_conteo_id, (select auth.uid()),
        coalesce(nullif(btrim(p_motivo), ''), 'Conteo de inventario')
      );
      if v_producto.controla_serie and v_diferencia < 0 then
        perform public.bloquear_series(p_negocio_id, v_producto_id, p_ubicacion_id, v_serie_ids, -v_diferencia);
        update public.series set estado = 'baja' where id = any (v_serie_ids);
      end if;
      v_ajustes := v_ajustes + 1;
    end if;
  end loop;
  return v_ajustes;
exception
  when invalid_text_representation or numeric_value_out_of_range or unique_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.registrar_conteo(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_conteo(uuid, uuid, uuid, jsonb, text) to authenticated;
