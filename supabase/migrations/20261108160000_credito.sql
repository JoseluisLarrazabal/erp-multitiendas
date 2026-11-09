-- Venta a crédito, cuotas y cuentas por cobrar (fase 7, Entrega B, PR 4; RF-CRE-01 a 06). Decisiones en docs/plan-fase-7.md
-- (1, 2, 3, 4, 7, 8, 9) y en docs/handoff.md.
-- Permisos: crear un crédito (venta a crédito, saldo inicial, parámetros) exige `gestionar_credito` (dueño y encargado; la
-- lavandería no lo tiene, matriz); cobrar una cuota exige `caja`. Leer cuentas por cobrar: `gestionar_credito` o `ver_reportes`
-- (con cliente, también `caja`, para cobrar en el POS).
-- Errores nuevos: ERP_VENTA_CON_CREDITO (anular o devolver una venta con crédito), ERP_INICIAL_INSUFICIENTE (inicial bajo el
-- mínimo del negocio), ERP_PAGO_EXCEDE_SALDO (pagar de más, DB-22). Crédito solo en línea: ERP_REQUIERE_CONEXION con p_offline.
-- Cuotas: plan_cuotas (sistema francés, P-07). "Pagada" y "vencida" se derivan: los pagos cubren las cuotas de la más vieja a la
-- más nueva (FIFO) y saldo = suma de cuotas - suma de pagos; no se guarda aparte. credito_pagos entra al arqueo (efectivo_esperado,
-- total_qr_sesion, resumen_caja, reporte_caja).
-- Lectura: las filas de creditos, credito_cuotas y credito_pagos las puede leer por RLS cualquier miembro del negocio (igual que
-- ventas y clientes: el POS las necesita). El permiso de las RPC de lectura ordena los listados; no es secreto. Riesgo aceptado.
-- shortcut: frecuencia solo mensual (sin columna: no hay otra) y un solo interés mensual por negocio; el interés de una venta a crédito no entra a
-- ventas.total (queda en las cuotas); agregar frecuencias o contabilizar el interés cuando el cliente lo pida.

-- Parámetros por negocio. Sin fila rigen los valores por defecto (50 %, 3 cuotas, 2,5 % mensual), ver credito_params.
create table public.credito_config (
  negocio_id uuid primary key references public.negocios (id),
  inicial_pct numeric(5,2) not null default 50 check (inicial_pct > 0 and inicial_pct < 100),
  plazo_cuotas smallint not null default 3 check (plazo_cuotas between 1 and 36),
  max_cuotas smallint not null default 12 check (max_cuotas between 1 and 36),
  interes_mensual_pct numeric(5,2) not null default 2.5 check (interes_mensual_pct >= 0 and interes_mensual_pct <= 100),
  updated_at timestamptz not null default now(),
  constraint credito_config_plazo_ck check (plazo_cuotas <= max_cuotas)
);

-- Los parámetros de la venta se copian al crear (interes_mensual_pct). capital = lo financiado (total - inicial).
create table public.creditos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  venta_id uuid,
  cliente_id uuid not null,
  capital numeric(12,2) not null check (capital > 0 and capital <> 'NaN'),
  inicial numeric(12,2) not null default 0 check (inicial >= 0 and inicial <> 'NaN'),
  interes_mensual_pct numeric(5,2) not null check (interes_mensual_pct >= 0 and interes_mensual_pct <= 100),
  estado text not null default 'activo' check (estado in ('activo', 'pagado', 'anulado')),
  origen text not null check (origen in ('venta', 'saldo_inicial')),
  docs_ci boolean not null default false,
  docs_domicilio boolean not null default false,
  docs_pagare boolean not null default false,
  usuario_id uuid,
  created_at timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por uuid,
  motivo_anulacion text,
  unique (negocio_id, id),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id),
  constraint creditos_origen_ck check ((origen = 'venta') = (venta_id is not null)),
  constraint creditos_anulacion_ck check ((estado = 'anulado') = (anulado_en is not null and motivo_anulacion is not null))
);
create unique index creditos_venta_uq on public.creditos (venta_id) where venta_id is not null;
create index creditos_negocio_estado_idx on public.creditos (negocio_id, estado, created_at desc);
create index creditos_cliente_idx on public.creditos (negocio_id, cliente_id);

-- Se generan al crear el crédito y no cambian: no hay columna "pagado" (se deriva de los pagos).
create table public.credito_cuotas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  credito_id uuid not null,
  numero smallint not null check (numero > 0),
  vence_en date not null,
  capital numeric(12,2) not null check (capital >= 0 and capital <> 'NaN'),
  interes numeric(12,2) not null check (interes >= 0 and interes <> 'NaN'),
  foreign key (negocio_id, credito_id) references public.creditos (negocio_id, id),
  unique (credito_id, numero),
  constraint credito_cuotas_monto_ck check (capital + interes > 0)
);

-- Un pago abona al crédito (sin cuota_id, decisión 2). operacion_id es el UUID del cliente: un pago mixto escribe una fila por
-- medio y el reintento no duplica (índice único).
create table public.credito_pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  credito_id uuid not null,
  operacion_id uuid not null,
  monto numeric(12,2) not null check (monto > 0 and monto <> 'NaN'),
  medio text not null check (medio in ('efectivo', 'qr')),
  caja_sesion_id uuid not null,
  usuario_id uuid,
  created_at timestamptz not null default now(),
  foreign key (negocio_id, credito_id) references public.creditos (negocio_id, id),
  foreign key (negocio_id, caja_sesion_id) references public.caja_sesiones (negocio_id, id)
);
create unique index credito_pagos_operacion_uq on public.credito_pagos (operacion_id, medio);
create index credito_pagos_credito_idx on public.credito_pagos (credito_id);
create index credito_pagos_sesion_idx on public.credito_pagos (caja_sesion_id);

-- creditos cambia de estado solo por RPC (sin grants de escritura): aquí solo se impide borrar. Cuotas y pagos son append-only.
create trigger creditos_sin_borrar
  before delete on public.creditos
  for each row execute function public.rechazar_modificacion();
create trigger creditos_sin_truncate
  before truncate on public.creditos
  for each statement execute function public.rechazar_modificacion();
create trigger credito_cuotas_solo_agregar
  before update or delete on public.credito_cuotas
  for each row execute function public.rechazar_modificacion();
create trigger credito_cuotas_sin_truncate
  before truncate on public.credito_cuotas
  for each statement execute function public.rechazar_modificacion();
create trigger credito_pagos_solo_agregar
  before update or delete on public.credito_pagos
  for each row execute function public.rechazar_modificacion();
create trigger credito_pagos_sin_truncate
  before truncate on public.credito_pagos
  for each statement execute function public.rechazar_modificacion();
-- Cambiar el interés o la inicial mueve plata: queda en auditoria (la ve quien tiene `ver_reportes`).
create trigger credito_config_auditar
  after insert or update or delete on public.credito_config
  for each row execute function public.auditar_cambio('negocio_id');

alter table public.credito_config enable row level security;
alter table public.creditos enable row level security;
alter table public.credito_cuotas enable row level security;
alter table public.credito_pagos enable row level security;
create policy credito_config_select on public.credito_config
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy creditos_select on public.creditos
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy credito_cuotas_select on public.credito_cuotas
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
create policy credito_pagos_select on public.credito_pagos
  for select to authenticated using (negocio_id in (select public.mis_negocios()));
-- Sin costos en estas tablas: select de tabla, sin escritura (todo cambia por RPC).
revoke all on public.credito_config from anon, authenticated, public;
revoke all on public.creditos from anon, authenticated, public;
revoke all on public.credito_cuotas from anon, authenticated, public;
revoke all on public.credito_pagos from anon, authenticated, public;
grant select on public.credito_config to authenticated;
grant select on public.creditos to authenticated;
grant select on public.credito_cuotas to authenticated;
grant select on public.credito_pagos to authenticated;

-- Las líneas de una venta a crédito van en la lista `credito`.
alter table public.venta_items
  drop constraint venta_items_lista_check,
  add constraint venta_items_lista_check check (lista in ('contado', 'credito', 'mayorista', 'minimo', 'normal', 'express'));

-- Plan de cuotas, sistema francés (P-07, decisión 1): cuota fija = C*i / (1 - (1+i)^-n) redondeada a 2 decimales; el interés de cada
-- período es el saldo por i, redondeado; la última cuota cobra el saldo que queda y absorbe la diferencia. Con i = 0, C / n. Pura.
-- Si cambia la regla de interés, se cambia solo esta función.
create function public.plan_cuotas(p_capital numeric, p_interes_pct numeric, p_n integer)
returns table (numero integer, capital numeric, interes numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_i numeric := p_interes_pct / 100;
  v_cuota numeric;
  v_saldo numeric := p_capital;
  v_int numeric;
  v_cap numeric;
begin
  if p_capital is null or p_capital <= 0 or p_capital <> round(p_capital, 2) or p_interes_pct is null
     or p_interes_pct < 0 or p_interes_pct > 100 or p_n is null or p_n not between 1 and 36 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_cuota := round(case when v_i = 0 then p_capital / p_n else p_capital * v_i / (1 - power(1 + v_i, -p_n)) end, 2);
  for k in 1..p_n loop
    v_int := round(v_saldo * v_i, 2);
    v_cap := case when k = p_n then v_saldo else least(v_cuota - v_int, v_saldo) end;
    if v_cap < 0 or v_cap + v_int <= 0 then
      raise exception 'ERP_DATOS_INVALIDOS'; -- capital demasiado chico para tantas cuotas
    end if;
    numero := k;
    capital := v_cap;
    interes := v_int;
    return next;
    v_saldo := v_saldo - v_cap;
  end loop;
end;
$$;

-- Parámetros del negocio con los valores por defecto cuando no hay fila. Privada.
create function public.credito_params(p_negocio_id uuid)
returns public.credito_config
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select c from public.credito_config c where c.negocio_id = p_negocio_id),
    row(p_negocio_id, 50::numeric(5,2), 3::smallint, 12::smallint, 2.5::numeric(5,2), now())::public.credito_config)
$$;

-- Cuotas de un crédito con lo pagado: los pagos cubren de la cuota más vieja a la más nueva (decisión 2). Privada.
create function public.cuotas_con_pago(p_credito_id uuid)
returns table (numero integer, vence_en date, capital numeric, interes numeric, monto numeric, pagado numeric, pendiente numeric)
language sql
stable
set search_path = ''
as $$
  with q as (
    select c.numero, c.vence_en, c.capital, c.interes, c.capital + c.interes as monto,
           sum(c.capital + c.interes) over (order by c.numero) as acum
    from public.credito_cuotas c where c.credito_id = p_credito_id
  ), p as (
    select coalesce(sum(monto), 0) as total from public.credito_pagos where credito_id = p_credito_id
  )
  select q.numero::integer, q.vence_en, q.capital, q.interes, q.monto,
         least(q.monto, greatest(p.total - (q.acum - q.monto), 0)),
         q.monto - least(q.monto, greatest(p.total - (q.acum - q.monto), 0))
  from q cross join p order by q.numero
$$;

-- Parámetros vigentes (los de la tabla o los por defecto). Lee quien gestiona o ve reportes.
create function public.credito_parametros(p_negocio_id uuid)
returns table (inicial_pct numeric, plazo_cuotas integer, max_cuotas integer, interes_mensual_pct numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.credito_config;
begin
  if not (public.tiene_permiso(p_negocio_id, 'gestionar_credito') or public.tiene_permiso(p_negocio_id, 'ver_reportes')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  v_c := public.credito_params(p_negocio_id);
  return query select v_c.inicial_pct, v_c.plazo_cuotas::integer, v_c.max_cuotas::integer, v_c.interes_mensual_pct;
end;
$$;

-- Guarda los parámetros (permiso `gestionar_credito`). El plazo por defecto no supera el máximo.
create function public.guardar_credito_config(
  p_negocio_id uuid, p_inicial_pct numeric, p_plazo_cuotas integer, p_max_cuotas integer, p_interes_mensual_pct numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_credito') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_inicial_pct is null or p_plazo_cuotas is null or p_max_cuotas is null or p_interes_mensual_pct is null
     or p_inicial_pct <= 0 or p_inicial_pct >= 100 or p_inicial_pct <> round(p_inicial_pct, 2)
     or p_interes_mensual_pct < 0 or p_interes_mensual_pct > 100 or p_interes_mensual_pct <> round(p_interes_mensual_pct, 2)
     or p_max_cuotas not between 1 and 36 or p_plazo_cuotas not between 1 and p_max_cuotas then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  insert into public.credito_config (negocio_id, inicial_pct, plazo_cuotas, max_cuotas, interes_mensual_pct)
  values (p_negocio_id, p_inicial_pct, p_plazo_cuotas, p_max_cuotas, p_interes_mensual_pct)
  on conflict (negocio_id) do update
    set inicial_pct = excluded.inicial_pct, plazo_cuotas = excluded.plazo_cuotas, max_cuotas = excluded.max_cuotas,
        interes_mensual_pct = excluded.interes_mensual_pct, updated_at = now();
end;
$$;

-- Saldo inicial (RF-CRE-06, decisión 8): un crédito sin venta ni caja, con el capital que el cliente aún debe, sin interés (el monto
-- cargado es lo que se adeuda) y cuotas iguales desde la fecha de la primera. Idempotente por p_id, que es el id del crédito.
create function public.crear_credito_inicial(
  p_id uuid, p_negocio_id uuid, p_cliente_id uuid, p_capital numeric, p_cuotas integer, p_primera date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_credito') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_id is null or p_cliente_id is null or p_capital is null or p_capital <= 0 or p_capital >= 1e10
     or p_capital <> round(p_capital, 2) or p_cuotas is null or p_cuotas not between 1 and 36 or p_primera is null
     or p_primera < date '2020-01-01' or p_primera > v_hoy + 366
     or not exists (select 1 from public.clientes where id = p_cliente_id and negocio_id = p_negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if not public.reclamar_operacion(p_id, p_negocio_id,
       md5(jsonb_build_array('credito_inicial', p_cliente_id, p_capital, p_cuotas, p_primera)::text)) then
    return jsonb_build_object('id', p_id);
  end if;
  insert into public.creditos (id, negocio_id, cliente_id, capital, inicial, interes_mensual_pct, origen, usuario_id)
  values (p_id, p_negocio_id, p_cliente_id, p_capital, 0, 0, 'saldo_inicial', v_uid);
  insert into public.credito_cuotas (negocio_id, credito_id, numero, vence_en, capital, interes)
  select p_negocio_id, p_id, p.numero, (p_primera + make_interval(months => p.numero - 1))::date, p.capital, p.interes
  from public.plan_cuotas(p_capital, 0, p_cuotas) p;
  return jsonb_build_object('id', p_id);
end;
$$;

-- Saldo de un crédito: suma de cuotas menos suma de pagos (no se guarda aparte). Privada.
create function public.saldo_credito(p_credito_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(capital + interes) from public.credito_cuotas where credito_id = p_credito_id), 0)
       - coalesce((select sum(monto) from public.credito_pagos where credito_id = p_credito_id), 0)
$$;

-- p_pago: id (UUID del cliente, idempotente por reclamar_operacion + huella), credito_id, dispositivo_id, caja_sesion_id (sesión
-- abierta de ese equipo), efectivo y qr (Bs, suma > 0; el QR lo confirmó el cajero en el mostrador). Pagar de más:
-- ERP_PAGO_EXCEDE_SALDO (DB-22). Devuelve {id, saldo}. Solo en línea.
create function public.pagar_cuota(p_pago jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_credito_id uuid;
  v_dispositivo_id uuid;
  v_sesion_id uuid;
  v_ef numeric;
  v_qr numeric;
  v_sesion public.caja_sesiones;
  v_credito public.creditos;
  v_saldo numeric;
begin
  perform public.payload_claves(p_pago, array['id', 'credito_id', 'dispositivo_id', 'caja_sesion_id', 'efectivo', 'qr']);
  v_id := public.payload_uuid(p_pago, 'id', false);
  v_credito_id := public.payload_uuid(p_pago, 'credito_id', false);
  v_dispositivo_id := public.payload_uuid(p_pago, 'dispositivo_id', false);
  v_sesion_id := public.payload_uuid(p_pago, 'caja_sesion_id', false);
  v_ef := public.payload_numero(p_pago, 'efectivo', 2, 0);
  v_qr := public.payload_numero(p_pago, 'qr', 2, 0);

  select * into v_sesion from public.caja_sesiones where id = v_sesion_id and dispositivo_id = v_dispositivo_id;
  select * into v_credito from public.creditos where id = v_credito_id;
  if v_sesion.id is null or v_credito.id is null or v_credito.negocio_id <> v_sesion.negocio_id
     or not public.tiene_permiso(v_sesion.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_ef + v_qr <= 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if not public.reclamar_operacion(v_id, v_sesion.negocio_id, md5(p_pago::text)) then
    -- Reintento: misma forma que la primera respuesta, con el saldo de ahora.
    return jsonb_build_object('id', v_id, 'saldo', public.saldo_credito(v_credito_id));
  end if;

  -- Mismo orden de bloqueo que cancelar_reserva: sesión, luego el crédito (el saldo se calcula con la fila bloqueada).
  select * into v_sesion from public.caja_sesiones where id = v_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_credito from public.creditos where id = v_credito_id for update;
  v_saldo := public.saldo_credito(v_credito_id);
  if v_credito.estado <> 'activo' or v_ef + v_qr > v_saldo then
    raise exception 'ERP_PAGO_EXCEDE_SALDO';
  end if;

  insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id, usuario_id)
  select v_sesion.negocio_id, v_credito_id, v_id, t.monto, t.medio, v_sesion_id, v_uid
  from (values ('efectivo', v_ef), ('qr', v_qr)) t (medio, monto) where t.monto > 0;
  if v_saldo - v_ef - v_qr = 0 then
    update public.creditos set estado = 'pagado' where id = v_credito_id;
  end if;
  return jsonb_build_object('id', v_id, 'saldo', v_saldo - v_ef - v_qr);
exception
  when numeric_value_out_of_range or invalid_text_representation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Créditos activos con saldo, una fila por crédito. Privada: la leen cuentas_por_cobrar y nadie más.
-- dias_atraso = hoy menos el vencimiento de la cuota impaga más vieja; proxima_monto = lo que falta de la primera impaga.
create function public.cuentas_base(p_negocio_id uuid, p_cliente_id uuid)
returns table (
  credito_id uuid, cliente_id uuid, cliente_nombre text, cliente_documento text, origen text, venta_numero text,
  creado_en timestamptz, total numeric, pagado numeric, saldo numeric, cuotas_vencidas integer, monto_vencido numeric,
  dias_atraso integer, proxima_vence date, proxima_monto numeric
)
language sql
stable
set search_path = ''
as $$
  select cr.id, cr.cliente_id, cl.nombre, cl.ci_nit, cr.origen, v.numero, cr.created_at,
         x.total, x.pagado, x.total - x.pagado, x.vencidas::integer, x.monto_vencido, x.dias::integer, x.proxima, x.proximo
  from public.creditos cr
  join public.clientes cl on cl.id = cr.cliente_id
  left join public.ventas v on v.id = cr.venta_id
  cross join lateral (
    select coalesce(sum(q.monto), 0) as total, coalesce(sum(q.pagado), 0) as pagado,
           count(*) filter (where q.pendiente > 0 and q.vence_en < (now() at time zone 'America/La_Paz')::date) as vencidas,
           coalesce(sum(q.pendiente) filter (where q.vence_en < (now() at time zone 'America/La_Paz')::date), 0) as monto_vencido,
           coalesce((now() at time zone 'America/La_Paz')::date
                    - min(q.vence_en) filter (where q.pendiente > 0 and q.vence_en < (now() at time zone 'America/La_Paz')::date), 0) as dias,
           min(q.vence_en) filter (where q.pendiente > 0) as proxima,
           (array_agg(q.pendiente order by q.numero) filter (where q.pendiente > 0))[1] as proximo
    from public.cuotas_con_pago(cr.id) q
  ) x
  where cr.negocio_id = p_negocio_id and cr.estado = 'activo' and (p_cliente_id is null or cr.cliente_id = p_cliente_id)
$$;

-- Cuentas por cobrar paginadas en SQL. La unidad de página es el CLIENTE (con todos sus créditos activos), los más atrasados y de
-- mayor saldo primero; con p_solo_vencidas, el CRÉDITO con alguna cuota vencida, el más atrasado primero. total_filas = unidades
-- en total (para el paginador). Con p_cliente_id: los créditos de ese cliente, sin tope ni página (también para quien cobra en
-- el POS: `caja`). Sin cliente rige el tope de 5.000 créditos activos (ERP_LOTE_GRANDE).
create function public.cuentas_por_cobrar(
  p_negocio_id uuid, p_cliente_id uuid default null, p_solo_vencidas boolean default false,
  p_limite integer default 25, p_offset integer default 0
)
returns table (
  credito_id uuid, cliente_id uuid, cliente_nombre text, cliente_documento text, origen text, venta_numero text,
  creado_en timestamptz, total numeric, pagado numeric, saldo numeric, cuotas_vencidas integer, monto_vencido numeric,
  dias_atraso integer, proxima_vence date, proxima_monto numeric, total_filas bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.tiene_permiso(p_negocio_id, 'gestionar_credito') or public.tiene_permiso(p_negocio_id, 'ver_reportes')
          or (p_cliente_id is not null and public.tiene_permiso(p_negocio_id, 'caja'))) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_cliente_id is not null then
    return query
      select b.*, count(*) over ()::bigint from public.cuentas_base(p_negocio_id, p_cliente_id) b
      order by b.dias_atraso desc, b.creado_en, b.credito_id;
    return;
  end if;
  if p_limite is null or p_limite not between 1 and 200 or p_offset is null or p_offset < 0 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if (select count(*) from public.creditos c where c.negocio_id = p_negocio_id and c.estado = 'activo') > 5000 then
    raise exception 'ERP_LOTE_GRANDE';
  end if;
  if p_solo_vencidas then
    return query
      select b.*, count(*) over ()::bigint from public.cuentas_base(p_negocio_id, null) b
      where b.cuotas_vencidas > 0
      order by b.dias_atraso desc, b.creado_en, b.credito_id
      limit p_limite offset p_offset;
    return;
  end if;
  return query
    with b as materialized (select * from public.cuentas_base(p_negocio_id, null)),
    cli as (
      select t.cliente_id, max(t.dias_atraso) as dias, sum(t.saldo) as saldo, min(t.cliente_nombre) as nombre
      from b t group by t.cliente_id
    ),
    pag as (
      select c.*, count(*) over () as total from cli c
      order by c.dias desc, c.saldo desc, c.nombre, c.cliente_id
      limit p_limite offset p_offset
    )
    select b.credito_id, b.cliente_id, b.cliente_nombre, b.cliente_documento, b.origen, b.venta_numero, b.creado_en, b.total,
           b.pagado, b.saldo, b.cuotas_vencidas, b.monto_vencido, b.dias_atraso, b.proxima_vence, b.proxima_monto, pag.total
    from b join pag on pag.cliente_id = b.cliente_id
    order by pag.dias desc, pag.saldo desc, pag.nombre, b.cliente_id, b.dias_atraso desc, b.creado_en, b.credito_id;
end;
$$;

-- Plan de una venta a crédito antes de cobrar (solo lectura): la misma regla que registrar_venta (inicial mínima, cuotas, plan_cuotas
-- con el interés del negocio), para que la pantalla no recalcule nada. p_inicial y p_cuotas nulos = inicial mínima y plazo por
-- defecto. Devuelve {error, minimo, inicial, cuotas, financiado, max_cuotas, inicial_pct, plan[{numero, capital, interes, monto,
-- vence_en}]}; error es null o el código que daría registrar_venta (ERP_INICIAL_INSUFICIENTE, ERP_DATOS_INVALIDOS).
create function public.simular_credito(p_negocio_id uuid, p_total numeric, p_inicial numeric default null, p_cuotas integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cred public.credito_config;
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
  v_min numeric;
  v_ini numeric;
  v_n integer;
  v_plan jsonb;
  v_err text;
begin
  if not public.tiene_permiso(p_negocio_id, 'gestionar_credito') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_total is null or p_total <= 0 or p_total >= 1e10 or p_total <> round(p_total, 2)
     or (p_inicial is not null and (p_inicial <= 0 or p_inicial >= 1e10 or p_inicial <> round(p_inicial, 2))) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_cred := public.credito_params(p_negocio_id);
  v_min := ceil(p_total * v_cred.inicial_pct) / 100;
  v_ini := coalesce(p_inicial, v_min);
  v_n := coalesce(p_cuotas, v_cred.plazo_cuotas);
  if v_ini >= p_total or v_n not between 1 and v_cred.max_cuotas then
    v_err := 'ERP_DATOS_INVALIDOS';
  elsif v_ini < v_min then
    v_err := 'ERP_INICIAL_INSUFICIENTE';
  else
    begin
      select jsonb_agg(jsonb_build_object('numero', p.numero, 'capital', p.capital, 'interes', p.interes,
               'monto', p.capital + p.interes, 'vence_en', (v_hoy + make_interval(months => p.numero))::date) order by p.numero)
      into v_plan from public.plan_cuotas(p_total - v_ini, v_cred.interes_mensual_pct, v_n) p;
    exception when others then
      v_err := 'ERP_DATOS_INVALIDOS'; -- capital demasiado chico para tantas cuotas
    end;
  end if;
  return jsonb_build_object('error', v_err, 'minimo', v_min, 'inicial', v_ini, 'cuotas', v_n,
    'financiado', p_total - v_ini, 'max_cuotas', v_cred.max_cuotas, 'inicial_pct', v_cred.inicial_pct,
    'plan', case when v_err is null then v_plan else '[]'::jsonb end);
end;
$$;

-- Anula un saldo inicial cargado por error (RF-CRE-06): solo origen saldo_inicial y sin pagos. Es la única transición de estado de
-- un crédito que hace una RPC además del pago total; el motivo, quién y cuándo quedan en la fila. Idempotente por p_operacion_id.
create function public.anular_credito_inicial(p_operacion_id uuid, p_credito_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cr public.creditos;
  v_motivo text := btrim(p_motivo);
begin
  select * into v_cr from public.creditos where id = p_credito_id;
  if v_cr.id is null or not public.tiene_permiso(v_cr.negocio_id, 'gestionar_credito') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_operacion_id is null or v_motivo is null or v_motivo = '' or length(v_motivo) > 200 or v_cr.origen <> 'saldo_inicial' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if not public.reclamar_operacion(p_operacion_id, v_cr.negocio_id,
       md5(jsonb_build_array('anular_credito_inicial', p_credito_id, v_motivo)::text)) then
    return jsonb_build_object('id', p_credito_id, 'estado', 'anulado');
  end if;
  select * into v_cr from public.creditos where id = p_credito_id for update;
  if v_cr.estado = 'anulado' then
    -- Ya estaba anulado (otra operación, otra pestaña): el resultado es el que se pedía.
    return jsonb_build_object('id', p_credito_id, 'estado', 'anulado', 'ya_anulado', true);
  end if;
  if v_cr.estado <> 'activo' or exists (select 1 from public.credito_pagos where credito_id = p_credito_id) then
    raise exception 'ERP_CREDITO_CON_PAGOS'; -- ya tiene pagos (o ya está pagado): no se anula
  end if;
  update public.creditos set estado = 'anulado', anulado_en = now(), anulado_por = v_uid, motivo_anulacion = v_motivo
  where id = p_credito_id;
  return jsonb_build_object('id', p_credito_id, 'estado', 'anulado');
end;
$$;

-- Un crédito (por su id o por la venta que lo originó) con sus cuotas y pagos, para el detalle y el plan imprimible.
create function public.detalle_credito(p_credito_id uuid default null, p_venta_id uuid default null)
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
  select coalesce(jsonb_agg(jsonb_build_object('monto', p.monto, 'medio', p.medio, 'creado_en', p.created_at)
         order by p.created_at, p.id), '[]'::jsonb)
  into v_pagos from public.credito_pagos p where p.credito_id = v_cr.id;
  return jsonb_build_object(
    'id', v_cr.id, 'negocio_id', v_cr.negocio_id, 'cliente_id', v_cr.cliente_id, 'cliente_nombre', v_nombre,
    'cliente_documento', v_doc, 'origen', v_cr.origen, 'venta_id', v_cr.venta_id, 'venta_numero', v_numero,
    'capital', v_cr.capital, 'inicial', v_cr.inicial, 'interes_mensual_pct', v_cr.interes_mensual_pct,
    'estado', v_cr.estado, 'motivo_anulacion', v_cr.motivo_anulacion, 'docs_ci', v_cr.docs_ci, 'docs_domicilio', v_cr.docs_domicilio, 'docs_pagare', v_cr.docs_pagare,
    'creado_en', v_cr.created_at, 'total', v_total, 'pagado', v_pagado, 'saldo', public.saldo_credito(v_cr.id),
    'cuotas', v_cuotas, 'pagos', v_pagos);
end;
$$;

revoke all on function public.plan_cuotas(numeric, numeric, integer) from public, anon, authenticated;
revoke all on function public.credito_params(uuid) from public, anon, authenticated;
revoke all on function public.cuotas_con_pago(uuid) from public, anon, authenticated;
revoke all on function public.credito_parametros(uuid) from public, anon, authenticated;
revoke all on function public.guardar_credito_config(uuid, numeric, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.crear_credito_inicial(uuid, uuid, uuid, numeric, integer, date) from public, anon, authenticated;
revoke all on function public.pagar_cuota(jsonb) from public, anon, authenticated;
revoke all on function public.cuentas_base(uuid, uuid) from public, anon, authenticated;
revoke all on function public.saldo_credito(uuid) from public, anon, authenticated;
revoke all on function public.cuentas_por_cobrar(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.simular_credito(uuid, numeric, numeric, integer) from public, anon, authenticated;
revoke all on function public.anular_credito_inicial(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.detalle_credito(uuid, uuid) from public, anon, authenticated;
grant execute on function public.credito_parametros(uuid) to authenticated;
grant execute on function public.guardar_credito_config(uuid, numeric, integer, integer, numeric) to authenticated;
grant execute on function public.crear_credito_inicial(uuid, uuid, uuid, numeric, integer, date) to authenticated;
grant execute on function public.pagar_cuota(jsonb) to authenticated;
grant execute on function public.cuentas_por_cobrar(uuid, uuid, boolean, integer, integer) to authenticated;
grant execute on function public.simular_credito(uuid, numeric, numeric, integer) to authenticated;
grant execute on function public.anular_credito_inicial(uuid, uuid, text) to authenticated;
grant execute on function public.detalle_credito(uuid, uuid) to authenticated;

-- registrar_venta, anular_venta, devolver_venta, resumen_caja, reporte_caja, efectivo_esperado y total_qr_sesion: la última
-- definición (20261108150000), misma firma, solo con lo de crédito (condicion y bloque credito; ERP_VENTA_CON_CREDITO; pagos de
-- cuotas en el arqueo).
create or replace function public.efectivo_esperado(p_sesion_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select s.monto_inicial
    + coalesce((select sum(case m.tipo when 'ingreso' then m.monto else -m.monto end)
                from public.caja_movimientos m where m.sesion_id = s.id), 0)
    + coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                where v.caja_sesion_id = s.id and v.estado = 'completada' and vp.medio = 'efectivo'), 0)
    - coalesce((select sum(d.monto_efectivo) from public.devoluciones d
                where d.caja_sesion_id = s.id), 0)
    + coalesce((select sum(case p.tipo when 'anticipo' then p.monto else -p.monto end) from public.reserva_pagos p
                where p.caja_sesion_id = s.id and p.medio = 'efectivo'), 0)
    + coalesce((select sum(cp.monto) from public.credito_pagos cp
                where cp.caja_sesion_id = s.id and cp.medio = 'efectivo'), 0)
  from public.caja_sesiones s where s.id = p_sesion_id
$$;


create or replace function public.total_qr_sesion(p_sesion_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(vp.monto) from public.venta_pagos vp join public.ventas v on v.id = vp.venta_id
                   where v.caja_sesion_id = p_sesion_id and v.estado = 'completada' and vp.medio = 'qr'
                     and vp.verificacion <> 'rechazado'), 0)
    - coalesce((select sum(d.monto - d.monto_efectivo) from public.devoluciones d
                where d.caja_sesion_id = p_sesion_id), 0)
    + coalesce((select sum(case p.tipo when 'anticipo' then p.monto else -p.monto end) from public.reserva_pagos p
                where p.caja_sesion_id = p_sesion_id and p.medio = 'qr'), 0)
    + coalesce((select sum(cp.monto) from public.credito_pagos cp
                where cp.caja_sesion_id = p_sesion_id and cp.medio = 'qr'), 0)
$$;

create or replace function public.registrar_venta(p_venta jsonb, p_offline jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_dispositivo_id uuid;
  v_caja_id uuid;
  v_numero text;
  v_cliente_id uuid;
  v_creada timestamptz;
  v_desc_venta numeric;
  v_total numeric;
  v_items jsonb;
  v_pagos jsonb;
  v_disp public.dispositivos;
  v_negocio public.negocios;
  v_existente public.ventas;
  v_sesion public.caja_sesiones;
  v_tc numeric;
  v_seq integer;
  v_huella text := md5(p_venta::text);
  v_e jsonb;
  v_ord bigint;
  v_producto public.productos;
  v_lineas jsonb := '[]';
  v_serie_ids uuid[] := '{}';
  v_stock_ids uuid[] := '{}';
  v_cant numeric;
  v_precio numeric;
  v_desc numeric;
  v_lista text;
  v_srv numeric;
  v_min numeric;
  v_piso numeric;
  v_bruto numeric;
  v_total_linea numeric;
  v_subtotal numeric := 0;
  v_base numeric := 0;
  v_sum_lineas numeric := 0;
  v_desc_total numeric := 0;
  v_pide_descuento boolean := false;
  v_suma_pagos numeric := 0;
  v_costo numeric;
  v_cum numeric := 0;
  v_prev_asig numeric := 0;
  v_asig numeric;
  v_constraint text;
  v_serie_id uuid;
  v_off boolean := p_offline is not null and jsonb_typeof(p_offline) <> 'null';
  v_vendedor uuid := v_uid;
  v_tc_off numeric;
  v_impreso text;
  v_motivos text[] := '{}';
  v_ref numeric;
  v_reserva public.reservas;
  v_reserva_id uuid;
  v_anticipo numeric := 0;
  v_n_anticipo integer;
  v_suma_anticipo numeric;
  v_costo_reserva numeric;
  v_condicion text;
  v_es_credito boolean := false;
  v_credito jsonb;
  v_cuotas integer;
  v_cuotas_n numeric;
  v_docs boolean[];
  v_cred public.credito_config;
  v_credito_id uuid;
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
begin
  -- Forma del payload (sin tocar la base)
  perform public.payload_claves(p_venta, array['id', 'dispositivo_id', 'caja_sesion_id', 'numero', 'cliente_id',
    'creada_en_cliente', 'descuento', 'total', 'items', 'pagos', 'reserva_id', 'condicion', 'credito']);
  v_id := public.payload_uuid(p_venta, 'id', false);
  v_dispositivo_id := public.payload_uuid(p_venta, 'dispositivo_id', false);
  v_caja_id := public.payload_uuid(p_venta, 'caja_sesion_id', false);
  v_cliente_id := public.payload_uuid(p_venta, 'cliente_id', true);
  v_reserva_id := public.payload_uuid(p_venta, 'reserva_id', true);
  v_numero := public.payload_texto(p_venta, 'numero', 20);
  v_creada := public.payload_timestamp(p_venta, 'creada_en_cliente');
  v_desc_venta := public.payload_numero(p_venta, 'descuento', 2, 0);
  v_total := public.payload_numero(p_venta, 'total', 2);
  v_items := p_venta -> 'items';
  v_pagos := p_venta -> 'pagos';
  -- Crédito (RF-CRE-01): `condicion` = 'credito' exige el bloque `credito`; sin ella el bloque no puede venir.
  if p_venta -> 'condicion' is not null and jsonb_typeof(p_venta -> 'condicion') <> 'null' then
    v_condicion := public.payload_texto(p_venta, 'condicion', 10);
    if v_condicion not in ('contado', 'credito') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  v_es_credito := coalesce(v_condicion = 'credito', false);
  v_credito := p_venta -> 'credito';
  if v_es_credito then
    perform public.payload_claves(v_credito, array['cuotas', 'docs_ci', 'docs_domicilio', 'docs_pagare']);
    v_cuotas_n := public.payload_numero(v_credito, 'cuotas', 0);
    if v_cuotas_n not between 1 and 36 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_cuotas := v_cuotas_n::integer;
    if jsonb_typeof(v_credito -> 'docs_ci') is distinct from 'boolean'
       or jsonb_typeof(v_credito -> 'docs_domicilio') is distinct from 'boolean'
       or jsonb_typeof(v_credito -> 'docs_pagare') is distinct from 'boolean'
       or v_cliente_id is null or v_reserva_id is not null then
      raise exception 'ERP_DATOS_INVALIDOS'; -- el crédito exige cliente y no se mezcla con una reserva
    end if;
    v_docs := array[(v_credito ->> 'docs_ci')::boolean, (v_credito ->> 'docs_domicilio')::boolean,
      (v_credito ->> 'docs_pagare')::boolean];
  elsif v_credito is not null and jsonb_typeof(v_credito) <> 'null' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) not between 1 and 200
     or jsonb_typeof(v_pagos) is distinct from 'array' or jsonb_array_length(v_pagos) not between 1 and 10 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for v_e in select e from jsonb_array_elements(v_items) e loop
    perform public.payload_claves(v_e, array['producto_id', 'lista', 'cantidad', 'precio_unitario', 'descuento', 'serie_id']);
    perform public.payload_uuid(v_e, 'producto_id', false);
    perform public.payload_uuid(v_e, 'serie_id', true);
    perform public.payload_numero(v_e, 'cantidad', 3);
    perform public.payload_numero(v_e, 'precio_unitario', 2);
    perform public.payload_numero(v_e, 'descuento', 2, 0);
    if jsonb_typeof(v_e -> 'lista') is distinct from 'string' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  for v_e in select e from jsonb_array_elements(v_pagos) e loop
    perform public.payload_claves(v_e, array['medio', 'monto', 'verificado']);
    perform public.payload_numero(v_e, 'monto', 2);
    if jsonb_typeof(v_e -> 'medio') is distinct from 'string' or v_e ->> 'medio' not in ('efectivo', 'qr', 'anticipo')
       or (v_e ->> 'medio' = 'anticipo' and v_reserva_id is null)
       or (v_e -> 'verificado' is not null and jsonb_typeof(v_e -> 'verificado') not in ('boolean', 'null'))
       -- QR: en línea llega confirmado; offline puede venir pendiente (false), pero siempre explícito
       or (v_e ->> 'medio' = 'qr' and case when v_off then jsonb_typeof(v_e -> 'verificado') is distinct from 'boolean'
                                            else v_e -> 'verificado' is distinct from 'true'::jsonb end) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  if v_off and v_reserva_id is not null then
    raise exception 'ERP_REQUIERE_CONEXION'; -- una reserva nunca se encola: el reintento va a reconciliación
  end if;
  if v_off and v_es_credito then
    raise exception 'ERP_REQUIERE_CONEXION'; -- un crédito nunca se encola: el reintento va a reconciliación
  end if;
  if v_off then
    perform public.payload_claves(p_offline, array['vendedor_id', 'tipo_cambio', 'numero_impreso']);
    v_vendedor := public.payload_uuid(p_offline, 'vendedor_id', false);
    if jsonb_typeof(p_offline -> 'tipo_cambio') <> 'null' then -- clave ausente da null y se salta
      v_tc_off := public.payload_numero(p_offline, 'tipo_cambio', 4);
      if v_tc_off <= 0 then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
    end if;
    if jsonb_typeof(p_offline -> 'numero_impreso') <> 'null' then
      v_impreso := public.payload_texto(p_offline, 'numero_impreso', 20);
    end if;
  end if;

  -- Equipo y permiso
  select * into v_disp from public.dispositivos where id = v_dispositivo_id;
  if not found or not public.tiene_permiso(v_disp.negocio_id, 'vender') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_numero !~ '^[A-Z][0-9]{1,2}-[0-9]{6}$' or left(v_numero, length(v_disp.prefijo) + 1) <> v_disp.prefijo || '-' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_seq := right(v_numero, 6)::integer;
  if v_impreso is not null then
    if v_impreso !~ '^[A-Z][0-9]{1,2}-[0-9]{6}$' or left(v_impreso, length(v_disp.prefijo) + 1) <> v_disp.prefijo || '-' then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_impreso <> v_numero then
      v_motivos := v_motivos || 'renumerada'::text;
    end if;
  end if;

  -- Reenvío: devuelve lo original aunque la caja ya haya cerrado
  select * into v_existente from public.ventas where id = v_id;
  if found then
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;
  if v_off and not public.usuario_en_negocio(v_vendedor, v_disp.negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if v_vendedor <> v_uid then
    v_motivos := v_motivos || 'otra_cuenta'::text;
  end if;

  -- Locks: sesión (for share: deja esperando al cierre); el update del equipo serializa las ventas de ese equipo
  select * into v_sesion from public.caja_sesiones
  where id = v_caja_id and negocio_id = v_disp.negocio_id and dispositivo_id = v_dispositivo_id
  for share;
  if not found then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  -- A2: una venta offline hecha antes del cierre se acepta aunque otro usuario cerró la caja (el efectivo ya entró);
  -- la sesión cerrada no se toca y la venta queda para revisión. En línea, o hecha después del cierre, se rechaza.
  -- Solo si la hora cae dentro de la sesión y el cierre es de hace menos de 30 días: una hora inventada no entra.
  if v_sesion.cerrada_en is not null then
    if not v_off or v_creada > v_sesion.cerrada_en or v_creada < v_sesion.abierta_en
       or v_sesion.cerrada_en <= now() - interval '30 days' then
      raise exception 'ERP_CAJA_CERRADA';
    end if;
    v_motivos := v_motivos || 'caja_cerrada'::text;
  end if;
  -- Tope de salto: un número alto por error dejaría al equipo sin numeración (ultimo_numero solo sube).
  update public.dispositivos set ultimo_numero = greatest(ultimo_numero, v_seq)
  where id = v_dispositivo_id and v_seq <= ultimo_numero + 1000;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- Otra llamada con el mismo id pudo ganar mientras esperábamos el lock del equipo.
  select * into v_existente from public.ventas where id = v_id;
  if found then
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;

  select * into v_negocio from public.negocios where id = v_disp.negocio_id;
  if v_negocio.tipo = 'lavanderia' and v_cliente_id is null then -- RF-VEN-04
    if not v_off then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_motivos := v_motivos || 'sin_cliente'::text; -- offline: el equipo no busca clientes; queda para revisión (fase 4)
  end if;
  if v_cliente_id is not null
     and not exists (select 1 from public.clientes where id = v_cliente_id and negocio_id = v_disp.negocio_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select valor into v_tc from public.tipos_cambio where negocio_id = v_disp.negocio_id order by vigente_desde desc limit 1;

  -- Crédito: permiso y parámetros del negocio (la lavandería no tiene `gestionar_credito`, matriz).
  if v_es_credito then
    if not public.tiene_permiso(v_disp.negocio_id, 'gestionar_credito') then
      raise exception 'ERP_SIN_PERMISO';
    end if;
    v_cred := public.credito_params(v_disp.negocio_id);
    if v_cuotas not between 1 and v_cred.max_cuotas then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;

  -- Completar una reserva (RF-RES-02): bloquea la fila, exige un solo ítem igual al reservado y sin descuentos.
  if v_reserva_id is not null then
    if not public.tiene_permiso(v_disp.negocio_id, 'gestionar_reservas') then
      raise exception 'ERP_SIN_PERMISO';
    end if;
    select * into v_reserva from public.reservas where id = v_reserva_id and negocio_id = v_disp.negocio_id for update;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_reserva.estado <> 'activa' then
      raise exception 'ERP_RESERVA_NO_ACTIVA';
    end if;
    if v_reserva.cliente_id is distinct from v_cliente_id or v_reserva.ubicacion_id <> v_disp.ubicacion_id
       or jsonb_array_length(v_items) <> 1 or v_desc_venta <> 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    select coalesce(sum(monto), 0) into v_anticipo from public.reserva_pagos
    where reserva_id = v_reserva_id and tipo = 'anticipo';
    select costo_unitario into v_costo_reserva from public.movimientos_inventario
    where ref_id = v_reserva_id and tipo = 'reserva';
  end if;

  -- Líneas, ordenadas por producto (mismo orden de bloqueo que trasladar_stock)
  for v_e, v_ord in
    select t.e, t.ord from jsonb_array_elements(v_items) with ordinality t (e, ord)
    order by (t.e ->> 'producto_id')::uuid, t.ord
  loop
    v_lista := v_e ->> 'lista';
    if (v_es_credito and v_lista <> 'credito')
       or (not v_es_credito and v_lista not in ('contado', 'mayorista', 'minimo', 'normal', 'express')) then
      raise exception 'ERP_DATOS_INVALIDOS'; -- crédito: toda línea va en la lista `credito` (mismo piso y tope que contado); fuera de crédito no se acepta
    end if;
    select * into v_producto from public.productos
    where id = (v_e ->> 'producto_id')::uuid and negocio_id = v_disp.negocio_id and (activo or v_off) for share;
    if not found or (v_producto.tipo = 'servicio' and v_negocio.tipo <> 'lavanderia') then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if not v_producto.activo then
      v_motivos := v_motivos || 'producto_inactivo'::text;
    end if;
    v_cant := (v_e ->> 'cantidad')::numeric;
    v_precio := (v_e ->> 'precio_unitario')::numeric;
    v_desc := coalesce((v_e ->> 'descuento')::numeric, 0);
    if v_reserva_id is not null and (v_producto.id <> v_reserva.producto_id or v_cant <> v_reserva.cantidad
       or v_precio <> v_reserva.precio_acordado or v_desc <> 0) then
      raise exception 'ERP_DATOS_INVALIDOS'; -- el precio validado es precio_acordado
    end if;
    if v_cant <= 0 or v_precio <= 0 or ((v_producto.unidad = 'unidad' or v_producto.controla_serie) and v_cant <> trunc(v_cant)) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_serie_id := nullif(v_e ->> 'serie_id', '')::uuid;
    if v_producto.controla_serie then
      if v_serie_id is null or v_cant <> 1 or v_serie_id = any (v_serie_ids) then
        raise exception 'ERP_DATOS_INVALIDOS';
      end if;
      v_serie_ids := v_serie_ids || v_serie_id;
    elsif v_serie_id is not null then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;

    v_srv := public.precio_bs(v_producto.id, v_lista);
    if v_srv is null or v_srv <= 0 then
      if v_reserva_id is null then
        if not v_off then
          raise exception 'ERP_PRODUCTO_SIN_PRECIO';
        end if;
        v_motivos := v_motivos || 'sin_precio'::text;
      end if;
      v_srv := null;
    end if;
    -- Piso de la línea: el menor entre el mínimo y la lista elegida, para no castigar una lista publicada bajo el
    -- mínimo. Entre el piso y la lista se negocia sin permiso; bajo el piso exige `descontar` y la brecha cuenta como
    -- descuento y como base del tope (bajar el precio no achica la base).
    -- Sin lista no hay piso (least ignora nulos y dejaría al mínimo como piso de una lista que no existe).
    v_min := public.precio_bs(v_producto.id, 'minimo');
    v_ref := case when v_srv is null or v_reserva_id is not null then null else least(v_min, v_srv) end; -- reserva: sin piso, el precio ya se acordó
    v_bruto := round(v_cant * v_precio, 2);
    v_piso := coalesce(round(v_cant * v_ref, 2), 0);
    if v_desc > 0 or coalesce(v_precio < v_ref, false) then
      v_pide_descuento := true;
    end if;
    v_total_linea := v_bruto - v_desc;
    if v_total_linea < 0 then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_subtotal := v_subtotal + v_bruto;
    v_base := v_base + greatest(v_bruto, v_piso);
    v_sum_lineas := v_sum_lineas + v_total_linea;
    v_desc_total := v_desc_total + v_desc + greatest(v_piso - v_bruto, 0);
    if v_producto.tipo <> 'servicio' then
      v_stock_ids := v_stock_ids || v_producto.id;
    end if;
    v_lineas := v_lineas || jsonb_build_object('linea', v_ord, 'producto_id', v_producto.id, 'serie_id', v_serie_id,
      'lista', v_lista, 'cantidad', v_cant, 'precio', v_precio, 'descuento', v_desc, 'total_linea', v_total_linea,
      'precio_lista', v_srv, 'servicio', v_producto.tipo = 'servicio');
  end loop;

  -- Descuento (RF-VEN-03) y aritmética (DB-11)
  v_desc_total := v_desc_total + v_desc_venta;
  if v_desc_venta > 0 then
    v_pide_descuento := true;
  end if;
  if v_pide_descuento and not public.tiene_permiso_de(v_vendedor, v_disp.negocio_id, 'descontar') then
    if not v_off then
      raise exception 'ERP_SIN_PERMISO';
    end if;
    v_motivos := v_motivos || 'descuento_sin_permiso'::text;
  end if;
  if v_desc_total > v_base * v_negocio.tope_descuento / 100 then
    if not v_off then
      raise exception 'ERP_DESCUENTO_TOPE';
    end if;
    v_motivos := v_motivos || 'sobre_tope'::text;
  end if;
  if v_sum_lineas - v_desc_venta <= 0 or v_sum_lineas - v_desc_venta <> v_total then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for v_e in select e from jsonb_array_elements(v_pagos) e loop
    v_suma_pagos := v_suma_pagos + (v_e ->> 'monto')::numeric;
  end loop;
  if v_es_credito then
    -- Los pagos suman la inicial: al menos inicial_pct del total y menos que el total (queda capital por financiar).
    if v_suma_pagos <= 0 or v_suma_pagos >= v_total then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    if v_suma_pagos < ceil(v_total * v_cred.inicial_pct) / 100 then
      raise exception 'ERP_INICIAL_INSUFICIENTE';
    end if;
  elsif v_suma_pagos <> v_total then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- Con reserva: un solo pago `anticipo` igual a los anticipos recibidos (no es efectivo de la sesión: no entra al arqueo).
  if v_reserva_id is not null then
    select count(*), coalesce(sum((e ->> 'monto')::numeric), 0) into v_n_anticipo, v_suma_anticipo
    from jsonb_array_elements(v_pagos) e where e ->> 'medio' = 'anticipo';
    if v_n_anticipo <> 1 or v_suma_anticipo <> v_anticipo then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;

  select coalesce(array_agg(distinct m order by m), '{}') into v_motivos from unnest(v_motivos) m;
  insert into public.ventas (id, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por,
    cliente_id, origen, creada_en_cliente, subtotal, descuento, total, tipo_cambio, huella, motivos_revision, condicion)
  values (v_id, v_disp.negocio_id, v_disp.ubicacion_id, v_dispositivo_id, v_caja_id, v_numero, v_vendedor, v_uid,
    v_cliente_id, case when v_off then 'offline' else 'online' end, v_creada, v_subtotal, v_desc_venta, v_total,
    coalesce(v_tc_off, v_tc), v_huella, v_motivos, case when v_es_credito then 'credito' else 'contado' end)
  on conflict (id) do nothing;
  if not found then
    select * into v_existente from public.ventas where id = v_id;
    return public.resolver_venta_existente(v_existente, v_disp.negocio_id, v_huella);
  end if;

  -- Stock: filas creadas y bloqueadas en orden de producto; el costo es el promedio de la ubicación del equipo (DB-08)
  perform public.bloquear_stock(v_disp.negocio_id, v_disp.ubicacion_id, v_stock_ids);

  for v_e in select e from jsonb_array_elements(v_lineas) e loop
    v_costo := null;
    if v_reserva_id is not null then
      v_costo := v_costo_reserva; -- costo foto de la reserva, no el promedio de hoy
    elsif not (v_e ->> 'servicio')::boolean then
      select costo_promedio into v_costo from public.stock
      where producto_id = (v_e ->> 'producto_id')::uuid and ubicacion_id = v_disp.ubicacion_id;
    end if;
    -- Descuento de la venta repartido por acumulado redondeado: suma exacta, nunca negativo
    v_cum := v_cum + (v_e ->> 'total_linea')::numeric;
    v_asig := round(v_desc_venta * v_cum / v_sum_lineas, 2);
    insert into public.venta_items (negocio_id, venta_id, linea, producto_id, serie_id, lista, cantidad, precio_unitario,
      precio_lista_servidor, descuento, total_linea, descuento_venta, costo_unitario)
    values (v_disp.negocio_id, v_id, (v_e ->> 'linea')::smallint, (v_e ->> 'producto_id')::uuid,
      nullif(v_e ->> 'serie_id', '')::uuid, v_e ->> 'lista', (v_e ->> 'cantidad')::numeric, (v_e ->> 'precio')::numeric,
      (v_e ->> 'precio_lista')::numeric, (v_e ->> 'descuento')::numeric, (v_e ->> 'total_linea')::numeric,
      v_asig - v_prev_asig, v_costo);
    v_prev_asig := v_asig;
    if (v_e ->> 'serie_id') is not null then
      update public.series set estado = 'vendida'
      where id = (v_e ->> 'serie_id')::uuid and negocio_id = v_disp.negocio_id
        and producto_id = (v_e ->> 'producto_id')::uuid and ubicacion_id = v_disp.ubicacion_id and estado = 'disponible';
      if not found then
        raise exception 'ERP_DATOS_INVALIDOS'; -- DB-15: no está disponible en la ubicación del equipo
      end if;
    end if;
  end loop;

  insert into public.venta_pagos (negocio_id, venta_id, medio, monto, verificacion)
  select v_disp.negocio_id, v_id, e ->> 'medio', (e ->> 'monto')::numeric,
    case when e ->> 'medio' in ('efectivo', 'anticipo') then 'no_aplica'
         when (e ->> 'verificado')::boolean then 'verificado' else 'pendiente' end
  from jsonb_array_elements(v_pagos) e;

  -- Crédito (RF-CRE-01, 02): el crédito y sus cuotas nacen en la misma transacción; el interés es el del negocio (sistema
  -- francés, plan_cuotas) y vencen el mismo día de los meses siguientes.
  if v_es_credito then
    insert into public.creditos (negocio_id, venta_id, cliente_id, capital, inicial, interes_mensual_pct, origen,
      docs_ci, docs_domicilio, docs_pagare, usuario_id)
    values (v_disp.negocio_id, v_id, v_cliente_id, v_total - v_suma_pagos, v_suma_pagos, v_cred.interes_mensual_pct,
      'venta', v_docs[1], v_docs[2], v_docs[3], v_uid)
    returning id into v_credito_id;
    insert into public.credito_cuotas (negocio_id, credito_id, numero, vence_en, capital, interes)
    select v_disp.negocio_id, v_credito_id, p.numero, (v_hoy + make_interval(months => p.numero))::date, p.capital, p.interes
    from public.plan_cuotas(v_total - v_suma_pagos, v_cred.interes_mensual_pct, v_cuotas) p;
  end if;

  -- La reserva ya descontó el stock: se libera (+) y la venta lo descuenta (-), con ref_id distintos (índice único del
  -- kardex). Al completar la liberación va SIN costo (no re-pondera costo_promedio) y la línea de la venta usa la foto.
  if v_reserva_id is not null then
    insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
      ref_tipo, ref_id, usuario_id)
    values (v_disp.negocio_id, v_reserva.ubicacion_id, v_reserva.producto_id, 'reserva_liberada', v_reserva.cantidad,
      null, 'reserva', v_reserva_id, v_uid);
    update public.reservas set estado = 'completada', venta_id = v_id, cerrada_en = now() where id = v_reserva_id;
  end if;
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id)
  select v_disp.negocio_id, v_disp.ubicacion_id, vi.producto_id, 'venta', -sum(vi.cantidad), max(vi.costo_unitario),
    'venta', v_id, v_uid
  from public.venta_items vi
  where vi.venta_id = v_id and vi.producto_id = any (v_stock_ids)
  group by vi.producto_id
  order by vi.producto_id;

  return jsonb_build_object('id', v_id, 'numero', v_numero, 'total', v_total);
exception
  when numeric_value_out_of_range or invalid_text_representation or check_violation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'ventas_numero_uq' then
      raise exception 'ERP_NUMERO_DUPLICADO';
    end if;
    raise;
end;
$$;


create or replace function public.anular_venta(p_venta_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_venta public.ventas;
  v_sesion public.caja_sesiones;
  v_motivo text := btrim(p_motivo);
  v_stock_ids uuid[];
  v_correccion boolean;
begin
  select * into v_venta from public.ventas where id = p_venta_id;
  if not found or not public.tiene_permiso(v_venta.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if exists (select 1 from public.ordenes where id = p_venta_id and estado in ('recibida', 'en_lavado', 'lista')) then
    raise exception 'ERP_ES_ORDEN'; -- orden activa: se anula desde la orden (anular_orden); entregada/cancelada ya no
  end if;
  if exists (select 1 from public.reservas where venta_id = p_venta_id) then
    raise exception 'ERP_VENTA_DE_RESERVA'; -- el anticipo ya está en caja y el stock salió de la reserva: sin reverso automático
  end if;
  if exists (select 1 from public.creditos where venta_id = p_venta_id) then
    raise exception 'ERP_VENTA_CON_CREDITO'; -- las cuotas y la inicial ya están repartidas: sin reverso automático
  end if;
  if v_motivo is null or v_motivo = '' or length(v_motivo) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  select * into v_sesion from public.caja_sesiones where id = v_venta.caja_sesion_id for update;
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.estado = 'anulada' then
    if v_venta.motivo_anulacion = v_motivo then
      return jsonb_build_object('id', v_venta.id, 'numero', v_venta.numero, 'estado', 'anulada');
    end if;
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  if exists (select 1 from public.ordenes where id = p_venta_id and estado = 'entregada') then
    raise exception 'ERP_ORDEN_ENTREGADA'; -- la ropa ya salió: se devuelve, no se anula
  end if;
  -- Corrección de revisión (A2): venta caja_cerrada de sesión cerrada, por quien tiene `ver_reportes`; sin plazo de 24 h.
  v_correccion := v_sesion.cerrada_en is not null and 'caja_cerrada' = any (v_venta.motivos_revision)
    and public.tiene_permiso(v_venta.negocio_id, 'ver_reportes');
  if now() - v_venta.recibida_en > interval '24 hours' and not v_correccion
     and not public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo') then -- RN-08
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_sesion.cerrada_en is not null and not v_correccion then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  if exists (select 1 from public.devoluciones where venta_id = p_venta_id) then
    raise exception 'ERP_VENTA_CON_DEVOLUCIONES';
  end if;
  if v_sesion.cerrada_en is null
     and (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = p_venta_id and medio = 'efectivo')
         > public.efectivo_esperado(v_sesion.id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  select array_agg(distinct vi.producto_id) into v_stock_ids
  from public.venta_items vi join public.productos p on p.id = vi.producto_id
  where vi.venta_id = p_venta_id and p.tipo <> 'servicio';
  perform public.bloquear_stock(v_venta.negocio_id, v_venta.ubicacion_id, v_stock_ids);

  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id, motivo)
  select v_venta.negocio_id, v_venta.ubicacion_id, vi.producto_id, 'anulacion_venta', sum(vi.cantidad),
    max(vi.costo_unitario), 'venta', p_venta_id, v_uid, v_motivo
  from public.venta_items vi
  where vi.venta_id = p_venta_id and vi.producto_id = any (v_stock_ids)
  group by vi.producto_id
  order by vi.producto_id;

  update public.series set estado = 'disponible'
  where id in (select serie_id from public.venta_items where venta_id = p_venta_id and serie_id is not null);

  update public.ventas
  set estado = 'anulada', anulada_en = now(), anulada_por = v_uid, motivo_anulacion = v_motivo
  where id = p_venta_id;
  return jsonb_build_object('id', v_venta.id, 'numero', v_venta.numero, 'estado', 'anulada');
end;
$$;


create or replace function public.devolver_venta(p_devolucion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_venta_id uuid;
  v_dispositivo_id uuid;
  v_caja_id uuid;
  v_medio text;
  v_motivo text;
  v_items jsonb;
  v_venta public.ventas;
  v_disp public.dispositivos;
  v_sesion public.caja_sesiones;
  v_dev public.devoluciones;
  v_e jsonb;
  v_item public.venta_items;
  v_producto public.productos;
  v_cant numeric;
  v_neto numeric;
  v_devuelta numeric;
  v_monto_prev numeric;
  v_monto numeric;
  v_total numeric := 0;
  v_rest_ef numeric;
  v_rest_qr numeric;
  v_ef numeric;
  v_lineas jsonb := '[]';
  v_item_ids uuid[] := '{}';
  v_stock_ids uuid[] := '{}';
  v_item_id uuid;
  v_huella text := md5(p_devolucion::text);
begin
  perform public.payload_claves(p_devolucion, array['id', 'venta_id', 'dispositivo_id', 'caja_sesion_id', 'medio', 'motivo', 'items']);
  v_id := public.payload_uuid(p_devolucion, 'id', false);
  v_venta_id := public.payload_uuid(p_devolucion, 'venta_id', false);
  v_dispositivo_id := public.payload_uuid(p_devolucion, 'dispositivo_id', false);
  v_caja_id := public.payload_uuid(p_devolucion, 'caja_sesion_id', false);
  v_motivo := public.payload_texto(p_devolucion, 'motivo', 200);
  v_medio := public.payload_texto(p_devolucion, 'medio', 10);
  v_items := p_devolucion -> 'items';
  if v_medio not in ('efectivo', 'qr') or jsonb_typeof(v_items) is distinct from 'array'
     or jsonb_array_length(v_items) not between 1 and 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  for v_e in select e from jsonb_array_elements(v_items) e loop
    perform public.payload_claves(v_e, array['venta_item_id', 'cantidad']);
    perform public.payload_uuid(v_e, 'venta_item_id', false);
    perform public.payload_numero(v_e, 'cantidad', 3);
  end loop;

  select * into v_venta from public.ventas where id = v_venta_id;
  if not found or not (public.tiene_permiso(v_venta.negocio_id, 'anular')
                       or public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo')) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if exists (select 1 from public.ordenes where id = v_venta.id and estado in ('recibida', 'en_lavado', 'lista')) then
    raise exception 'ERP_ES_ORDEN'; -- orden activa: se anula desde la orden (anular_orden); entregada/cancelada ya no
  end if;
  if exists (select 1 from public.reservas where venta_id = v_venta.id) then
    raise exception 'ERP_VENTA_DE_RESERVA'; -- el anticipo ya está en caja y el stock salió de la reserva: sin reverso automático
  end if;
  if exists (select 1 from public.creditos where venta_id = v_venta.id) then
    raise exception 'ERP_VENTA_CON_CREDITO'; -- las cuotas y la inicial ya están repartidas: sin reverso automático
  end if;

  select * into v_dev from public.devoluciones where id = v_id;
  if found then
    return public.resolver_devolucion_existente(v_dev, v_venta.negocio_id, v_huella);
  end if;

  -- RN-08 / DB-14
  if now() - v_venta.recibida_en > interval '24 hours' then
    if not public.tiene_permiso(v_venta.negocio_id, 'devolver_fuera_plazo') then
      raise exception 'ERP_SIN_PERMISO';
    end if;
  elsif not public.tiene_permiso(v_venta.negocio_id, 'anular') then
    raise exception 'ERP_SIN_PERMISO';
  end if;

  select * into v_disp from public.dispositivos where id = v_dispositivo_id and negocio_id = v_venta.negocio_id;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Locks: sesión del equipo que devuelve, luego la venta
  select * into v_sesion from public.caja_sesiones
  where id = v_caja_id and negocio_id = v_venta.negocio_id and dispositivo_id = v_dispositivo_id and cerrada_en is null
  for update;
  if not found then
    raise exception 'ERP_CAJA_CERRADA';
  end if;
  select * into v_venta from public.ventas where id = v_venta_id for update;
  select * into v_dev from public.devoluciones where id = v_id;
  if found then
    return public.resolver_devolucion_existente(v_dev, v_venta.negocio_id, v_huella);
  end if;
  if v_venta.estado <> 'completada' then
    raise exception 'ERP_VENTA_ANULADA';
  end if;

  for v_e in select e from jsonb_array_elements(v_items) e loop
    v_item_id := (v_e ->> 'venta_item_id')::uuid;
    if v_item_id = any (v_item_ids) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_item_ids := v_item_ids || v_item_id;
    select * into v_item from public.venta_items where id = v_item_id and venta_id = v_venta_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    select * into v_producto from public.productos where id = v_item.producto_id;
    v_cant := (v_e ->> 'cantidad')::numeric;
    if v_cant <= 0 or ((v_producto.unidad = 'unidad' or v_item.serie_id is not null) and v_cant <> trunc(v_cant)) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    select coalesce(sum(cantidad), 0), coalesce(sum(monto), 0) into v_devuelta, v_monto_prev
    from public.devolucion_items where venta_item_id = v_item_id;
    if v_cant > v_item.cantidad - v_devuelta then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
    v_neto := v_item.total_linea - v_item.descuento_venta;
    v_monto := round(v_neto * (v_devuelta + v_cant) / v_item.cantidad, 2) - v_monto_prev;
    v_total := v_total + v_monto;
    if v_producto.tipo <> 'servicio' then
      v_stock_ids := v_stock_ids || v_item.producto_id;
    end if;
    v_lineas := v_lineas || jsonb_build_object('venta_item_id', v_item_id, 'cantidad', v_cant, 'monto', v_monto);
  end loop;

  select coalesce(sum(monto) filter (where medio = 'efectivo'), 0), coalesce(sum(monto) filter (where medio = 'qr' and verificacion <> 'rechazado'), 0)
  into v_rest_ef, v_rest_qr from public.venta_pagos where venta_id = v_venta_id;
  v_rest_ef := v_rest_ef - (select coalesce(sum(monto_efectivo), 0) from public.devoluciones where venta_id = v_venta_id);
  v_rest_qr := v_rest_qr - (select coalesce(sum(monto - monto_efectivo), 0) from public.devoluciones
                            where venta_id = v_venta_id);
  -- Un QR rechazado nunca entró (efectivo_esperado y total_qr_sesion no lo cuentan): no se devuelve a ese pago.
  v_rest_qr := greatest(v_rest_qr, 0);
  if v_total > v_rest_ef + v_rest_qr then
    if exists (select 1 from public.venta_pagos where venta_id = v_venta_id and medio = 'qr' and verificacion = 'rechazado') then
      raise exception 'ERP_QR_RECHAZADO';
    end if;
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  v_ef := case v_medio when 'efectivo' then least(v_total, v_rest_ef) else v_total - least(v_total, v_rest_qr) end;
  if v_ef > public.efectivo_esperado(v_sesion.id) then
    raise exception 'ERP_EFECTIVO_INSUFICIENTE';
  end if;

  insert into public.devoluciones (id, negocio_id, venta_id, dispositivo_id, usuario_id, motivo, monto, monto_efectivo,
    caja_sesion_id, huella)
  values (v_id, v_venta.negocio_id, v_venta_id, v_dispositivo_id, v_uid, v_motivo, v_total, v_ef, v_caja_id, v_huella)
  on conflict (id) do nothing;
  if not found then
    select * into v_dev from public.devoluciones where id = v_id;
    return public.resolver_devolucion_existente(v_dev, v_venta.negocio_id, v_huella);
  end if;

  perform public.bloquear_stock(v_venta.negocio_id, v_disp.ubicacion_id, v_stock_ids);

  insert into public.devolucion_items (negocio_id, devolucion_id, venta_item_id, cantidad, monto)
  select v_venta.negocio_id, v_id, (e ->> 'venta_item_id')::uuid, (e ->> 'cantidad')::numeric, (e ->> 'monto')::numeric
  from jsonb_array_elements(v_lineas) e;

  -- Entra al stock de la ubicación del equipo que devuelve, con el costo de la venta
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario,
    ref_tipo, ref_id, usuario_id, motivo)
  select v_venta.negocio_id, v_disp.ubicacion_id, vi.producto_id, 'devolucion_cliente', sum(di.cantidad),
    max(vi.costo_unitario), 'devolucion', v_id, v_uid, v_motivo
  from public.devolucion_items di join public.venta_items vi on vi.id = di.venta_item_id
  where di.devolucion_id = v_id and vi.producto_id = any (v_stock_ids)
  group by vi.producto_id
  order by vi.producto_id;

  update public.series set estado = 'disponible', ubicacion_id = v_disp.ubicacion_id
  where id in (select vi.serie_id from public.devolucion_items di join public.venta_items vi on vi.id = di.venta_item_id
               where di.devolucion_id = v_id and vi.serie_id is not null);

  return jsonb_build_object('id', v_id, 'venta_id', v_venta_id, 'monto', v_total, 'monto_efectivo', v_ef);
exception
  when numeric_value_out_of_range or invalid_text_representation or check_violation or foreign_key_violation then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;


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
    'cantidad_movimientos', (select count(*) from public.caja_movimientos m where m.sesion_id = s.id)
  ) into v_res
  from public.caja_sesiones s where s.id = p_sesion_id;
  -- M4: sin `ver_reportes` van en null todos los términos del esperado (queda monto_inicial, que escribió el cajero).
  -- Residual aceptado: por RLS todo miembro sigue leyendo las filas de ventas, movimientos y devoluciones (el POS las usa).
  if not v_rev then
    v_res := v_res || jsonb_build_object('ventas_efectivo', null, 'ingresos', null, 'gastos', null, 'retiros', null,
      'devoluciones_efectivo', null, 'esperado', null, 'qr_neto', null,
      'anticipos_efectivo', null, 'anticipos_qr', null, 'devoluciones_reserva_efectivo', null, 'devoluciones_reserva_qr', null,
      'cuotas_efectivo', null, 'cuotas_qr', null);
  end if;
  return v_res;
end;
$$;

-- reporte_caja (20261102140000), misma firma: más reservas_efectivo (anticipos menos devoluciones de reserva en efectivo)

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
           (x ->> 'esperado')::numeric as esperado,
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
