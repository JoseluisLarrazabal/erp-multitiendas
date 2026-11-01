-- RLS del catálogo: lectura por negocio, sin escritura directa, anon sin acceso, tipos_cambio append-only.
begin;
select plan(28);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y L. a: dueño de T · b: dueño de L · z: sin negocio
select pg_temp.crear_usuario(('99999999-5000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'a'), ('2', 'b'), ('3', 'z')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-5000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-5000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'dueno'),
  ('99999999-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000002', 'dueno');
insert into public.categorias (id, negocio_id, nombre) values
  ('cccccccc-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'cat T'),
  ('cccccccc-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000002', 'cat L');
insert into public.productos (id, negocio_id, codigo, nombre, tipo) values
  ('eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'P', 'prod T', 'producto'),
  ('eeeeeeee-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000002', 'S', 'serv L', 'servicio');
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  ('aaaaaaaa-5000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'contado', 10, 'BOB'),
  ('aaaaaaaa-5000-0000-0000-000000000002', 'eeeeeeee-5000-0000-0000-000000000002', 'normal', 10, 'BOB');
insert into public.tipos_cambio (id, negocio_id, valor) values
  ('dddddddd-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 6.96),
  ('dddddddd-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000002', 6.96);

-- Lectura: cada usuario ve solo su negocio (DB-03).
select pg_temp.como('99999999-5000-0000-0000-000000000001');
select results_eq($$select negocio_id::text, 'categorias' from public.categorias union all select negocio_id::text, 'productos' from public.productos union all select negocio_id::text, 'precios' from public.producto_precios union all select negocio_id::text, 'tc' from public.tipos_cambio order by 2$$,
  $$values ('aaaaaaaa-5000-0000-0000-000000000001', 'categorias'), ('aaaaaaaa-5000-0000-0000-000000000001', 'precios'), ('aaaaaaaa-5000-0000-0000-000000000001', 'productos'), ('aaaaaaaa-5000-0000-0000-000000000001', 'tc')$$,
  'lectura: el dueño de T ve una fila de T en cada tabla y ninguna de L');
select pg_temp.como('99999999-5000-0000-0000-000000000002');
select is((select count(*) from public.productos), 1::bigint, 'lectura: el dueño de L ve solo su producto');
select is((select count(*) from public.categorias where negocio_id = 'aaaaaaaa-5000-0000-0000-000000000001'), 0::bigint, 'lectura: L no ve categorías de T');
select pg_temp.como('99999999-5000-0000-0000-000000000003');
select is((select count(*) from public.categorias) + (select count(*) from public.productos) + (select count(*) from public.producto_precios) + (select count(*) from public.tipos_cambio), 0::bigint, 'lectura: sin negocio no ve nada');

-- Escritura directa rechazada, también al dueño.
select pg_temp.como('99999999-5000-0000-0000-000000000001');
select throws_ok($$insert into public.categorias (negocio_id, nombre) values ('aaaaaaaa-5000-0000-0000-000000000001', 'x')$$, '42501', null, 'escritura: insert en categorias');
select throws_ok($$update public.categorias set nombre = 'x'$$, '42501', null, 'escritura: update en categorias');
select throws_ok($$delete from public.categorias$$, '42501', null, 'escritura: delete en categorias');
select throws_ok($$insert into public.productos (negocio_id, codigo, nombre, tipo) values ('aaaaaaaa-5000-0000-0000-000000000001', 'x', 'x', 'producto')$$, '42501', null, 'escritura: insert en productos');
select throws_ok($$update public.productos set activo = false$$, '42501', null, 'escritura: update en productos');
select throws_ok($$delete from public.productos$$, '42501', null, 'escritura: delete en productos');
select throws_ok($$insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values ('aaaaaaaa-5000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'credito', 1, 'BOB')$$, '42501', null, 'escritura: insert en producto_precios');
select throws_ok($$update public.producto_precios set monto = 1$$, '42501', null, 'escritura: update en producto_precios');
select throws_ok($$delete from public.producto_precios$$, '42501', null, 'escritura: delete en producto_precios');
select throws_ok($$insert into public.tipos_cambio (negocio_id, valor) values ('aaaaaaaa-5000-0000-0000-000000000001', 7)$$, '42501', null, 'escritura: insert en tipos_cambio');
select throws_ok($$update public.tipos_cambio set valor = 1$$, '42501', null, 'escritura: update en tipos_cambio');
select throws_ok($$delete from public.tipos_cambio$$, '42501', null, 'escritura: delete en tipos_cambio');

-- anon no lee nada.
reset role;
set local role anon;
select throws_ok($$select * from public.categorias$$, '42501', null, 'anon: sin acceso a categorias');
select throws_ok($$select * from public.productos$$, '42501', null, 'anon: sin acceso a productos');
select throws_ok($$select * from public.producto_precios$$, '42501', null, 'anon: sin acceso a producto_precios');
select throws_ok($$select * from public.tipos_cambio$$, '42501', null, 'anon: sin acceso a tipos_cambio');
reset role;

-- Integridad: las FK compuestas impiden cruzar negocios aun escribiendo como dueño de la tabla.
select throws_ok($$insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values ('aaaaaaaa-5000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000002', 'contado', 1, 'BOB')$$, '23503', null, 'FK compuesta: precio de un producto de otro negocio');
select throws_ok($$update public.productos set categoria_id = 'cccccccc-5000-0000-0000-000000000002' where id = 'eeeeeeee-5000-0000-0000-000000000001'$$, '23503', null, 'FK compuesta: categoría de otro negocio');
select throws_ok($$insert into public.categorias (negocio_id, nombre) values ('aaaaaaaa-5000-0000-0000-000000000001', 'CAT t')$$, '23505', null, 'unique: categoría repetida sin importar mayúsculas');
select throws_ok($$insert into public.productos (negocio_id, codigo, nombre, tipo) values ('aaaaaaaa-5000-0000-0000-000000000001', 'P', 'x', 'producto')$$, '23505', null, 'unique: código repetido en el negocio');
select throws_ok($$insert into public.tipos_cambio (negocio_id, valor) values ('aaaaaaaa-5000-0000-0000-000000000001', 0)$$, '23514', null, 'check: tipo de cambio mayor que cero');

-- tipos_cambio es append-only, también para el dueño de la tabla.
select throws_ok($$update public.tipos_cambio set valor = 1$$, 'P0001', 'ERP_SOLO_AGREGAR', 'append-only: update rechazado');
select throws_ok($$delete from public.tipos_cambio$$, 'P0001', 'ERP_SOLO_AGREGAR', 'append-only: delete rechazado');
select throws_ok($$truncate public.tipos_cambio$$, 'P0001', 'ERP_SOLO_AGREGAR', 'append-only: truncate rechazado');

select * from finish();
rollback;
