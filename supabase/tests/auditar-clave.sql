-- auditar_clave (B-5): solo service_role; una fila por negocio de la cuenta; sin datos de la clave.
begin;
select plan(8);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- a: actor (dueño de T y L) · m: vendedor en T y empleado en L (objetivo)
select pg_temp.crear_usuario('99999999-7000-0000-0000-000000000001', 'a');
select pg_temp.crear_usuario('99999999-7000-0000-0000-000000000002', 'm');
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-7000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-7000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'dueno'),
  ('99999999-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000002', 'dueno'),
  ('99999999-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000001', 'vendedor'),
  ('99999999-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000002', 'empleado');

select pg_temp.como('99999999-7000-0000-0000-000000000001');
select throws_ok($$select public.auditar_clave('99999999-7000-0000-0000-000000000001', '99999999-7000-0000-0000-000000000002')$$, '42501', null, 'clave: authenticated no ejecuta auditar_clave');
reset role;
set local role anon;
select throws_ok($$select public.auditar_clave('99999999-7000-0000-0000-000000000001', '99999999-7000-0000-0000-000000000002')$$, '42501', null, 'clave: anon no ejecuta auditar_clave');
reset role;
set local role service_role;
select lives_ok($$select public.auditar_clave('99999999-7000-0000-0000-000000000001', '99999999-7000-0000-0000-000000000002')$$, 'clave: service_role registra el restablecimiento');
reset role;
select results_eq(
  $$select negocio_id::text, accion, antes is null and despues is null, usuario_id::text, tabla, registro_id from public.auditoria where accion = 'restablecer_clave' order by negocio_id$$,
  $$values ('aaaaaaaa-7000-0000-0000-000000000001', 'restablecer_clave', true, '99999999-7000-0000-0000-000000000001', 'perfiles', '99999999-7000-0000-0000-000000000002'),
           ('aaaaaaaa-7000-0000-0000-000000000002', 'restablecer_clave', true, '99999999-7000-0000-0000-000000000001', 'perfiles', '99999999-7000-0000-0000-000000000002')$$,
  'clave: una fila por negocio de la cuenta, con el actor recibido y sin datos');
set local role service_role;
select throws_ok($$select public.auditar_clave(null, '99999999-7000-0000-0000-000000000002')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave: actor nulo');
select throws_ok($$select public.auditar_clave('99999999-7000-0000-0000-000000000001', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave: usuario nulo');
select throws_ok($$select public.auditar_clave('99999999-7000-0000-0000-000000000001', '99999999-7000-0000-0000-0000000000ff')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave: cuenta inexistente');
reset role;
select is((select count(*) from public.auditoria where accion = 'restablecer_clave'), 2::bigint, 'clave: los rechazos no dejan filas');
select * from finish();
rollback;
