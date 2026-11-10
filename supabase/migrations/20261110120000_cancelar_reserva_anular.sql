-- M-1: cancelar una reserva devuelve el anticipo por caja, así que exige también el permiso 'anular' (dueño y encargado).
-- Copia íntegra de 20261108150000_reservas.sql; único cambio: la condición de permiso. create or replace conserva los grants.
create or replace function public.cancelar_reserva(p_operacion_id uuid, p_reserva_id uuid, p_sesion_id uuid, p_dispositivo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reserva public.reservas;
  v_sesion public.caja_sesiones;
  v_pago public.reserva_pagos;
  v_costo numeric;
begin
  select * into v_reserva from public.reservas where id = p_reserva_id;
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id and dispositivo_id = p_dispositivo_id;
  if p_operacion_id is null or p_reserva_id is null or p_sesion_id is null or v_reserva.id is null or v_sesion.id is null
     or v_reserva.negocio_id <> v_sesion.negocio_id
     or not public.tiene_permiso(v_reserva.negocio_id, 'gestionar_reservas')
     or not public.tiene_permiso(v_reserva.negocio_id, 'caja')
     or not public.tiene_permiso(v_reserva.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  -- Reintento de la misma operación: devuelve lo original (la reserva ya está cancelada).
  if not public.reclamar_operacion(p_operacion_id, v_reserva.negocio_id,
       md5(jsonb_build_array('cancelar_reserva', p_reserva_id, p_sesion_id, p_dispositivo_id)::text)) then
    return jsonb_build_object('id', p_reserva_id, 'estado', 'cancelada');
  end if;
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_reserva from public.reservas where id = p_reserva_id for update;
  if v_reserva.estado <> 'activa' then
    raise exception 'ERP_RESERVA_NO_ACTIVA';
  end if;
  select * into v_pago from public.reserva_pagos where reserva_id = p_reserva_id and tipo = 'anticipo';
  if v_pago.medio = 'efectivo' and v_pago.monto > public.efectivo_esperado(p_sesion_id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  perform public.bloquear_stock(v_reserva.negocio_id, v_reserva.ubicacion_id, array[v_reserva.producto_id]);
  select costo_unitario into v_costo from public.movimientos_inventario where ref_id = p_reserva_id and tipo = 'reserva';
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id)
  values (v_reserva.negocio_id, v_reserva.ubicacion_id, v_reserva.producto_id, 'reserva_liberada', v_reserva.cantidad,
    v_costo, 'reserva', p_reserva_id, v_uid);
  insert into public.reserva_pagos (negocio_id, reserva_id, monto, medio, caja_sesion_id, tipo, usuario_id)
  values (v_reserva.negocio_id, p_reserva_id, v_pago.monto, v_pago.medio, p_sesion_id, 'devolucion', v_uid);
  update public.reservas set estado = 'cancelada', cerrada_en = now() where id = p_reserva_id;
  return jsonb_build_object('id', p_reserva_id, 'estado', 'cancelada');
end;
$$;
