-- abrir_caja y registrar_movimiento_caja con p_offline = {creada_en, usuario_id} (fase 3, PR 1).
-- Hora least(creada_en, now()), usuario con el negocio, sin ERP_EFECTIVO_INSUFICIENTE y la idempotencia de siempre.
begin;
select plan(62);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9200' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño y v vendedor de T · c contador de T (sin caja) · x dueño de L
select pg_temp.crear_usuario(n) from (values ('d'), ('v'), ('c'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo) values (pg_temp.i('T'), 'T', 'tienda'), (pg_temp.i('L'), 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'), (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('D3'), pg_temp.i('T'), pg_temp.i('U1'), 'D3', 'C3'), (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
-- Fechas relativas a hoy: el servidor rechaza horas de hace más de 30 días (M5).
create function pg_temp.dia(p_dias integer) returns text language sql as $$
  select to_char((now() at time zone 'utc')::date - p_dias, 'YYYY-MM-DD')
$$;
create function pg_temp.t(p_hora text, p_dias integer) returns text language sql as $$
  select pg_temp.dia(p_dias) || 'T' || p_hora
$$;
-- p_offline con el usuario y la hora dados (ISO con zona)
create function pg_temp.o(p_usuario text, p_creada text) returns jsonb language sql as $$
  select jsonb_build_object('creada_en', p_creada, 'usuario_id', pg_temp.i(p_usuario))
$$;
create function pg_temp.abrir(p_s text, p_disp text, p_monto numeric, p_off jsonb default null) returns uuid language sql as $$
  select public.abrir_caja(pg_temp.i(p_s), pg_temp.i('T'), pg_temp.i(p_disp), p_monto, p_off)
$$;
create function pg_temp.mov(p_m text, p_s text, p_tipo text, p_monto numeric, p_off jsonb default null) returns uuid language sql as $$
  select public.registrar_movimiento_caja(pg_temp.i(p_m), pg_temp.i(p_s), p_tipo, p_monto, 'motivo', p_off)
$$;

select ok(not has_function_privilege('anon', 'public.abrir_caja(uuid, uuid, uuid, numeric, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.registrar_movimiento_caja(uuid, uuid, text, numeric, text, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.abrir_caja(uuid, uuid, uuid, numeric, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.registrar_movimiento_caja(uuid, uuid, text, numeric, text, jsonb)', 'EXECUTE'), 'permisos de las firmas nuevas');
select is(to_regprocedure('public.abrir_caja(uuid, uuid, uuid, numeric)') is null
  and to_regprocedure('public.registrar_movimiento_caja(uuid, uuid, text, numeric, text)') is null, true, 'las firmas viejas ya no existen');

-- abrir_caja offline: permisos y forma
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no abre caja offline');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('x', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no abre caja offline');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('x', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'usuario_id de otro negocio');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('nadie', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'usuario_id inexistente');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', pg_temp.t('10:00:00Z', 10)) || '{"x": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', pg_temp.t('10:00:00Z', 10)) - 'usuario_id')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'sin usuario_id');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', pg_temp.t('10:00:00Z', 10)) - 'creada_en')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'sin creada_en');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', '2026-01-01 10:00:00'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'creada_en sin zona');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', 'infinity'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'creada_en infinity');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, '[]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_offline no es objeto');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, jsonb_build_object('creada_en', pg_temp.t('10:00:00Z', 10), 'usuario_id', 'no-es-uuid'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'usuario_id que no es uuid');
select is((select count(*) from public.caja_sesiones)::integer, 0, 'nada escrito tras los rechazos');

-- abrir_caja offline: camino feliz, hora y usuario de apertura
select is(pg_temp.abrir('S1', 'D1', 100, pg_temp.o('v', pg_temp.t('10:00:00Z', 10))), pg_temp.i('S1'), 'apertura offline devuelve el id');
select is((select origen || '/' || (enviada_por = pg_temp.i('d'))::text from public.caja_sesiones where id = pg_temp.i('S1')), 'offline/true', 'S1: origen offline y enviada_por = quien llamó (d), no el usuario_id');
select is((select abierta_en || '/' || (usuario_apertura = pg_temp.i('v'))::text from public.caja_sesiones where id = pg_temp.i('S1')),
  pg_temp.dia(10) || ' 10:00:00+00/true', 'abierta_en = creada_en y usuario_apertura = usuario_id (no quien envía)');
select is(pg_temp.abrir('S2', 'D2', 0, pg_temp.o('d', '2999-01-01T00:00:00Z')), pg_temp.i('S2'), 'apertura con reloj adelantado');
select is((select abierta_en = now() from public.caja_sesiones where id = pg_temp.i('S2')), true, 'creada_en futura queda en now()');
select throws_ok($$select pg_temp.abrir('S3', 'D1', 50, pg_temp.o('v', pg_temp.t('10:00:00Z', 9)))$$, 'P0001', 'ERP_CAJA_ABIERTA', 'offline: otro intento en un equipo con caja abierta');
-- Idempotencia: p_offline no entra en la comparación
select is(pg_temp.abrir('S1', 'D1', 100, pg_temp.o('d', pg_temp.t('10:00:00Z', 5))), pg_temp.i('S1'), 'reenvío offline con otra hora y usuario devuelve la sesión');
select is((select abierta_en || '/' || (usuario_apertura = pg_temp.i('v'))::text from public.caja_sesiones where id = pg_temp.i('S1')),
  pg_temp.dia(10) || ' 10:00:00+00/true', 'el reenvío no cambió hora ni usuario');
select is(pg_temp.abrir('S1', 'D1', 100), pg_temp.i('S1'), 'reenvío en línea de una apertura offline');
select throws_ok($$select pg_temp.abrir('S1', 'D1', 150, pg_temp.o('v', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro monto');
select throws_ok($$select pg_temp.abrir('S1', 'D2', 100, pg_temp.o('v', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro equipo');
select is(pg_temp.abrir('S4', 'D3', 20), pg_temp.i('S4'), 'S4: primero en línea');
select is(pg_temp.abrir('S4', 'D3', 20, pg_temp.o('v', pg_temp.t('10:00:00Z', 10))), pg_temp.i('S4'), 'S4: reenvío offline devuelve la sesión');
select is((select count(*) from public.caja_sesiones where id = pg_temp.i('S4'))::integer + (select usuario_apertura = pg_temp.i('d') and abierta_en = now() from public.caja_sesiones where id = pg_temp.i('S4'))::integer, 2, 'S4 conserva su apertura en línea');
select is((select origen || '/' || (enviada_por = pg_temp.i('d'))::text from public.caja_sesiones where id = pg_temp.i('S4')), 'online/true', 'S4: en línea guarda origen online y enviada_por');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.abrir('S1', 'D1', 100, pg_temp.o('x', pg_temp.t('10:00:00Z', 10)))$$, 'P0001', 'ERP_SIN_PERMISO', 'id de otro negocio con p_offline: no se pisa');

-- registrar_movimiento_caja offline. S1 tiene 100 de efectivo.
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, pg_temp.o('v', pg_temp.t('11:00:00Z', 10)))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador sin caja');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, pg_temp.o('x', pg_temp.t('11:00:00Z', 10)))$$, 'P0001', 'ERP_SIN_PERMISO', 'sesión de otro negocio');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, pg_temp.o('x', pg_temp.t('11:00:00Z', 10)))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'usuario_id de otro negocio');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, pg_temp.o('v', 'ayer'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'creada_en inválida');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, pg_temp.o('v', pg_temp.t('11:00:00Z', 10)) || '{"x": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 0, pg_temp.o('v', pg_temp.t('11:00:00Z', 10)))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'monto 0 sigue inválido');
select throws_ok($$select pg_temp.mov('M1', 'S1', 'ingreso', 10, jsonb_build_object('creada_en', pg_temp.t('11:00:00Z', 10), 'usuario_id', 'no-es-uuid'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'usuario_id que no es uuid');
select is((select count(*) from public.caja_movimientos)::integer, 0, 'nada escrito tras los rechazos');
select throws_ok($$select pg_temp.mov('M2', 'S1', 'gasto', 500)$$, 'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'en línea, un gasto mayor al efectivo se rechaza');
select is(pg_temp.mov('M2', 'S1', 'gasto', 500, pg_temp.o('v', pg_temp.t('12:00:00Z', 10))), pg_temp.i('M2'), 'offline, el mismo gasto se registra (el arqueo muestra la diferencia)');
select is(pg_temp.mov('M3', 'S1', 'ingreso', 50, pg_temp.o('v', pg_temp.t('11:00:00Z', 10))), pg_temp.i('M3'), 'ingreso offline');
select is((select created_at || '/' || (usuario_id = pg_temp.i('v'))::text from public.caja_movimientos where id = pg_temp.i('M3')),
  pg_temp.dia(10) || ' 11:00:00+00/true', 'created_at = creada_en y usuario_id = usuario_id');
select is(pg_temp.mov('M4', 'S1', 'ingreso', 1, pg_temp.o('d', '2999-01-01T00:00:00Z')), pg_temp.i('M4'), 'movimiento con reloj adelantado');
select is((select created_at = now() from public.caja_movimientos where id = pg_temp.i('M4')), true, 'creada_en futura queda en now()');
select is((select origen || '/' || (enviada_por = pg_temp.i('d'))::text from public.caja_movimientos where id = pg_temp.i('M3')), 'offline/true', 'M3: origen offline y enviada_por = quien llamó');
-- Sesión S2 (abierta ahora): un movimiento en línea y uno offline con hora anterior a la apertura
select is(pg_temp.mov('M6', 'S2', 'ingreso', 3), pg_temp.i('M6'), 'movimiento en línea');
select is((select origen || '/' || (enviada_por = pg_temp.i('d'))::text || '/' || (created_at = now())::text from public.caja_movimientos where id = pg_temp.i('M6')), 'online/true/true', 'M6: en línea guarda origen online y enviada_por');
select is(pg_temp.mov('M7', 'S2', 'ingreso', 2, pg_temp.o('v', pg_temp.t('00:00:00Z', 29))), pg_temp.i('M7'), 'movimiento offline con hora anterior a la apertura');
select is((select m.created_at = s.abierta_en from public.caja_movimientos m join public.caja_sesiones s on s.id = m.sesion_id where m.id = pg_temp.i('M7')), true, 'M7: nunca antes de la apertura (queda en abierta_en)');
select is((select m.created_at = s.abierta_en from public.caja_movimientos m join public.caja_sesiones s on s.id = m.sesion_id where m.id = pg_temp.i('M3')), false, 'M3: con hora posterior a la apertura conserva la suya');
-- Idempotencia
select is(pg_temp.mov('M3', 'S1', 'ingreso', 50, pg_temp.o('d', pg_temp.t('00:00:00Z', 4))), pg_temp.i('M3'), 'reenvío offline con otra hora y usuario devuelve el original');
select is(pg_temp.mov('M3', 'S1', 'ingreso', 50), pg_temp.i('M3'), 'reenvío en línea de un movimiento offline');
select is((select count(*) from public.caja_movimientos where id = pg_temp.i('M3'))::integer, 1, 'un solo movimiento');
select is((select created_at from public.caja_movimientos where id = pg_temp.i('M3')), (pg_temp.dia(10) || ' 11:00:00+00')::timestamptz, 'el reenvío no cambió la hora');
select throws_ok($$select pg_temp.mov('M3', 'S1', 'ingreso', 60, pg_temp.o('v', pg_temp.t('11:00:00Z', 10)))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro monto');
select throws_ok($$select pg_temp.mov('M3', 'S2', 'ingreso', 50, pg_temp.o('v', pg_temp.t('11:00:00Z', 10)))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otra sesión');

-- El origen y quién envió no se tocan en una sesión abierta
reset role;
select throws_ok($$update public.caja_sesiones set origen = 'online' where id = pg_temp.i('S1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'origen inmutable');
select throws_ok($$update public.caja_sesiones set enviada_por = null where id = pg_temp.i('S1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'enviada_por inmutable');
select pg_temp.como(pg_temp.i('d'));

-- cerrar_caja y resumen_caja no dependen de las horas: 100 - 500 + 50 + 1 = -349
select is(public.cerrar_caja(pg_temp.i('S1'), 0), '{"monto_esperado": -349, "diferencia": 349, "total_qr": 0}'::jsonb, 'el esperado suma por sesión, con horas atrasadas');
select is((select (public.resumen_caja(pg_temp.i('S1')) ->> 'esperado')::numeric), -349::numeric, 'resumen_caja igual');
select is(pg_temp.mov('M5', 'S1', 'ingreso', 5, pg_temp.o('v', pg_temp.t('11:00:00Z', 10))), pg_temp.i('M5'), 'A2: movimiento offline hecho antes del cierre se acepta en la sesión cerrada');
select is(pg_temp.mov('M3', 'S1', 'ingreso', 50, pg_temp.o('v', pg_temp.t('11:00:00Z', 10))), pg_temp.i('M3'), 'el reenvío idempotente sigue valiendo tras el cierre');

select * from finish();
rollback;
