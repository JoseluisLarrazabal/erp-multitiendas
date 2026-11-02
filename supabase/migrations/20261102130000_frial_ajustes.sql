-- Fase 5, PR 2: ajustes de revisión. Lotes solo en el frial; lotes_por_vencer expone la unidad del producto.

create or replace function public.registrar_entrada_lote(
  p_operacion_id uuid, p_negocio_id uuid, p_producto_id uuid, p_ubicacion_id uuid,
  p_cantidad numeric, p_costo_unitario numeric, p_motivo text, p_lote text, p_vence date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := btrim(p_lote);
  v_mov_id uuid;
  v_lote public.lotes;
  v_lote_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'ajustar_inventario') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  -- Los lotes son del frial.
  if (select tipo from public.negocios where id = p_negocio_id) is distinct from 'frial' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_codigo is null or v_codigo = '' or length(v_codigo) > 40 or p_vence is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- La operación ya es una entrada sin lote (registrar_entrada): no se le pega un lote después.
  if exists (select 1 from public.movimientos_inventario m where m.ref_id = p_operacion_id and m.negocio_id = p_negocio_id)
     and not exists (select 1 from public.lotes l join public.movimientos_inventario m on m.id = l.movimiento_id
                     where m.ref_id = p_operacion_id and m.negocio_id = p_negocio_id) then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;

  v_mov_id := public.registrar_entrada(
    p_operacion_id, p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad, p_costo_unitario, p_motivo);

  select * into v_lote from public.lotes where movimiento_id = v_mov_id;
  if found then
    if v_lote.codigo <> v_codigo or v_lote.vence <> p_vence then
      raise exception 'ERP_OPERACION_REPETIDA';
    end if;
    return v_lote.id;
  end if;

  -- Un error aquí deshace también la entrada: es la misma transacción.
  if p_vence < (now() at time zone 'America/La_Paz')::date
     or (select controla_serie from public.productos where id = p_producto_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  insert into public.lotes (negocio_id, producto_id, ubicacion_id, codigo, vence, cantidad, movimiento_id, usuario_id)
  values (p_negocio_id, p_producto_id, p_ubicacion_id, v_codigo, p_vence, p_cantidad, v_mov_id, (select auth.uid()))
  returning id into v_lote_id;
  return v_lote_id;
end;
$$;

revoke all on function public.registrar_entrada_lote(uuid, uuid, uuid, uuid, numeric, numeric, text, text, date) from public, anon, authenticated;
grant execute on function public.registrar_entrada_lote(uuid, uuid, uuid, uuid, numeric, numeric, text, text, date) to authenticated;

create or replace function public.lotes_por_vencer(p_negocio_id uuid, p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
begin
  if not (public.tiene_permiso(p_negocio_id, 'ajustar_inventario') or public.tiene_permiso(p_negocio_id, 'ver_reportes')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_dias is null or p_dias < 0 or p_dias > 3650 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'lote_id', t.id, 'codigo', t.codigo, 'vence', t.vence, 'dias_restantes', t.vence - v_hoy,
      'cantidad', t.cantidad, 'saldo', t.saldo,
      'producto_id', t.producto_id, 'producto_codigo', p.codigo, 'producto_nombre', p.nombre, 'unidad', p.unidad,
      'ubicacion_id', t.ubicacion_id, 'ubicacion_nombre', u.nombre
    ) order by t.vence, t.created_at, t.id)
    from (
      select l.*,
        greatest(0, least(l.cantidad,
          coalesce((select sum(s.cantidad) from public.stock s
                    where s.negocio_id = l.negocio_id and s.producto_id = l.producto_id), 0)
          - coalesce((select sum(m.cantidad) from public.movimientos_inventario m
                      where m.negocio_id = l.negocio_id and m.producto_id = l.producto_id
                        and m.tipo in ('inicial', 'compra', 'entrada') and m.cantidad > 0
                        and m.id <> l.movimiento_id and (m.created_at, m.id) > (lm.created_at, lm.id)), 0))) as saldo
      from public.lotes l
      join public.movimientos_inventario lm on lm.id = l.movimiento_id
      where l.negocio_id = p_negocio_id
    ) t
    join public.productos p on p.id = t.producto_id
    join public.ubicaciones u on u.id = t.ubicacion_id
    where t.saldo > 0 and t.vence <= v_hoy + p_dias
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.lotes_por_vencer(uuid, integer) from public, anon, authenticated;
grant execute on function public.lotes_por_vencer(uuid, integer) to authenticated;
