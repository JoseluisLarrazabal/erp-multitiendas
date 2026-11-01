-- Estructura de caja: escritura directa rechazada, append-only, una sesión abierta por equipo, FK compuestas.
begin;
select plan(19);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y L negocios. d: dueño de T y L · v: vendedor de T · c: contador de T (sin caja) · x: dueño de L
select pg_temp.crear_usuario(('99999999-7000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-7000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-7000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'dueno'),
  ('99999999-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000002', 'dueno'),
  ('99999999-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000001', 'vendedor'),
  ('99999999-7000-0000-0000-000000000003', 'aaaaaaaa-7000-0000-0000-000000000001', 'contador'),
  ('99999999-7000-0000-0000-000000000004', 'aaaaaaaa-7000-0000-0000-000000000002', 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'U1', 'local'),
  ('bbbbbbbb-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000002', 'UL', 'local');
-- Equipos: D1 y D2 en T, DL en L
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  ('dddddddd-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'bbbbbbbb-7000-0000-0000-000000000001', 'D1', 'C1'),
  ('dddddddd-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000001', 'bbbbbbbb-7000-0000-0000-000000000001', 'D2', 'C2'),
  ('dddddddd-7000-0000-0000-000000000003', 'aaaaaaaa-7000-0000-0000-000000000002', 'bbbbbbbb-7000-0000-0000-000000000002', 'DL', 'L1');
-- Atajos: T, L · D1, D2, DL · usuarios d, v, c, x · sesiones S<n> y movimientos M<n> (uuid fijos)
create function pg_temp.i(n text) returns uuid language sql as $$
  select (case
    when n = 'T' then 'aaaaaaaa-7000-0000-0000-000000000001'
    when n = 'L' then 'aaaaaaaa-7000-0000-0000-000000000002'
    when n = 'D1' then 'dddddddd-7000-0000-0000-000000000001'
    when n = 'D2' then 'dddddddd-7000-0000-0000-000000000002'
    when n = 'DL' then 'dddddddd-7000-0000-0000-000000000003'
    when n = 'd' then '99999999-7000-0000-0000-000000000001'
    when n = 'v' then '99999999-7000-0000-0000-000000000002'
    when n = 'c' then '99999999-7000-0000-0000-000000000003'
    when n = 'x' then '99999999-7000-0000-0000-000000000004'
    when n like 'S%' then ('55555555-7000-0000-0000-00000000000' || substr(n, 2))
    when n like 'M%' then ('66666666-7000-0000-0000-00000000000' || substr(n, 2))
  end)::uuid
$$;

-- Sesiones y movimientos de preparación (como dueño de la base, sin pasar por la API)
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('v'), 100);
insert into public.caja_movimientos (id, negocio_id, sesion_id, tipo, monto, motivo, usuario_id) values
  (pg_temp.i('M1'), pg_temp.i('T'), pg_temp.i('S1'), 'ingreso', 10, 'm', pg_temp.i('v'));

-- RLS: lectura por negocio
select pg_temp.como(pg_temp.i('x'));
select is((select count(*) from public.caja_sesiones)::integer, 0, 'x no ve sesiones de T');
select is((select count(*) from public.caja_movimientos)::integer, 0, 'x no ve movimientos de T');
select pg_temp.como(pg_temp.i('c'));
select is((select count(*) from public.caja_sesiones)::integer, 1, 'miembro del negocio lee sesiones');
select is((select count(*) from public.caja_movimientos)::integer, 1, 'miembro del negocio lee movimientos');

-- Escritura directa rechazada (authenticated no tiene grant de escritura)
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial)
  values (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 1)$$, '42501', null, 'insert directo en caja_sesiones');
select throws_ok($$update public.caja_sesiones set monto_inicial = 1$$, '42501', null, 'update directo en caja_sesiones');
select throws_ok($$delete from public.caja_sesiones$$, '42501', null, 'delete directo en caja_sesiones');
select throws_ok($$insert into public.caja_movimientos (id, negocio_id, sesion_id, tipo, monto, motivo, usuario_id)
  values (pg_temp.i('M2'), pg_temp.i('T'), pg_temp.i('S1'), 'ingreso', 1, 'm', pg_temp.i('d'))$$, '42501', null, 'insert directo en caja_movimientos');
select throws_ok($$update public.caja_movimientos set monto = 1$$, '42501', null, 'update directo en caja_movimientos');
select throws_ok($$delete from public.caja_movimientos$$, '42501', null, 'delete directo en caja_movimientos');
select throws_ok($$insert into public.clientes (negocio_id, nombre) values (pg_temp.i('T'), 'D')$$, '42501', null, 'insert directo en clientes');
select throws_ok($$update public.clientes set nombre = 'x'$$, '42501', null, 'update directo en clientes');

-- Como dueño de la base (los triggers rigen aunque se salte el grant)
reset role;
select throws_ok($$update public.caja_movimientos set monto = 1$$, 'P0001', 'ERP_SOLO_AGREGAR', 'caja_movimientos: update rechazado');
select throws_ok($$delete from public.caja_movimientos$$, 'P0001', 'ERP_SOLO_AGREGAR', 'caja_movimientos: delete rechazado');
select throws_ok($$truncate public.caja_movimientos cascade$$, 'P0001', 'ERP_SOLO_AGREGAR', 'caja_movimientos: truncate rechazado');
select throws_ok($$delete from public.caja_sesiones$$, 'P0001', 'ERP_SOLO_AGREGAR', 'caja_sesiones: delete rechazado');
select throws_ok($$update public.caja_sesiones set monto_inicial = 5$$, 'P0001', 'ERP_SOLO_AGREGAR', 'caja_sesiones: los datos de apertura no cambian');

-- Una sesión abierta por equipo, y FK compuestas
select throws_ok($$insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial)
  values (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('v'), 1)$$, '23505', null, 'dos sesiones abiertas en el mismo equipo');
select throws_ok($$insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial)
  values (pg_temp.i('S2'), pg_temp.i('L'), pg_temp.i('D2'), pg_temp.i('x'), 1)$$, '23503', null, 'equipo de otro negocio (FK compuesta)');

select * from finish();
rollback;
