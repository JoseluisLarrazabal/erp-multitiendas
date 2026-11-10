-- puede_asignar_rol: permiso `usuarios`, rol existente para el tipo de negocio y `dueno` solo por un dueño.
begin;
select plan(9);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- L lavandería: d dueño, enc encargado, v empleado (sin `usuarios`).
select pg_temp.crear_usuario(('99999999-3000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'enc'), ('3', 'emp')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values ('aaaaaaaa-3000-0000-0000-000000000001', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'dueno'),
  ('99999999-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'encargado'),
  ('99999999-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'empleado');

select pg_temp.como('99999999-3000-0000-0000-000000000002');
select ok(public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'empleado'), '1: con permiso y rol válido');
select pg_temp.como('99999999-3000-0000-0000-000000000003');
select ok(not public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'empleado'), '2: sin permiso usuarios');
select pg_temp.como('99999999-3000-0000-0000-000000000002');
select ok(not public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'rol_inexistente'), '3: rol que no existe para el tipo');
select ok(not public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'dueno'), '4: encargado no asigna dueno');
select ok(not public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'encargado'), '4b: encargado no asigna encargado');
select pg_temp.como('99999999-3000-0000-0000-000000000001');
select ok(public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'encargado'), 'dueño sí asigna encargado');
select ok(public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', 'dueno'), 'dueño sí asigna dueno');
select ok(not public.puede_asignar_rol('aaaaaaaa-3000-0000-0000-000000000001', null), 'rol nulo: falso, no null');
reset role;
select ok(
  has_function_privilege('authenticated', 'public.puede_asignar_rol(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.puede_asignar_rol(uuid, text)', 'EXECUTE'),
  'solo authenticated la ejecuta'
);
select * from finish();
rollback;
