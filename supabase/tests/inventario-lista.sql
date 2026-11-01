-- Vista inventario_lista: total por producto, stock bajo (igual que productos_stock_bajo), sin servicios, aislada por RLS.
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

-- T tienda con U1 y U2, L lavandería. d: dueño de T · x: dueño de L
select pg_temp.crear_usuario(('99999999-8000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-8000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-8000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001', 'dueno'),
  ('99999999-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000002', 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001', 'U1', 'local'),
  ('bbbbbbbb-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000001', 'U2', 'deposito'),
  ('bbbbbbbb-8000-0000-0000-000000000003', 'aaaaaaaa-8000-0000-0000-000000000002', 'UL', 'local');
-- A: stock repartido y bajo el mínimo · B: sin stock ni mínimo · C: inactivo bajo el mínimo · S: servicio · I: insumo de L
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, stock_minimo, activo) values
  ('eeeeeeee-8000-0000-0000-000000000001', 'aaaaaaaa-8000-0000-0000-000000000001', 'A', 'A', 'producto', 'unidad', 10, true),
  ('eeeeeeee-8000-0000-0000-000000000002', 'aaaaaaaa-8000-0000-0000-000000000001', 'B', 'B', 'producto', 'unidad', null, true),
  ('eeeeeeee-8000-0000-0000-000000000003', 'aaaaaaaa-8000-0000-0000-000000000001', 'C', 'C', 'producto', 'unidad', 10, false),
  ('eeeeeeee-8000-0000-0000-000000000004', 'aaaaaaaa-8000-0000-0000-000000000001', 'S', 'S', 'servicio', 'unidad', null, true),
  ('eeeeeeee-8000-0000-0000-000000000005', 'aaaaaaaa-8000-0000-0000-000000000002', 'I', 'I', 'insumo', 'unidad', null, true);
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo) values
  ('aaaaaaaa-8000-0000-0000-000000000001', 'bbbbbbbb-8000-0000-0000-000000000001', 'eeeeeeee-8000-0000-0000-000000000001', 'inicial', 4, 5, 'seed'),
  ('aaaaaaaa-8000-0000-0000-000000000001', 'bbbbbbbb-8000-0000-0000-000000000002', 'eeeeeeee-8000-0000-0000-000000000001', 'inicial', 3, 5, 'seed'),
  ('aaaaaaaa-8000-0000-0000-000000000002', 'bbbbbbbb-8000-0000-0000-000000000003', 'eeeeeeee-8000-0000-0000-000000000005', 'inicial', 9, 1, 'seed');

select pg_temp.como('99999999-8000-0000-0000-000000000001');
select is((select array_agg(codigo order by codigo) from public.inventario_lista), array['A', 'B', 'C'], 'sin servicios y sin productos de otro negocio');
select is((select stock_total from public.inventario_lista where codigo = 'A'), 7::numeric, 'total: suma de las ubicaciones');
select is((select stock_total from public.inventario_lista where codigo = 'B'), 0::numeric, 'total: 0 sin filas de stock, nunca null');
select is((select stock_bajo from public.inventario_lista where codigo = 'A'), true, 'bajo: total menor al mínimo');
select is((select stock_bajo from public.inventario_lista where codigo = 'B'), false, 'bajo: mínimo null no avisa');
select is((select stock_bajo from public.inventario_lista where codigo = 'C'), false, 'bajo: un producto inactivo no avisa');
select is(
  (select array_agg(codigo order by codigo) from public.inventario_lista where stock_bajo),
  (select array_agg(codigo order by codigo) from public.productos_stock_bajo('aaaaaaaa-8000-0000-0000-000000000001')),
  'misma regla que productos_stock_bajo'
);

select pg_temp.como('99999999-8000-0000-0000-000000000002');
select is((select array_agg(codigo) from public.inventario_lista), array['I'], 'el dueño de L solo ve lo suyo');

reset role;
select is(has_table_privilege('anon', 'public.inventario_lista', 'SELECT'), false, 'anon no lee la vista');

select * from finish();
rollback;
