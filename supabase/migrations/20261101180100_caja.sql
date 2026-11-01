-- Caja (RF-CAJ-01 a RF-CAJ-04). Sesión por equipo (dispositivo); los ids los genera el cliente (reenvío idempotente).
-- Errores: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_OPERACION_REPETIDA, ERP_CAJA_ABIERTA, ERP_CAJA_CERRADA,
-- ERP_EFECTIVO_INSUFICIENTE (gasto o retiro mayor al efectivo esperado de la sesión).
-- Idempotencia: el id es la clave primaria. Repetir con los mismos datos devuelve lo original; con otros datos en el
-- mismo negocio, ERP_OPERACION_REPETIDA. caja_sesiones solo cambia por cerrar_caja; caja_movimientos es append-only.
-- Si el id no existe o es de otro negocio, se responde ERP_SIN_PERMISO (no confirma que exista).

-- Destino de la FK compuesta de caja_sesiones.
alter table public.dispositivos add constraint dispositivos_negocio_id_uq unique (negocio_id, id);

create table public.caja_sesiones (
  id uuid primary key,
  negocio_id uuid not null references public.negocios (id),
  dispositivo_id uuid not null,
  usuario_apertura uuid not null references public.perfiles (id),
  abierta_en timestamptz not null default now(),
  monto_inicial numeric(12,2) not null check (monto_inicial >= 0),
  cerrada_en timestamptz,
  usuario_cierre uuid references public.perfiles (id),
  monto_contado numeric(12,2) check (monto_contado >= 0),
  monto_esperado numeric(12,2),
  diferencia numeric(12,2),
  foreign key (negocio_id, dispositivo_id) references public.dispositivos (negocio_id, id),
  unique (negocio_id, id),
  constraint caja_cierre_completo_ck check (
    (cerrada_en is null and usuario_cierre is null and monto_contado is null and monto_esperado is null and diferencia is null)
    or (cerrada_en is not null and usuario_cierre is not null and monto_contado is not null
        and monto_esperado is not null and diferencia is not null)
  )
);
-- Una sesión abierta por equipo.
create unique index caja_una_abierta_uq on public.caja_sesiones (dispositivo_id) where cerrada_en is null;
create index caja_sesiones_negocio_idx on public.caja_sesiones (negocio_id, abierta_en desc);

create table public.caja_movimientos (
  id uuid primary key,
  negocio_id uuid not null references public.negocios (id),
  sesion_id uuid not null,
  tipo text not null check (tipo in ('ingreso', 'gasto', 'retiro')),
  monto numeric(12,2) not null check (monto > 0),
  motivo text not null check (btrim(motivo) <> ''),
  usuario_id uuid not null references public.perfiles (id),
  created_at timestamptz not null default now(),
  foreign key (negocio_id, sesion_id) references public.caja_sesiones (negocio_id, id)
);
create index caja_movimientos_sesion_idx on public.caja_movimientos (sesion_id, created_at);
-- Reportes por negocio y fecha.
create index caja_movimientos_negocio_idx on public.caja_movimientos (negocio_id, created_at);

create trigger caja_movimientos_solo_agregar
  before update or delete on public.caja_movimientos
  for each row execute function public.rechazar_modificacion();
create trigger caja_movimientos_sin_truncate
  before truncate on public.caja_movimientos
  for each statement execute function public.rechazar_modificacion();

-- La sesión no se borra y, una vez cerrada, no cambia. Abierta solo cambia al cerrarse (cerrar_caja).
create function public.caja_sesion_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.cerrada_en is not null
     or (new.id, new.negocio_id, new.dispositivo_id, new.usuario_apertura, new.abierta_en, new.monto_inicial)
        is distinct from (old.id, old.negocio_id, old.dispositivo_id, old.usuario_apertura, old.abierta_en, old.monto_inicial) then
    raise exception 'ERP_SOLO_AGREGAR';
  end if;
  return new;
end;
$$;
revoke all on function public.caja_sesion_inmutable() from public, anon, authenticated;

create trigger caja_sesiones_inmutable
  before update or delete on public.caja_sesiones
  for each row execute function public.caja_sesion_inmutable();
create trigger caja_sesiones_sin_truncate
  before truncate on public.caja_sesiones
  for each statement execute function public.rechazar_modificacion();

alter table public.caja_sesiones enable row level security;
alter table public.caja_movimientos enable row level security;
create policy caja_sesiones_select on public.caja_sesiones
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
create policy caja_movimientos_select on public.caja_movimientos
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
revoke all on public.caja_sesiones from anon, authenticated, public;
revoke all on public.caja_movimientos from anon, authenticated, public;
grant select on public.caja_sesiones to authenticated;
grant select on public.caja_movimientos to authenticated;

-- Privado (sin grant). Efectivo que debería haber en caja. PR 2 la reemplaza sumando ventas y devoluciones en efectivo.
create function public.efectivo_esperado(p_sesion_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select s.monto_inicial + coalesce((
    select sum(case m.tipo when 'ingreso' then m.monto else -m.monto end)
    from public.caja_movimientos m where m.sesion_id = s.id
  ), 0)
  from public.caja_sesiones s where s.id = p_sesion_id
$$;

create function public.abrir_caja(p_id uuid, p_negocio_id uuid, p_dispositivo_id uuid, p_monto_inicial numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.caja_sesiones;
begin
  if not public.tiene_permiso(p_negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_id is null or p_monto_inicial is null or p_monto_inicial = 'NaN' or p_monto_inicial < 0
     or p_monto_inicial <> round(p_monto_inicial, 2) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- Bloquea el equipo: dos aperturas simultáneas se serializan y la segunda ve la primera.
  -- no key update: no frena los chequeos de FK que apuntan al equipo.
  perform 1 from public.dispositivos where id = p_dispositivo_id and negocio_id = p_negocio_id for no key update;
  if not found then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Repetir con el id de una sesión ya cerrada devuelve ese id aunque hoy haya otra abierta;
  -- el cliente confirma con caja_sesion_abierta.
  select * into v_sesion from public.caja_sesiones where id = p_id;
  if not found then
    if exists (select 1 from public.caja_sesiones where dispositivo_id = p_dispositivo_id and cerrada_en is null) then
      raise exception 'ERP_CAJA_ABIERTA';
    end if;
    -- El mismo id en otro equipo en paralelo: no inserta y relee la fila ganadora (que cae en REPETIDA).
    insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial)
    values (p_id, p_negocio_id, p_dispositivo_id, (select auth.uid()), p_monto_inicial)
    on conflict (id) do nothing;
    select * into v_sesion from public.caja_sesiones where id = p_id;
  end if;
  if v_sesion.negocio_id <> p_negocio_id then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_sesion.dispositivo_id <> p_dispositivo_id or v_sesion.monto_inicial <> p_monto_inicial then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return p_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

create function public.registrar_movimiento_caja(p_id uuid, p_sesion_id uuid, p_tipo text, p_monto numeric, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.caja_sesiones;
  v_mov public.caja_movimientos;
begin
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id;
  if not found or not public.tiene_permiso(v_sesion.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_id is null or p_tipo is null or p_tipo not in ('ingreso', 'gasto', 'retiro')
     or p_monto is null or p_monto = 'NaN' or p_monto <= 0 or p_monto <> round(p_monto, 2)
     or p_motivo is null or btrim(p_motivo) = '' or length(btrim(p_motivo)) > 200 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- for update: serializa movimientos y cierre de la sesión (un equipo, un cajero); dos retiros no pasan ambos el chequeo de efectivo.
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;

  select * into v_mov from public.caja_movimientos where id = p_id;
  if not found then
    if v_sesion.cerrada_en is not null then
      raise exception 'ERP_CAJA_CERRADA';
    end if;
    if p_tipo in ('gasto', 'retiro') and p_monto > public.efectivo_esperado(p_sesion_id) then
      raise exception 'ERP_EFECTIVO_INSUFICIENTE';
    end if;
    -- Dos llamadas simultáneas con el mismo id: la segunda espera, no inserta y relee la fila de la primera.
    insert into public.caja_movimientos (id, negocio_id, sesion_id, tipo, monto, motivo, usuario_id)
    values (p_id, v_sesion.negocio_id, p_sesion_id, p_tipo, p_monto, btrim(p_motivo), (select auth.uid()))
    on conflict (id) do nothing;
    select * into v_mov from public.caja_movimientos where id = p_id;
  end if;
  if v_mov.negocio_id <> v_sesion.negocio_id then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if v_mov.sesion_id <> p_sesion_id or v_mov.tipo <> p_tipo or v_mov.monto <> p_monto
     or v_mov.motivo <> btrim(p_motivo) then
    raise exception 'ERP_OPERACION_REPETIDA';
  end if;
  return p_id;
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- Devuelve {monto_esperado, diferencia}; diferencia = contado - esperado (negativa = faltante).
-- clock_timestamp: el cierre espera el lock de movimientos y now() sería anterior a ellos.
create function public.cerrar_caja(p_sesion_id uuid, p_monto_contado numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.caja_sesiones;
  v_esperado numeric;
begin
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id;
  if not found or not public.tiene_permiso(v_sesion.negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_monto_contado is null or p_monto_contado = 'NaN' or p_monto_contado < 0
     or p_monto_contado <> round(p_monto_contado, 2) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select * into v_sesion from public.caja_sesiones where id = p_sesion_id for update;
  if v_sesion.cerrada_en is not null then
    -- Reenvío idempotente: mismo contado devuelve el resultado guardado.
    if v_sesion.monto_contado = p_monto_contado then
      return jsonb_build_object('monto_esperado', v_sesion.monto_esperado, 'diferencia', v_sesion.diferencia);
    end if;
    raise exception 'ERP_CAJA_CERRADA';
  end if;

  v_esperado := public.efectivo_esperado(p_sesion_id);
  update public.caja_sesiones
  set cerrada_en = clock_timestamp(), usuario_cierre = (select auth.uid()), monto_contado = p_monto_contado,
      monto_esperado = v_esperado, diferencia = p_monto_contado - v_esperado
  where id = p_sesion_id;
  return jsonb_build_object('monto_esperado', v_esperado, 'diferencia', p_monto_contado - v_esperado);
exception
  when numeric_value_out_of_range then
    raise exception 'ERP_DATOS_INVALIDOS';
end;
$$;

-- La sesión abierta del equipo, o ninguna fila. Exige el permiso 'caja' en el negocio del equipo.
create function public.caja_sesion_abierta(p_dispositivo_id uuid)
returns setof public.caja_sesiones
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
begin
  select negocio_id into v_negocio_id from public.dispositivos where id = p_dispositivo_id;
  if v_negocio_id is null or not public.tiene_permiso(v_negocio_id, 'caja') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  return query select * from public.caja_sesiones where dispositivo_id = p_dispositivo_id and cerrada_en is null;
end;
$$;

revoke all on function public.efectivo_esperado(uuid) from public, anon, authenticated;
revoke all on function public.abrir_caja(uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.registrar_movimiento_caja(uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.cerrar_caja(uuid, numeric) from public, anon, authenticated;
revoke all on function public.caja_sesion_abierta(uuid) from public, anon, authenticated;
grant execute on function public.abrir_caja(uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.registrar_movimiento_caja(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.cerrar_caja(uuid, numeric) to authenticated;
grant execute on function public.caja_sesion_abierta(uuid) to authenticated;
