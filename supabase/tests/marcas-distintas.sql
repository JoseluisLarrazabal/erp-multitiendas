-- Vista marcas_productos: marcas sin repetir, sin nulas, y aislamiento por RLS.
begin;
select plan(5);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y L. d: dueño de T · x: dueño de L
select pg_temp.crear_usuario(('99999999-7100-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-7100-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-7100-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-7100-0000-0000-000000000001', 'aaaaaaaa-7100-0000-0000-000000000001', 'dueno'),
  ('99999999-7100-0000-0000-000000000002', 'aaaaaaaa-7100-0000-0000-000000000002', 'dueno');
insert into public.productos (negocio_id, codigo, nombre, marca, tipo) values
  ('aaaaaaaa-7100-0000-0000-000000000001', 'A1', 'a1', 'Samsung', 'producto'),
  ('aaaaaaaa-7100-0000-0000-000000000001', 'A2', 'a2', 'Samsung', 'producto'),
  ('aaaaaaaa-7100-0000-0000-000000000001', 'A3', 'a3', 'Apple', 'producto'),
  ('aaaaaaaa-7100-0000-0000-000000000001', 'A4', 'a4', null, 'producto'),
  ('aaaaaaaa-7100-0000-0000-000000000002', 'B1', 'b1', 'Ariel', 'producto');

select pg_temp.como('99999999-7100-0000-0000-000000000001');
select is((select count(*) from public.marcas_productos), 2::bigint, 'T: dos marcas, sin repetir ni nulas');
select is((select array_agg(marca order by marca) from public.marcas_productos), array['Apple', 'Samsung'], 'T: las marcas de T');
select is((select count(*) from public.marcas_productos where marca = 'Ariel'), 0::bigint, 'T no ve las marcas de L');

select pg_temp.como('99999999-7100-0000-0000-000000000002');
select is((select array_agg(marca) from public.marcas_productos), array['Ariel'], 'L solo ve lo suyo');

reset role;
select is(has_table_privilege('anon', 'public.marcas_productos', 'SELECT'), false, 'anon no lee la vista');

select * from finish();
rollback;
