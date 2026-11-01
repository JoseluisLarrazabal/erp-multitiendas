-- RPC guardar_cliente: permisos, validación, documento normalizado y único, otro negocio, lectura por RLS.
begin;
select plan(27);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y T2 tiendas, L lavandería. d: dueño de T y L · v: vendedor de T · c: contador de T · x: dueño de T2 · e: encargado de T
select pg_temp.crear_usuario(('99999999-6000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x'), ('5', 'e')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-6000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-6000-0000-0000-000000000002', 'T2', 'tienda'),
  ('aaaaaaaa-6000-0000-0000-000000000003', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-6000-0000-0000-000000000001', 'aaaaaaaa-6000-0000-0000-000000000001', 'dueno'),
  ('99999999-6000-0000-0000-000000000001', 'aaaaaaaa-6000-0000-0000-000000000003', 'dueno'),
  ('99999999-6000-0000-0000-000000000002', 'aaaaaaaa-6000-0000-0000-000000000001', 'vendedor'),
  ('99999999-6000-0000-0000-000000000003', 'aaaaaaaa-6000-0000-0000-000000000001', 'contador'),
  ('99999999-6000-0000-0000-000000000004', 'aaaaaaaa-6000-0000-0000-000000000002', 'dueno'),
  ('99999999-6000-0000-0000-000000000005', 'aaaaaaaa-6000-0000-0000-000000000001', 'encargado');
create function pg_temp.guardar(p_negocio text, p_datos jsonb) returns uuid language sql as $$
  select public.guardar_cliente(('aaaaaaaa-6000-0000-0000-00000000000' || p_negocio)::uuid, p_datos)
$$;

-- Permisos de ejecución
select ok(has_function_privilege('authenticated', 'public.guardar_cliente(uuid, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.guardar_cliente(uuid, jsonb)', 'EXECUTE'), 'solo authenticated ejecuta');

-- Vendedor crea (vender), con documento normalizado
select pg_temp.como('99999999-6000-0000-0000-000000000002');
create temp table r (k text primary key, id uuid);
grant all on r to authenticated;
insert into r select 'a', pg_temp.guardar('1', '{"nombre": "  Ana Prueba ", "ci_nit": " 12 34-5x ", "telefono": "700"}');
select is((select ci_nit from public.clientes where id = (select id from r where k = 'a')), '1234-5X', 'documento normalizado: sin espacios, mayúsculas');
select is((select nombre from public.clientes where id = (select id from r where k = 'a')), 'Ana Prueba', 'nombre sin espacios sobrantes');
select throws_ok($$select pg_temp.guardar('1', '{"nombre": "Otra", "ci_nit": "1234-5x"}')$$, 'P0001', 'ERP_CLIENTE_DUPLICADO',
  'documento repetido (mismo valor normalizado)');
select throws_ok($$select pg_temp.guardar('1', '{"nombre": "Otra", "ci_nit": "1 2 3 4-5 X"}')$$, 'P0001', 'ERP_CLIENTE_DUPLICADO',
  'documento repetido con otros espacios');
select lives_ok($$select pg_temp.guardar('1', '{"nombre": "Sin documento 1"}')$$, 'sin documento (null) permitido');
select lives_ok($$select pg_temp.guardar('1', '{"nombre": "Sin documento 2", "ci_nit": "  "}')$$, 'varios sin documento no chocan');
-- Vendedor no edita
select throws_ok(format($$select pg_temp.guardar('1', '{"id": "%s", "nombre": "Cambiado"}')$$, (select id from r where k = 'a')),
  'P0001', 'ERP_SIN_PERMISO', 'vender no edita');
-- Contador no crea
select pg_temp.como('99999999-6000-0000-0000-000000000003');
select throws_ok($$select pg_temp.guardar('1', '{"nombre": "X"}')$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no crea');
-- Dueño edita y reemplaza los campos
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select lives_ok(format($$select pg_temp.guardar('1', '{"id": "%s", "nombre": "Ana Editada", "ci_nit": "999"}')$$, (select id from r where k = 'a')),
  'editar_productos edita');
select is((select nombre || '/' || ci_nit || '/' || coalesce(telefono, 'nulo') from public.clientes where id = (select id from r where k = 'a')),
  'Ana Editada/999/nulo', 'edición reemplaza los cuatro campos');
select lives_ok(format($$select pg_temp.guardar('1', '{"id": "%s", "nombre": "Ana Editada", "ci_nit": "999"}')$$, (select id from r where k = 'a')),
  'editar con su propio documento no choca');
insert into r select 'b', pg_temp.guardar('1', '{"nombre": "Beto Prueba", "ci_nit": "B1"}');
select throws_ok(format($$select pg_temp.guardar('1', '{"id": "%s", "nombre": "Beto", "ci_nit": " 999 "}')$$, (select id from r where k = 'b')),
  'P0001', 'ERP_CLIENTE_DUPLICADO', 'editar a un documento ya usado');
select throws_ok($$select pg_temp.guardar('1', '{"id": "99999999-6000-0000-0000-0000000000ff", "nombre": "N"}')$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'editar un id inexistente');
-- Encargado (editar_productos) edita; id inexistente falla
select pg_temp.como('99999999-6000-0000-0000-000000000005');
select lives_ok(format($$select pg_temp.guardar('1', '{"id": "%s", "nombre": "Beto Encargado", "ci_nit": "B1"}')$$, (select id from r where k = 'b')),
  'encargado edita un cliente');
select throws_ok($$select pg_temp.guardar('1', '{"id": "99999999-6000-0000-0000-0000000000fe", "nombre": "N"}')$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'encargado: editar un id inexistente');
select pg_temp.como('99999999-6000-0000-0000-000000000001');
-- Inválidos
select throws_ok($$select pg_temp.guardar('1', '{"nombre": "  "}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'nombre vacío');
select throws_ok($$select pg_temp.guardar('1', '{"ci_nit": "5"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'sin nombre');
select throws_ok($$select pg_temp.guardar('1', '{"nombre": 5}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'nombre no texto');
select throws_ok($$select pg_temp.guardar('1', '{"nombre": "N", "otro": "x"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida');
select throws_ok($$select pg_temp.guardar('1', '[]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_datos no es objeto');
select throws_ok($$select pg_temp.guardar('1', '{"nombre": "N", "id": "no-uuid"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'id mal formado');
-- Otro negocio
select throws_ok($$select pg_temp.guardar('2', '{"nombre": "N"}')$$, 'P0001', 'ERP_SIN_PERMISO', 'sin pertenecer al negocio');
select pg_temp.como('99999999-6000-0000-0000-000000000004');
select lives_ok($$select pg_temp.guardar('2', '{"nombre": "Ana otro negocio", "ci_nit": "999"}')$$, 'mismo documento en otro negocio permitido');
select is((select count(*) from public.clientes where negocio_id = 'aaaaaaaa-6000-0000-0000-000000000001')::integer, 0, 'RLS: x no ve clientes de T');
select throws_ok(format($$select pg_temp.guardar('2', '{"id": "%s", "nombre": "Robo"}')$$, (select id from r where k = 'a')),
  'P0001', 'ERP_DATOS_INVALIDOS', 'no edita un cliente de otro negocio');
-- Escritura directa
select throws_ok($$insert into public.clientes (negocio_id, nombre) values ('aaaaaaaa-6000-0000-0000-000000000002', 'D')$$, '42501', null,
  'insert directo rechazado');

select * from finish();
rollback;
