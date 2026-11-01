-- RPC de caja: abrir_caja, registrar_movimiento_caja, cerrar_caja, caja_sesion_abierta.
-- Permisos, otro negocio, inválidos, idempotencia y reintento con datos distintos, esperado y DB-20.
begin;
select plan(65);
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
create function pg_temp.abrir(p_s text, p_neg text, p_disp text, p_monto numeric) returns uuid language sql as $$
  select public.abrir_caja(pg_temp.i(p_s), pg_temp.i(p_neg), pg_temp.i(p_disp), p_monto)
$$;
create function pg_temp.mov(p_m text, p_s text, p_tipo text, p_monto numeric, p_motivo text) returns uuid language sql as $$
  select public.registrar_movimiento_caja(pg_temp.i(p_m), pg_temp.i(p_s), p_tipo, p_monto, p_motivo)
$$;

-- Permisos de ejecución
select ok(has_function_privilege('authenticated', 'public.abrir_caja(uuid, uuid, uuid, numeric)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.registrar_movimiento_caja(uuid, uuid, text, numeric, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cerrar_caja(uuid, numeric)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.caja_sesion_abierta(uuid)', 'EXECUTE'), 'authenticated ejecuta las 4 RPC');
select ok(not has_function_privilege('authenticated', 'public.efectivo_esperado(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.efectivo_esperado(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.abrir_caja(uuid, uuid, uuid, numeric)', 'EXECUTE'), 'efectivo_esperado privada, anon sin acceso');

-- abrir_caja: permisos e inválidos
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', 100)$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no abre caja');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', 100)$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no abre caja');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.abrir('S1', 'T', 'DL', 100)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'equipo de otro negocio');
select throws_ok($$select public.abrir_caja(null, pg_temp.i('T'), pg_temp.i('D1'), 100)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'id nulo');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto negativo');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto nulo');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', 'NaN')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto NaN');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', 10.005)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'más de 2 decimales');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', 10000000000)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto fuera de rango');
select is((select count(*) from public.caja_sesiones)::integer, 0, 'nada escrito tras los rechazos');

-- Camino feliz, idempotencia, reintento con datos distintos, una abierta por equipo
select is(pg_temp.abrir('S1', 'T', 'D1', 100), pg_temp.i('S1'), 'vendedor abre caja: devuelve el id');
select is((select usuario_apertura from public.caja_sesiones where id = pg_temp.i('S1')), pg_temp.i('v'), 'usuario de apertura = auth.uid()');
select is(pg_temp.abrir('S1', 'T', 'D1', 100), pg_temp.i('S1'), 'repetir con los mismos datos devuelve la sesión');
select is((select count(*) from public.caja_sesiones)::integer, 1, 'el reintento no duplica');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D1', 150)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro monto');
select throws_ok($$select pg_temp.abrir('S1', 'T', 'D2', 100)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro equipo');
select throws_ok($$select pg_temp.abrir('S2', 'T', 'D1', 100)$$, 'P0001', 'ERP_CAJA_ABIERTA', 'otra sesión en el mismo equipo');
select lives_ok($$select pg_temp.abrir('S3', 'T', 'D2', 50)$$, 'otro equipo del mismo negocio abre');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.abrir('S1', 'L', 'DL', 100)$$, 'P0001', 'ERP_SIN_PERMISO', 'id de otro negocio: no se pisa');

-- caja_sesion_abierta
select pg_temp.como(pg_temp.i('v'));
select is((select id from public.caja_sesion_abierta(pg_temp.i('D1'))), pg_temp.i('S1'), 'devuelve la sesión abierta del equipo');
select is((select count(*) from public.caja_sesion_abierta(pg_temp.i('D1')))::integer, 1, 'una sola fila');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select * from public.caja_sesion_abierta(pg_temp.i('D1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'ajeno al negocio del equipo');
select is((select count(*) from public.caja_sesion_abierta(pg_temp.i('DL')))::integer, 0, 'equipo sin sesión abierta: nada');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select * from public.caja_sesion_abierta(pg_temp.i('D1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador (sin caja) del negocio del equipo');

-- registrar_movimiento_caja
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'contador sin caja');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'sesión de otro negocio');
select throws_ok($$select pg_temp.mov('M1', 'S9', 'ingreso', 10, 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'sesión inexistente');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.mov('M1', 'S1', 'otro', 10, 'x')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo inválido');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 0, 'x')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto 0');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'gasto', -5, 'x')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto negativo');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'gasto', 5, '  ')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo vacío');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'gasto', 5.001, 'x')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'más de 2 decimales');
select is(pg_temp.mov('M1', 'S1', 'ingreso', 50, 'Cambio'), pg_temp.i('M1'), 'ingreso registrado');
select is(pg_temp.mov('M1', 'S1', 'ingreso', 50, ' Cambio '), pg_temp.i('M1'), 'repetir igual devuelve el mismo id');
select is((select count(*) from public.caja_movimientos where sesion_id = pg_temp.i('S1'))::integer, 1, 'sin duplicar');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 60, 'Cambio')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro monto');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'gasto', 50, 'Cambio')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro tipo');
select throws_ok($$select pg_temp.mov('M1', 'S3', 'ingreso', 50, 'Cambio')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otra sesión');
select throws_ok($$select pg_temp.mov('M9', 'S1', 'ingreso', 5, repeat('a', 201))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo de 201 caracteres');
-- S3 (efectivo 50): ingreso grande pasa, retiro/gasto sobre el efectivo no, retiro igual al efectivo sí
select throws_ok($$select pg_temp.mov('M8', 'S3', 'retiro', 50.01, 'Todo')$$, 'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'retiro mayor al efectivo');
select throws_ok($$select pg_temp.mov('M8', 'S3', 'gasto', 50.01, 'Todo')$$, 'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'gasto mayor al efectivo');
select lives_ok($$select pg_temp.mov('M7', 'S3', 'ingreso', 1000000, 'Ingreso grande')$$, 'ingreso grande pasa');
select lives_ok($$select pg_temp.mov('M6', 'S3', 'retiro', 1000050, 'Retiro igual al efectivo')$$, 'retiro igual al efectivo pasa');
select is(pg_temp.mov('M6', 'S3', 'retiro', 1000050, 'Retiro igual al efectivo'), pg_temp.i('M6'), 'replay de un retiro no re-chequea el efectivo (ya en 0)');
select lives_ok($$select pg_temp.mov('M2', 'S1', 'gasto', 20.25, 'Almuerzo')$$, 'gasto');
select lives_ok($$select pg_temp.mov('M3', 'S1', 'retiro', 30, 'Depósito al banco')$$, 'retiro');

-- cerrar_caja: esperado = 100 + 50 - 20.25 - 30 = 99.75
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.cerrar_caja(pg_temp.i('S1'), 99.75)$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no cierra');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.cerrar_caja(pg_temp.i('S1'), 99.75)$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no cierra');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.cerrar_caja(pg_temp.i('S1'), -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'contado negativo');
select is(public.cerrar_caja(pg_temp.i('S1'), 90), '{"monto_esperado": 99.75, "diferencia": -9.75}'::jsonb, 'esperado con ingresos, gastos y retiros; faltante');
select is((select monto_contado || '/' || monto_esperado || '/' || diferencia from public.caja_sesiones where id = pg_temp.i('S1')), '90.00/99.75/-9.75', 'guardado en la sesión');
select ok((select cerrada_en is not null and usuario_cierre = pg_temp.i('v') from public.caja_sesiones where id = pg_temp.i('S1')), 'hora y usuario de cierre');
select is(public.cerrar_caja(pg_temp.i('S1'), 90), '{"monto_esperado": 99.75, "diferencia": -9.75}'::jsonb, 'repetir con el mismo contado devuelve lo guardado');
select throws_ok($$select public.cerrar_caja(pg_temp.i('S1'), 91)$$, 'P0001', 'ERP_CAJA_CERRADA', 'repetir con otro contado');
select ok((select s.cerrada_en >= max(m.created_at) from public.caja_sesiones s join public.caja_movimientos m on m.sesion_id = s.id
  where s.id = pg_temp.i('S1') group by s.cerrada_en), 'cerrada_en no es anterior a sus movimientos');
select throws_ok($$select pg_temp.mov('M4', 'S1', 'ingreso', 5, 'tarde')$$, 'P0001', 'ERP_CAJA_CERRADA', 'movimiento en sesión cerrada');
select is(pg_temp.mov('M1', 'S1', 'ingreso', 50, 'Cambio'), pg_temp.i('M1'), 'el reintento idempotente de un movimiento sigue valiendo tras el cierre');
select is((select count(*) from public.caja_sesion_abierta(pg_temp.i('D1')))::integer, 0, 'tras cerrar, no hay sesión abierta');
select lives_ok($$select pg_temp.abrir('S4', 'T', 'D1', 10)$$, 'tras cerrar, el equipo abre otra');

-- DB-20: las sesiones de un negocio no afectan a las de otro
select pg_temp.como(pg_temp.i('x'));
select lives_ok($$select pg_temp.abrir('S5', 'L', 'DL', 500)$$, 'L abre su caja mientras T tiene sesiones');
select is(public.cerrar_caja(pg_temp.i('S5'), 500), '{"monto_esperado": 500, "diferencia": 0}'::jsonb, 'cierre de L sin efecto de T');
select is((select count(*) from public.caja_sesiones)::integer, 1, 'x solo ve las sesiones de L');
select pg_temp.como(pg_temp.i('d'));
select is((select count(*) from public.caja_sesiones where cerrada_en is null)::integer, 2, 'T conserva sus 2 sesiones abiertas (S3, S4); la de L ya cerró');

select * from finish();
rollback;
