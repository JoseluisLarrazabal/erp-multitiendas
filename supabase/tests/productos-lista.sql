-- Vista productos_lista: estado de precio resuelto en base (filtro "sin precio" paginable) y aislamiento por RLS.
begin;
select plan(8);
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
select pg_temp.crear_usuario(('99999999-7000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-7000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-7000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'dueno'),
  ('99999999-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000002', 'dueno');
insert into public.categorias (id, negocio_id, nombre) values
  ('cccccccc-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'Cat T');
insert into public.productos (id, negocio_id, codigo, nombre, categoria_id, tipo) values
  ('eeeeeeee-7000-0000-0000-000000000001', 'aaaaaaaa-7000-0000-0000-000000000001', 'BOB', 'en bolivianos', 'cccccccc-7000-0000-0000-000000000001', 'producto'),
  ('eeeeeeee-7000-0000-0000-000000000002', 'aaaaaaaa-7000-0000-0000-000000000001', 'USD', 'en dólares', null, 'producto'),
  ('eeeeeeee-7000-0000-0000-000000000003', 'aaaaaaaa-7000-0000-0000-000000000001', 'SIN', 'sin precio', null, 'producto'),
  ('eeeeeeee-7000-0000-0000-000000000004', 'aaaaaaaa-7000-0000-0000-000000000002', 'SRV', 'servicio', null, 'servicio');
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  ('aaaaaaaa-7000-0000-0000-000000000001', 'eeeeeeee-7000-0000-0000-000000000001', 'contado', 25.5, 'BOB'),
  ('aaaaaaaa-7000-0000-0000-000000000001', 'eeeeeeee-7000-0000-0000-000000000001', 'credito', 30, 'BOB'),
  ('aaaaaaaa-7000-0000-0000-000000000001', 'eeeeeeee-7000-0000-0000-000000000002', 'mayorista', 90, 'USD'),
  ('aaaaaaaa-7000-0000-0000-000000000002', 'eeeeeeee-7000-0000-0000-000000000004', 'normal', 12, 'BOB');
insert into public.tipos_cambio (negocio_id, valor) values ('aaaaaaaa-7000-0000-0000-000000000001', 7);

select pg_temp.como('99999999-7000-0000-0000-000000000001');
select is((select count(*) from public.productos_lista), 3::bigint, 'el dueño de T ve 3 productos y ninguno de L');
select is((select array_agg(codigo order by codigo) from public.productos_lista where not con_precio), array['SIN'], 'sin precio: solo el que no tiene lista');
select is((select count(*) from public.productos_lista where con_precio), 2::bigint, 'con_precio: un precio en cualquier lista cuenta');
select is((select principal_bs from public.productos_lista where codigo = 'BOB'), 25.50::numeric, 'principal_bs: contado en bolivianos');
select is((select principal_bs from public.productos_lista where codigo = 'USD'), null, 'principal_bs: null si no hay lista contado, nunca 0');
select is((select categoria_nombre from public.productos_lista where codigo = 'BOB'), 'Cat T', 'trae el nombre de la categoría');

select pg_temp.como('99999999-7000-0000-0000-000000000002');
select is((select principal_bs from public.productos_lista), 12.00::numeric, 'lavandería: la lista principal es normal, y solo ve lo suyo');

reset role;
select is(has_table_privilege('anon', 'public.productos_lista', 'SELECT'), false, 'anon no lee la vista');

select * from finish();
rollback;
