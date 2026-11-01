-- asignar_foto_producto: solo cambia foto_path; permiso editar_productos; ruta con el formato del negocio.
begin;
select plan(9);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y L. e: encargado de T · v: vendedor de T · x: dueño de L
select pg_temp.crear_usuario(('99999999-8000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'e'), ('2', 'v'), ('3', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-8000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-8000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001', 'encargado'),
  ('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000001', 'vendedor'),
  ('99999999-8000-0000-0000-000000000003', 'aaaaaaaa-8000-0000-0000-000000000002', 'dueno');
insert into public.productos (id, negocio_id, codigo, nombre, marca, tipo) values
  ('eeeeeeee-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001', 'P1', 'P1', 'Marca', 'producto');

select pg_temp.como('99999999-8000-0000-0000-000000000001');
select lives_ok($$select public.asignar_foto_producto('eeeeeeee-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.png')$$, 'asigna la foto');
select is((select foto_path from public.productos where id = 'eeeeeeee-8000-0000-0000-000000000001'),
  'aaaaaaaa-8000-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.png', 'foto_path quedó asignada');
select is((select marca from public.productos where id = 'eeeeeeee-8000-0000-0000-000000000001'), 'Marca', 'no toca los demás campos');
select throws_ok($$select public.asignar_foto_producto('eeeeeeee-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000002/11111111-2222-3333-4444-555555555555.png')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ruta de otro negocio');
select throws_ok($$select public.asignar_foto_producto('eeeeeeee-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001/a/11111111-2222-3333-4444-555555555555.gif')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ruta con subcarpeta y extensión no permitida');
select lives_ok($$select public.asignar_foto_producto('eeeeeeee-8000-0000-0000-000000000001', null)$$, 'null limpia la foto');
select is((select foto_path from public.productos where id = 'eeeeeeee-8000-0000-0000-000000000001'), null, 'foto_path quedó en null');

select pg_temp.como('99999999-8000-0000-0000-000000000002');
select throws_ok($$select public.asignar_foto_producto('eeeeeeee-8000-0000-0000-000000000001', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'el vendedor no puede');
select pg_temp.como('99999999-8000-0000-0000-000000000003');
select throws_ok($$select public.asignar_foto_producto('eeeeeeee-8000-0000-0000-000000000001', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'producto de otro negocio');

select * from finish();
rollback;
