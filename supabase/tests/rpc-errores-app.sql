-- registrar_error: negocio propio, saneo sin datos personales, tope por hora y permisos. Cubre RNF-16.
begin;
select plan(30);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8200' || n)::uuid $$;
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.i(n), n || '@test.local', jsonb_build_object('nombre', n) from (values ('d'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo) values (pg_temp.i('T'), 'T', 'tienda'), (pg_temp.i('L'), 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');

select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_error('rpc', 'P0001', 'falló algo', null, pg_temp.i('T'))$$, 'registra con negocio propio');
select lives_ok($$select public.registrar_error('js', 'X', 'otro', null, pg_temp.i('L'))$$, 'negocio ajeno no lanza');
select lives_ok($$select public.registrar_error('js', 'X', 'otro', null, pg_temp.i('Z'))$$, 'negocio inexistente no lanza');
select lives_ok($$select public.registrar_error('rpc', null, 'invalid input syntax for type uuid: "juan perez 7654321"')$$, 'mensaje con cita');
select lives_ok($$select public.registrar_error('js', 'JP', 'Unexpected token ''j'', "juan perez 7654" is not valid JSON')$$, 'mensaje de JSON.parse');
select lives_ok($$select public.registrar_error('rpc', 'SQ', 'invalid input value: ''juan perez'' no existe')$$, 'cita con comilla simple');
select lives_ok($$select public.registrar_error('rpc', 'EM', 'falla para juan@correo.com en envio')$$, 'mensaje con correo');
select lives_ok($$select public.registrar_error('rpc', 'TF', 'telefono 71 234 567 invalido')$$, 'mensaje con teléfono con espacios');
select lives_ok($$select public.registrar_error('rpc', 'DK', 'duplicate key value violates unique constraint "clientes_ci_key"')$$, 'mensaje con nombre en medio');
select lives_ok($$select public.registrar_error('js', 'CX', 'ctx grande', jsonb_build_object('x', repeat('a', 2000)))$$, 'contexto grande no lanza');
select lives_ok($$select public.registrar_error('js', 'LG', repeat('a', 1000))$$, 'mensaje largo no lanza');
select lives_ok($$select public.registrar_error('cola', null, 'fila 123456 duplicada')$$, 'mensaje con número');
select lives_ok($$select public.registrar_error('nada', null, 'origen malo')$$, 'origen inválido no lanza');
reset role;
select is((select negocio_id::text || '|' || origen from public.errores_app where usuario_id = pg_temp.i('d') and codigo = 'P0001'), pg_temp.i('T')::text || '|rpc', 'fila con su usuario, negocio y origen');
select is((select count(*) from public.errores_app where usuario_id = pg_temp.i('d') and codigo = 'X' and negocio_id is null)::integer, 2, 'negocio ajeno o inexistente queda null');
select is((select mensaje from public.errores_app where mensaje like 'invalid input syntax%'), 'invalid input syntax for type uuid: "…"', 'sin lo citado (ni juan ni 7654321)');
select is((select mensaje from public.errores_app where codigo = 'JP'), 'Unexpected token ''j'', "…"', 'JSON.parse: sin lo citado tras la coma');
select is((select mensaje from public.errores_app where codigo = 'SQ'), 'invalid input value: "…"', 'sin lo citado con comilla simple');
select is((select mensaje from public.errores_app where codigo = 'EM'), 'falla para @ en envio', 'correo enmascarado');
select is((select mensaje from public.errores_app where codigo = 'TF'), 'telefono # invalido', 'teléfono con espacios enmascarado');
select is((select mensaje from public.errores_app where codigo = 'DK'), 'duplicate key value violates unique constraint "clientes_ci_key"', 'conserva el nombre citado en medio');
select is((select contexto from public.errores_app where codigo = 'CX'), null, 'contexto de más de 1024 bytes queda null y la fila entra');
select ok((select length(mensaje) from public.errores_app where codigo = 'LG') <= 300, 'mensaje acotado a 300');
select is((select mensaje from public.errores_app where mensaje like 'fila%'), 'fila # duplicada', 'número largo enmascarado');
select is((select count(*) from public.errores_app where origen = 'nada')::integer, 0, 'origen inválido no agrega fila');

insert into public.errores_app (usuario_id, origen, mensaje)
select pg_temp.i('x'), 'js', 'm' from generate_series(1, 60);
select pg_temp.como(pg_temp.i('x'));
select lives_ok($$select public.registrar_error('js', null, 'el 61')$$, 'el 61 no lanza');
reset role;
select is((select count(*) from public.errores_app where usuario_id = pg_temp.i('x'))::integer, 60, 'el 61 no agrega fila');

set local role anon;
select throws_ok($$select public.registrar_error('js', null, 'x')$$, '42501', null, 'anon no ejecuta');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select * from public.errores_app$$, '42501', null, 'authenticated no lee');
select throws_ok($$insert into public.errores_app (usuario_id, origen, mensaje) values (pg_temp.i('d'), 'js', 'x')$$, '42501', null, 'authenticated no inserta');
select * from finish();
rollback;
