-- scripts/importacion/ corre con service_role fuera de la app. Las tablas creadas por migración no le dan privilegios
-- de DML (solo REFERENCES, TRIGGER, TRUNCATE...), y las RPC de inventario exigen auth.uid(), que una clave de servicio no tiene.
-- Se le da lo mínimo: leer lo que concilia, insertar catálogo y llamar a registrar_stock_inicial.
-- `stock` y `auditoria` los escriben los triggers (security definer): service_role solo los lee.
-- negocios y ubicaciones: el alta se hace por script y seed (docs/plan-fase-1.md).
-- categorias y productos van por insert directo: son catálogo, no contabilidad. El kardex solo por RPC.

grant select on public.negocios, public.ubicaciones, public.categorias, public.productos,
  public.movimientos_inventario, public.stock, public.auditoria to service_role;
grant insert on public.negocios, public.ubicaciones, public.categorias, public.productos to service_role;

-- Stock inicial (importación). p_items: [{producto_id, ubicacion_id, cantidad}], máximo 500. Todo o nada.
-- Idempotente por producto: si ya tiene un `inicial` en cualquier ubicación, se omite completo ("ya existía"); así
-- reimportar tras corregir una ubicación no duplica stock. Cantidad 0 no genera movimiento ni se cuenta.
-- Devuelve {creados, ya_existian}. Sin costo ni usuario (no hay sesión). Solo service_role.
create function public.registrar_stock_inicial(p_negocio_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_producto uuid;
  v_ubicacion uuid;
  v_cantidad numeric;
  v_unidad text;
  v_creados integer := 0;
  v_existian integer := 0;
begin
  if p_negocio_id is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item -> 'cantidad') is distinct from 'number' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_producto := (v_item ->> 'producto_id')::uuid;
    v_ubicacion := (v_item ->> 'ubicacion_id')::uuid;
    v_cantidad := (v_item ->> 'cantidad')::numeric;

    -- for update: dos importaciones a la vez no pueden poner `inicial` al mismo producto en ubicaciones distintas.
    select unidad into v_unidad from public.productos
      where id = v_producto and negocio_id = p_negocio_id and tipo <> 'servicio' for update;
    if not found
       or not exists (select 1 from public.ubicaciones where id = v_ubicacion and negocio_id = p_negocio_id)
       or v_cantidad < 0 or v_cantidad = 'NaN' or v_cantidad <> round(v_cantidad, 3)
       or (v_unidad = 'unidad' and v_cantidad <> trunc(v_cantidad)) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    if v_cantidad = 0 then
      continue;
    end if;
    if exists (select 1 from public.movimientos_inventario where producto_id = v_producto and tipo = 'inicial') then
      v_existian := v_existian + 1;
      continue;
    end if;
    insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, ref_tipo)
    values (p_negocio_id, v_ubicacion, v_producto, 'inicial', v_cantidad, 'importacion');
    v_creados := v_creados + 1;
  end loop;
  return jsonb_build_object('creados', v_creados, 'ya_existian', v_existian);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

revoke all on function public.registrar_stock_inicial(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_stock_inicial(uuid, jsonb) to service_role;
