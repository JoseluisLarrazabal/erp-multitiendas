-- Reverso del último pago de una cuota (M-2, permiso `anular`) y marcar documentos del crédito (M-6, `gestionar_credito`).
-- El reverso es un contraasiento: una fila NEGATIVA por medio en credito_pagos, que apunta al pago original (anula_operacion_id).
-- Nada se borra ni se edita. Como saldo_credito, cuotas_con_pago (FIFO), efectivo_esperado, total_qr_sesion y resumen_caja suman
-- credito_pagos, quedan bien sin copiarlos. El reverso se escribe en una sesión de caja ABIERTA elegida por quien lo hace (puede ser
-- otra distinta de la del cobro); nunca en una sesión cerrada, así el arqueo cerrado no cambia.
-- Orden de bloqueo (el mismo de pagar_cuota y cancelar_reserva): sesión de caja, luego el crédito.
-- Errores nuevos: ERP_PAGO_NO_ES_ULTIMO (solo se revierte el último pago vivo, para no reabrir imputaciones FIFO).
-- Límite: anular_credito_inicial sigue rechazando un crédito que tuvo pagos aunque estén revertidos (conservador).

alter table public.credito_pagos
  add column anula_operacion_id uuid,
  add column motivo text;

-- Un cobro es positivo; un reverso es negativo y lleva motivo y el pago que anula.
alter table public.credito_pagos drop constraint credito_pagos_monto_check;
alter table public.credito_pagos
  add constraint credito_pagos_monto_check
    check (monto <> 'NaN' and ((anula_operacion_id is null and monto > 0) or (anula_operacion_id is not null and monto < 0))) not valid;
alter table public.credito_pagos validate constraint credito_pagos_monto_check;
alter table public.credito_pagos
  add constraint credito_pagos_motivo_check check ((anula_operacion_id is null) = (motivo is null));
-- Un pago no se revierte dos veces (por medio).
create unique index credito_pagos_anula_uq on public.credito_pagos (anula_operacion_id, medio) where anula_operacion_id is not null;

-- p_operacion_id: UUID del cliente de este reverso (idempotente). p_pago_operacion_id: la operación del cobro a revertir.
-- Devuelve {id, saldo} (id = p_operacion_id); {ya_anulado: true} si ese cobro ya tenía reverso.
create function public.anular_pago_cuota(
  p_operacion_id uuid, p_pago_operacion_id uuid, p_sesion_id uuid, p_dispositivo_id uuid, p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(p_motivo, E' \t\r\n');
  v_pago public.credito_pagos;
  v_sesion public.caja_sesiones;
  v_credito public.creditos;
  v_ultimo uuid;
  v_ef numeric;
begin
  if p_operacion_id is null or p_pago_operacion_id is null or p_sesion_id is null or p_dispositivo_id is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select * into v_pago from public.credito_pagos where operacion_id = p_pago_operacion_id order by medio limit 1;
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id and dispositivo_id = p_dispositivo_id;
  -- Mismo error para "no existe" y "de otro negocio": no se filtra existencia.
  if v_pago.id is null or v_sesion.id is null or v_pago.negocio_id <> v_sesion.negocio_id
     or not public.tiene_permiso(v_pago.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_pago.anula_operacion_id is not null or v_motivo is null or v_motivo = '' or char_length(v_motivo) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if not public.reclamar_operacion(p_operacion_id, v_pago.negocio_id,
       md5(jsonb_build_array('anular_pago_cuota', p_pago_operacion_id, p_sesion_id, p_dispositivo_id, v_motivo)::text)) then
    return jsonb_build_object('id', p_operacion_id, 'saldo', public.saldo_credito(v_pago.credito_id));
  end if;

  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_credito from public.creditos where id = v_pago.credito_id for update;

  if exists (select 1 from public.credito_pagos where anula_operacion_id = p_pago_operacion_id) then
    return jsonb_build_object('id', p_operacion_id, 'saldo', public.saldo_credito(v_credito.id), 'ya_anulado', true);
  end if;
  -- Último pago vivo: cobro (monto > 0) sin reverso, el más reciente.
  select p.operacion_id into v_ultimo from public.credito_pagos p
  where p.credito_id = v_credito.id and p.anula_operacion_id is null
    and not exists (select 1 from public.credito_pagos r where r.anula_operacion_id = p.operacion_id)
  order by p.created_at desc, p.operacion_id desc limit 1;
  if v_ultimo is distinct from p_pago_operacion_id then
    raise exception 'ERP_PAGO_NO_ES_ULTIMO';
  end if;
  select coalesce(sum(monto), 0) into v_ef from public.credito_pagos
  where operacion_id = p_pago_operacion_id and anula_operacion_id is null and medio = 'efectivo';
  if v_ef > public.efectivo_esperado(p_sesion_id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id, usuario_id,
    anula_operacion_id, motivo)
  select p.negocio_id, p.credito_id, p_operacion_id, -p.monto, p.medio, p_sesion_id, v_uid, p_pago_operacion_id, v_motivo
  from public.credito_pagos p where p.operacion_id = p_pago_operacion_id and p.anula_operacion_id is null;
  if v_credito.estado = 'pagado' then
    update public.creditos set estado = 'activo' where id = v_credito.id;
  end if;
  return jsonb_build_object('id', p_operacion_id, 'saldo', public.saldo_credito(v_credito.id));
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Marca o desmarca los documentos de un crédito de venta (CI, domicilio, pagaré). Audita solo si algo cambió.
create function public.marcar_documentos_credito(p_credito_id uuid, p_ci boolean, p_domicilio boolean, p_pagare boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cr public.creditos;
begin
  select * into v_cr from public.creditos where id = p_credito_id;
  if v_cr.id is null or not public.tiene_permiso(v_cr.negocio_id, 'gestionar_credito') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_ci is null or p_domicilio is null or p_pagare is null or v_cr.origen <> 'venta' or v_cr.estado = 'anulado' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select * into v_cr from public.creditos where id = p_credito_id for update;
  if v_cr.estado = 'anulado' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_cr.docs_ci is distinct from p_ci or v_cr.docs_domicilio is distinct from p_domicilio
     or v_cr.docs_pagare is distinct from p_pagare then
    insert into public.auditoria (tabla, registro_id, negocio_id, accion, antes, despues, usuario_id)
    values ('creditos', p_credito_id::text, v_cr.negocio_id, 'update',
      jsonb_build_object('docs_ci', v_cr.docs_ci, 'docs_domicilio', v_cr.docs_domicilio, 'docs_pagare', v_cr.docs_pagare),
      jsonb_build_object('docs_ci', p_ci, 'docs_domicilio', p_domicilio, 'docs_pagare', p_pagare), (select auth.uid()));
    update public.creditos set docs_ci = p_ci, docs_domicilio = p_domicilio, docs_pagare = p_pagare where id = p_credito_id;
  end if;
end;
$$;

-- detalle_credito (20261108160000), misma firma: cada pago suma operacion_id, anula_operacion_id y motivo; la raíz suma
-- ultimo_pago_id (el pago que se puede anular: el último vivo, o null).
create or replace function public.detalle_credito(p_credito_id uuid default null, p_venta_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
  v_cr public.creditos;
  v_cuotas jsonb;
  v_pagos jsonb;
  v_nombre text;
  v_doc text;
  v_numero text;
  v_total numeric;
  v_pagado numeric;
  v_ultimo uuid;
begin
  select * into v_cr from public.creditos c
  where (p_credito_id is not null and c.id = p_credito_id) or (p_credito_id is null and c.venta_id = p_venta_id);
  if v_cr.id is null or not (public.tiene_permiso(v_cr.negocio_id, 'gestionar_credito')
       or public.tiene_permiso(v_cr.negocio_id, 'ver_reportes') or public.tiene_permiso(v_cr.negocio_id, 'caja')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  select cl.nombre, cl.ci_nit into v_nombre, v_doc from public.clientes cl where cl.id = v_cr.cliente_id;
  select v.numero into v_numero from public.ventas v where v.id = v_cr.venta_id;
  select coalesce(jsonb_agg(jsonb_build_object('numero', q.numero, 'vence_en', q.vence_en, 'capital', q.capital,
           'interes', q.interes, 'monto', q.monto, 'pagado', q.pagado, 'pendiente', q.pendiente,
           'dias_atraso', case when q.pendiente > 0 and q.vence_en < v_hoy then v_hoy - q.vence_en else 0 end)
         order by q.numero), '[]'::jsonb),
         coalesce(sum(q.monto), 0), coalesce(sum(q.pagado), 0)
  into v_cuotas, v_total, v_pagado from public.cuotas_con_pago(v_cr.id) q;
  select coalesce(jsonb_agg(jsonb_build_object('monto', p.monto, 'medio', p.medio, 'creado_en', p.created_at,
           'operacion_id', p.operacion_id, 'anula_operacion_id', p.anula_operacion_id, 'motivo', p.motivo)
         order by p.created_at, p.id), '[]'::jsonb)
  into v_pagos from public.credito_pagos p where p.credito_id = v_cr.id;
  select p.operacion_id into v_ultimo from public.credito_pagos p
  where p.credito_id = v_cr.id and p.anula_operacion_id is null
    and not exists (select 1 from public.credito_pagos r where r.anula_operacion_id = p.operacion_id)
  order by p.created_at desc, p.operacion_id desc limit 1;
  return jsonb_build_object(
    'id', v_cr.id, 'negocio_id', v_cr.negocio_id, 'cliente_id', v_cr.cliente_id, 'cliente_nombre', v_nombre,
    'cliente_documento', v_doc, 'origen', v_cr.origen, 'venta_id', v_cr.venta_id, 'venta_numero', v_numero,
    'capital', v_cr.capital, 'inicial', v_cr.inicial, 'interes_mensual_pct', v_cr.interes_mensual_pct,
    'estado', v_cr.estado, 'motivo_anulacion', v_cr.motivo_anulacion, 'docs_ci', v_cr.docs_ci, 'docs_domicilio', v_cr.docs_domicilio, 'docs_pagare', v_cr.docs_pagare,
    'creado_en', v_cr.created_at, 'total', v_total, 'pagado', v_pagado, 'saldo', public.saldo_credito(v_cr.id),
    'cuotas', v_cuotas, 'pagos', v_pagos, 'ultimo_pago_id', v_ultimo);
end;
$$;

revoke all on function public.anular_pago_cuota(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.marcar_documentos_credito(uuid, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.anular_pago_cuota(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.marcar_documentos_credito(uuid, boolean, boolean, boolean) to authenticated;
