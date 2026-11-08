-- DB-03 (RF-TR-03): un usuario de A no lee ni escribe en B, en las 6 tablas de tenencia. Sin sesión, nada.
begin;
select plan(39);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- Dos negocios con un dueño cada uno, y un usuario sin ningún negocio.
select pg_temp.crear_usuario('11111111-0000-0000-0000-00000000000a', 'dueno_a');
select pg_temp.crear_usuario('11111111-0000-0000-0000-00000000000b', 'dueno_b');
select pg_temp.crear_usuario('11111111-0000-0000-0000-00000000000c', 'sin_negocio');
insert into public.negocios (id, nombre, tipo) values
  ('22222222-0000-0000-0000-00000000000a', 'A', 'tienda'),
  ('22222222-0000-0000-0000-00000000000b', 'B', 'lavanderia');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('33333333-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-00000000000a', 'local A', 'local'),
  ('33333333-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-00000000000b', 'local B', 'local');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('11111111-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-00000000000a', 'dueno'),
  ('11111111-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-00000000000b', 'dueno');
insert into public.dispositivos (negocio_id, ubicacion_id, nombre, prefijo) values
  ('22222222-0000-0000-0000-00000000000a', '33333333-0000-0000-0000-00000000000a', 'caja A', 'C1'),
  ('22222222-0000-0000-0000-00000000000b', '33333333-0000-0000-0000-00000000000b', 'caja B', 'C1');

-- Lectura como dueño de A: solo ve A.
select pg_temp.como('11111111-0000-0000-0000-00000000000a');
select is((select count(*) from public.negocios), 1::bigint, 'A ve solo 1 negocio');
select is((select count(*) from public.negocios where id = '22222222-0000-0000-0000-00000000000b'), 0::bigint, 'A no ve el negocio B');
select is((select count(*) from public.ubicaciones), 1::bigint, 'A ve solo su ubicación');
select is((select count(*) from public.dispositivos), 1::bigint, 'A ve solo su dispositivo');
select is((select count(*) from public.usuario_negocio), 1::bigint, 'A ve solo las asignaciones de su negocio');
select is((select count(*) from public.perfiles), 1::bigint, 'A ve solo su perfil, no el de B');
select is((select count(*) from public.rol_permisos), 100::bigint, 'cualquier autenticado lee la matriz completa');

-- Escritura: sin privilegios, tanto sobre filas propias como ajenas.
select throws_ok(format('insert into public.%I default values', t), '42501', null, 'INSERT directo denegado en ' || t)
  from unnest(array['negocios', 'ubicaciones', 'perfiles', 'usuario_negocio', 'rol_permisos', 'dispositivos']) t;
select throws_ok(format('update public.%I set %I = %I', t, c, c), '42501', null, 'UPDATE directo denegado en ' || t)
  from (values ('negocios', 'nombre'), ('ubicaciones', 'nombre'), ('perfiles', 'nombre'),
              ('usuario_negocio', 'rol'), ('rol_permisos', 'rol'), ('dispositivos', 'nombre')) v (t, c);
select throws_ok(format('delete from public.%I', t), '42501', null, 'DELETE directo denegado en ' || t)
  from unnest(array['negocios', 'ubicaciones', 'perfiles', 'usuario_negocio', 'rol_permisos', 'dispositivos']) t;

-- Sin ningún negocio: nada, salvo su propio perfil y la matriz.
select pg_temp.como('11111111-0000-0000-0000-00000000000c');
select is((select count(*) from public.negocios), 0::bigint, 'sin negocio no ve negocios');
select is((select count(*) from public.ubicaciones), 0::bigint, 'sin negocio no ve ubicaciones');
select is((select count(*) from public.dispositivos), 0::bigint, 'sin negocio no ve dispositivos');
select is((select count(*) from public.usuario_negocio), 0::bigint, 'sin negocio no ve asignaciones');
select is((select count(*) from public.perfiles), 1::bigint, 'sin negocio ve solo su propio perfil');

-- Sin sesión (anon): ni siquiera tiene SELECT.
reset role;
select set_config('role', 'anon', true);
select throws_ok(format('select * from public.%I', t), '42501', null, 'anon no lee ' || t)
  from unnest(array['negocios', 'ubicaciones', 'perfiles', 'usuario_negocio', 'rol_permisos', 'dispositivos']) t;

reset role;
-- Trigger de perfil: nombre desde el metadata, o el correo si falta; activo por defecto.
insert into auth.users (id, email) values ('11111111-0000-0000-0000-0000000000d1', 'sin.nombre@test.local');
select is((select nombre from public.perfiles where id = '11111111-0000-0000-0000-00000000000a'), 'dueno_a', 'trigger: el perfil toma el nombre del metadata');
select is((select nombre from public.perfiles where id = '11111111-0000-0000-0000-0000000000d1'), 'sin.nombre@test.local', 'trigger: sin nombre usa el correo');
select is((select activo from public.perfiles where id = '11111111-0000-0000-0000-0000000000d1'), true, 'trigger: el perfil nace activo');

select * from finish();
rollback;
