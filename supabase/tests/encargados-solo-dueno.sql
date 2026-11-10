-- Solo el dueño gestiona a los encargados, por negocio. Caso cruzado:
-- x: dueño de T y encargado de L · y: encargado de L y vendedor de T · d: dueño de T y L · v: vendedor de T
begin;
select plan(18);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
create function pg_temp.rol_de(p_usuario uuid, p_negocio uuid) returns text language sql as $$
  select rol from public.usuario_negocio where usuario_id = p_usuario and negocio_id = p_negocio
$$;

select pg_temp.crear_usuario(('99999999-8000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'x'), ('2', 'y'), ('3', 'd'), ('4', 'v')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-8000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-8000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001', 'dueno'),
  ('99999999-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000002', 'encargado'),
  ('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000002', 'encargado'),
  ('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000001', 'vendedor'),
  ('99999999-8000-0000-0000-000000000003', 'aaaaaaaa-8000-0000-0000-000000000001', 'dueno'),
  ('99999999-8000-0000-0000-000000000003', 'aaaaaaaa-8000-0000-0000-000000000002', 'dueno'),
  ('99999999-8000-0000-0000-000000000004', 'aaaaaaaa-8000-0000-0000-000000000001', 'vendedor');

-- x en L (donde es encargado) no gestiona a y (encargado de L)
select pg_temp.como('99999999-8000-0000-0000-000000000001');
select throws_ok($$select public.asignar_usuario('aaaaaaaa-8000-0000-0000-000000000002', '99999999-8000-0000-0000-000000000002', 'empleado')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'x en L no cambia el rol de y');
select throws_ok($$select public.quitar_usuario('aaaaaaaa-8000-0000-0000-000000000002', '99999999-8000-0000-0000-000000000002')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'x en L no quita a y');
select throws_ok($$select public.asignar_usuario('aaaaaaaa-8000-0000-0000-000000000002', '99999999-8000-0000-0000-000000000004', 'encargado')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'x en L no asciende a v a encargado');
select ok(not public.puede_asignar_rol('aaaaaaaa-8000-0000-0000-000000000002', 'encargado'), 'x en L: puede_asignar_rol(encargado) falso');
select ok(not public.puede_administrar_cuenta('99999999-8000-0000-0000-000000000002'), 'x: puede_administrar_cuenta(y) falso');
select ok(not public.puede_restablecer_clave('99999999-8000-0000-0000-000000000002'), 'x: puede_restablecer_clave(y) falso');
-- x en T (donde es dueño) sí cambia el rol de y (vendedor allí)
select lives_ok($$select public.asignar_usuario('aaaaaaaa-8000-0000-0000-000000000001', '99999999-8000-0000-0000-000000000002', 'contador')$$, 'x en T sí cambia el rol de y');
select ok(public.puede_asignar_rol('aaaaaaaa-8000-0000-0000-000000000001', 'encargado'), 'x en T: puede_asignar_rol(encargado) verdadero');
reset role;
select is(pg_temp.rol_de('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000001'), 'contador', 'y quedó contador en T');
select is(pg_temp.rol_de('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000002'), 'encargado', 'y sigue encargado en L');
select is(pg_temp.rol_de('99999999-8000-0000-0000-000000000004', 'aaaaaaaa-8000-0000-0000-000000000002'), null, 'v no ascendió ni entró a L');

-- d, dueño de T y L: todo
select pg_temp.como('99999999-8000-0000-0000-000000000003');
select ok(public.puede_administrar_cuenta('99999999-8000-0000-0000-000000000002'), 'd: puede_administrar_cuenta(y) verdadero');
select ok(public.puede_restablecer_clave('99999999-8000-0000-0000-000000000002'), 'd: puede_restablecer_clave(y) verdadero');
select lives_ok($$select public.asignar_usuario('aaaaaaaa-8000-0000-0000-000000000002', '99999999-8000-0000-0000-000000000002', 'empleado')$$, 'd cambia el rol del encargado');
select lives_ok($$select public.asignar_usuario('aaaaaaaa-8000-0000-0000-000000000002', '99999999-8000-0000-0000-000000000002', 'encargado')$$, 'd asigna encargado');
select lives_ok($$select public.quitar_usuario('aaaaaaaa-8000-0000-0000-000000000002', '99999999-8000-0000-0000-000000000002')$$, 'd quita al encargado de L');
reset role;
select is(pg_temp.rol_de('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000002'), null, 'y ya no está en L');
-- Los rechazos de x en L no dejan auditoría (las filas de L son del dueño d).
select is((select count(*) from public.auditoria where usuario_id = '99999999-8000-0000-0000-000000000001' and negocio_id = 'aaaaaaaa-8000-0000-0000-000000000002'), 0::bigint, 'los rechazos de x en L no dejan auditoría');
select * from finish();
rollback;
