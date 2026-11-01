-- Arqueo de una sesión de caja, de solo lectura, calculado en SQL. Exige `caja` o `ver_reportes` sobre el negocio de la
-- sesión; sesión inexistente o de otro negocio = ERP_SIN_PERMISO (no confirma que exista). No la usa /pos (arqueo ciego).
-- `esperado` sale de efectivo_esperado y `qr_neto` de total_qr_sesion, en la misma sentencia (un solo snapshot): el
-- desglose suma exactamente a `esperado`.
create function public.resumen_caja(p_sesion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_res jsonb;
begin
  select negocio_id into v_negocio_id from public.caja_sesiones where id = p_sesion_id;
  if v_negocio_id is null
     or not (public.tiene_permiso(v_negocio_id, 'caja') or public.tiene_permiso(v_negocio_id, 'ver_reportes')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select jsonb_build_object(
    'monto_inicial', s.monto_inicial,
    'ventas_efectivo', coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                                 where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'efectivo'), 0),
    'ingresos', coalesce((select sum(m.monto) from public.caja_movimientos m where m.sesion_id = s.id and m.tipo = 'ingreso'), 0),
    'gastos', coalesce((select sum(m.monto) from public.caja_movimientos m where m.sesion_id = s.id and m.tipo = 'gasto'), 0),
    'retiros', coalesce((select sum(m.monto) from public.caja_movimientos m where m.sesion_id = s.id and m.tipo = 'retiro'), 0),
    'devoluciones_efectivo', coalesce((select sum(d.monto_efectivo) from public.devoluciones d where d.caja_sesion_id = s.id), 0),
    'esperado', public.efectivo_esperado(s.id),
    'qr_neto', public.total_qr_sesion(s.id),
    'cantidad_ventas', (select count(*) from public.ventas v where v.caja_sesion_id = s.id),
    'cantidad_movimientos', (select count(*) from public.caja_movimientos m where m.sesion_id = s.id)
  ) into v_res
  from public.caja_sesiones s where s.id = p_sesion_id;
  return v_res;
end;
$$;

revoke all on function public.resumen_caja(uuid) from public, anon, authenticated;
grant execute on function public.resumen_caja(uuid) to authenticated;
