-- M-10 (PR 3): el cierre de caja deja de mostrar el esperado en vivo junto al contado guardado.
--  * resumen_caja suma tardias_ventas, tardias_ventas_total y tardias_movimientos (lo que llegó después del cierre,
--    marcado 'caja_cerrada'); null sin `ver_reportes`, como los otros términos.
--  * reporte_caja usa el esperado guardado (monto_esperado) en sesiones cerradas; en abiertas, el vivo.
-- Aditiva: create or replace con la misma firma; los grants no cambian.

create or replace function public.resumen_caja(p_sesion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_res jsonb;
  v_rev boolean;
begin
  select negocio_id into v_negocio_id from public.caja_sesiones where id = p_sesion_id;
  v_rev := coalesce(public.tiene_permiso(v_negocio_id, 'ver_reportes'), false);
  if v_negocio_id is null or not (v_rev or public.tiene_permiso(v_negocio_id, 'caja')) then
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
    'anticipos_efectivo', coalesce((select sum(p.monto) from public.reserva_pagos p
                                    where p.caja_sesion_id = s.id and p.tipo = 'anticipo' and p.medio = 'efectivo'), 0),
    'anticipos_qr', coalesce((select sum(p.monto) from public.reserva_pagos p
                              where p.caja_sesion_id = s.id and p.tipo = 'anticipo' and p.medio = 'qr'), 0),
    'devoluciones_reserva_efectivo', coalesce((select sum(p.monto) from public.reserva_pagos p
                                               where p.caja_sesion_id = s.id and p.tipo = 'devolucion' and p.medio = 'efectivo'), 0),
    'devoluciones_reserva_qr', coalesce((select sum(p.monto) from public.reserva_pagos p
                                         where p.caja_sesion_id = s.id and p.tipo = 'devolucion' and p.medio = 'qr'), 0),
    'cuotas_efectivo', coalesce((select sum(cp.monto) from public.credito_pagos cp
                                 where cp.caja_sesion_id = s.id and cp.medio = 'efectivo'), 0),
    'cuotas_qr', coalesce((select sum(cp.monto) from public.credito_pagos cp
                           where cp.caja_sesion_id = s.id and cp.medio = 'qr'), 0),
    'esperado', public.efectivo_esperado(s.id),
    'qr_neto', public.total_qr_sesion(s.id),
    'qr_pendiente', coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                              where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'qr'
                                and vp.verificacion = 'pendiente'), 0),
    'cantidad_ventas', (select count(*) from public.ventas v where v.caja_sesion_id = s.id),
    'cantidad_movimientos', (select count(*) from public.caja_movimientos m where m.sesion_id = s.id),
    'tardias_ventas', (select count(*) from public.ventas v
                       where v.caja_sesion_id = s.id and v.estado = 'completada' and 'caja_cerrada' = any (v.motivos_revision)),
    'tardias_ventas_total', coalesce((select sum(v.total) from public.ventas v
                                      where v.caja_sesion_id = s.id and v.estado = 'completada'
                                        and 'caja_cerrada' = any (v.motivos_revision)), 0),
    'tardias_movimientos', (select count(*) from public.caja_movimientos m
                            where m.sesion_id = s.id and 'caja_cerrada' = any (m.motivos_revision))
  ) into v_res
  from public.caja_sesiones s where s.id = p_sesion_id;
  -- M4: sin `ver_reportes` van en null todos los términos del esperado (queda monto_inicial, que escribió el cajero).
  -- Residual aceptado: por RLS todo miembro sigue leyendo las filas de ventas, movimientos y devoluciones (el POS las usa).
  if not v_rev then
    v_res := v_res || jsonb_build_object('ventas_efectivo', null, 'ingresos', null, 'gastos', null, 'retiros', null,
      'devoluciones_efectivo', null, 'esperado', null, 'qr_neto', null,
      'anticipos_efectivo', null, 'anticipos_qr', null, 'devoluciones_reserva_efectivo', null, 'devoluciones_reserva_qr', null,
      'cuotas_efectivo', null, 'cuotas_qr', null,
      'tardias_ventas', null, 'tardias_ventas_total', null, 'tardias_movimientos', null);
  end if;
  return v_res;
end;
$$;

create or replace function public.reporte_caja(p_negocio_id uuid, p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_filas jsonb;
  v_tot jsonb;
  v_n integer;
begin
  if not public.tiene_permiso(p_negocio_id, 'ver_reportes') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 365 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  with r as (
    select s.id, d.nombre as equipo, d.prefijo, coalesce(pe.nombre, 'Sin nombre') as cajero, s.abierta_en, s.cerrada_en, s.monto_inicial,
           (x ->> 'ventas_efectivo')::numeric as ventas_efectivo, (x ->> 'qr_neto')::numeric as qr_neto,
           (x ->> 'qr_pendiente')::numeric as qr_pendiente, (x ->> 'ingresos')::numeric as ingresos,
           (x ->> 'gastos')::numeric + (x ->> 'retiros')::numeric as egresos,
           (x ->> 'devoluciones_efectivo')::numeric as devoluciones_efectivo,
           (x ->> 'anticipos_efectivo')::numeric - (x ->> 'devoluciones_reserva_efectivo')::numeric as reservas_efectivo,
           (x ->> 'cuotas_efectivo')::numeric as cuotas_efectivo,
           (x ->> 'cuotas_qr')::numeric as cuotas_qr,
           (x ->> 'anticipos_qr')::numeric - (x ->> 'devoluciones_reserva_qr')::numeric as reservas_qr,
           case when s.cerrada_en is not null then s.monto_esperado else (x ->> 'esperado')::numeric end as esperado,
           s.monto_contado as contado, s.diferencia
    from public.caja_sesiones s
    join public.dispositivos d on d.id = s.dispositivo_id
    left join public.perfiles pe on pe.id = s.usuario_apertura
    cross join lateral public.resumen_caja(s.id) x
    where s.negocio_id = p_negocio_id
      and s.abierta_en >= p_desde::timestamp at time zone 'America/La_Paz'
      and s.abierta_en < (p_hasta + 1)::timestamp at time zone 'America/La_Paz'
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'sesion_id', r.id, 'equipo', r.equipo, 'prefijo', r.prefijo, 'cajero', r.cajero,
        'abierta_en', r.abierta_en, 'cerrada_en', r.cerrada_en, 'monto_inicial', r.monto_inicial,
        'ventas_efectivo', r.ventas_efectivo, 'ventas_qr', r.qr_neto - r.reservas_qr - r.cuotas_qr, 'qr_pendiente', r.qr_pendiente,
        'ingresos', r.ingresos, 'egresos', r.egresos, 'devoluciones_efectivo', r.devoluciones_efectivo,
        'reservas_efectivo', r.reservas_efectivo, 'cuotas_efectivo', r.cuotas_efectivo,
        'reservas_qr', r.reservas_qr, 'cuotas_qr', r.cuotas_qr,
        'esperado', r.esperado, 'contado', r.contado, 'diferencia', r.diferencia)
      order by r.abierta_en, r.id), '[]'::jsonb) from r),
    (select count(*) from r),
    (select jsonb_build_object('sesiones', count(*), 'monto_inicial', coalesce(sum(r.monto_inicial), 0),
        'ventas_efectivo', coalesce(sum(r.ventas_efectivo), 0), 'ventas_qr', coalesce(sum(r.qr_neto - r.reservas_qr - r.cuotas_qr), 0),
        'qr_pendiente', coalesce(sum(r.qr_pendiente), 0), 'ingresos', coalesce(sum(r.ingresos), 0),
        'egresos', coalesce(sum(r.egresos), 0), 'devoluciones_efectivo', coalesce(sum(r.devoluciones_efectivo), 0),
        'reservas_efectivo', coalesce(sum(r.reservas_efectivo), 0), 'cuotas_efectivo', coalesce(sum(r.cuotas_efectivo), 0),
        'reservas_qr', coalesce(sum(r.reservas_qr), 0), 'cuotas_qr', coalesce(sum(r.cuotas_qr), 0),
        'esperado', coalesce(sum(r.esperado) filter (where r.cerrada_en is not null), 0),
        'contado', coalesce(sum(r.contado) filter (where r.cerrada_en is not null), 0),
        'diferencia', coalesce(sum(r.diferencia) filter (where r.cerrada_en is not null), 0),
        'sesiones_abiertas', count(*) filter (where r.cerrada_en is null),
        'esperado_abiertas', coalesce(sum(r.esperado) filter (where r.cerrada_en is null), 0)) from r)
  into v_filas, v_n, v_tot;
  if v_n > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  return jsonb_build_object('filas', v_filas, 'totales', v_tot);
end;
$$;
