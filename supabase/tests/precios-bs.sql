-- Vista producto_precios_bs y precio_bs: DB-07 (tipo de cambio nuevo), DB-09 (redondeo P-08) y aislamiento por RLS.
begin;
select plan(17);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y L: tienda y lavandería. d: dueño de T · x: dueño de L
select pg_temp.crear_usuario(('99999999-4000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-4000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-4000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-4000-0000-0000-000000000001', 'aaaaaaaa-4000-0000-0000-000000000001', 'dueno'),
  ('99999999-4000-0000-0000-000000000002', 'aaaaaaaa-4000-0000-0000-000000000002', 'dueno');
insert into public.productos (id, negocio_id, codigo, nombre, tipo) values
  ('eeeeeeee-4000-0000-0000-000000000001', 'aaaaaaaa-4000-0000-0000-000000000001', 'BOB', 'en bolivianos', 'producto'),
  ('eeeeeeee-4000-0000-0000-000000000002', 'aaaaaaaa-4000-0000-0000-000000000001', 'USD', 'en dólares', 'producto'),
  ('eeeeeeee-4000-0000-0000-000000000003', 'aaaaaaaa-4000-0000-0000-000000000001', 'SIN', 'sin precio', 'producto'),
  ('eeeeeeee-4000-0000-0000-000000000004', 'aaaaaaaa-4000-0000-0000-000000000002', 'SRV', 'servicio', 'servicio');
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  ('aaaaaaaa-4000-0000-0000-000000000001', 'eeeeeeee-4000-0000-0000-000000000001', 'contado', 25.5, 'BOB'),
  ('aaaaaaaa-4000-0000-0000-000000000001', 'eeeeeeee-4000-0000-0000-000000000002', 'contado', 100, 'USD'),
  ('aaaaaaaa-4000-0000-0000-000000000001', 'eeeeeeee-4000-0000-0000-000000000002', 'credito', 1, 'USD'),
  ('aaaaaaaa-4000-0000-0000-000000000002', 'eeeeeeee-4000-0000-0000-000000000004', 'normal', 15, 'BOB');
-- L tiene un tipo de cambio absurdo: no debe filtrarse al precio de T.
insert into public.tipos_cambio (negocio_id, valor) values ('aaaaaaaa-4000-0000-0000-000000000002', 100);

select pg_temp.como('99999999-4000-0000-0000-000000000001');
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000002', 'contado'), null, 'precio_bs: USD sin tipo de cambio es null, no 0');
select is((select tipo_cambio from public.producto_precios_bs where producto_id = 'eeeeeeee-4000-0000-0000-000000000002' and lista = 'contado'), null, 'vista: sin tipo de cambio en el negocio, tipo_cambio null');
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000001', 'contado'), 25.50::numeric, 'precio_bs: BOB es el monto, sin tipo de cambio');
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000003', 'contado'), null, 'precio_bs: producto sin precio es null');
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000001', 'credito'), null, 'precio_bs: lista sin precio es null');

-- DB-07: un tipo de cambio nuevo cambia el precio en Bs.
select public.registrar_tipo_cambio('aaaaaaaa-4000-0000-0000-000000000001', 6.96);
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000002', 'contado'), 696.00::numeric, 'DB-07: USD con tipo de cambio 6.96');
select public.registrar_tipo_cambio('aaaaaaaa-4000-0000-0000-000000000001', 7.00);
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000002', 'contado'), 700.00::numeric, 'DB-07: rige el tipo de cambio más reciente');
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000001', 'contado'), 25.50::numeric, 'DB-07: el precio en BOB no cambia');
select is((select tipo_cambio from public.producto_precios_bs where producto_id = 'eeeeeeee-4000-0000-0000-000000000002' and lista = 'contado'), 7.0000::numeric, 'vista: expone el tipo de cambio vigente');

-- DB-09: P-08, 2 decimales, mitad hacia arriba.
select public.registrar_tipo_cambio('aaaaaaaa-4000-0000-0000-000000000001', 6.965);
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000002', 'credito'), 6.97::numeric, 'DB-09: 1 USD x 6.965 = 6.97');
select public.registrar_tipo_cambio('aaaaaaaa-4000-0000-0000-000000000001', 6.9649);
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000002', 'credito'), 6.96::numeric, 'DB-09: 1 USD x 6.9649 = 6.96');
select is(scale(public.precio_bs('eeeeeeee-4000-0000-0000-000000000002', 'contado')), 2, 'DB-09: el resultado lleva 2 decimales');

-- Vista bajo RLS: cada negocio ve lo suyo, incluido el tipo de cambio.
select is((select count(*) from public.producto_precios_bs where negocio_id = 'aaaaaaaa-4000-0000-0000-000000000002'), 0::bigint, 'vista: T no ve precios de L');
select is(public.precio_bs('eeeeeeee-4000-0000-0000-000000000004', 'normal'), null, 'precio_bs: producto de otro negocio es null');
select pg_temp.como('99999999-4000-0000-0000-000000000002');
select is((select array_agg(distinct negocio_id) from public.producto_precios_bs), array['aaaaaaaa-4000-0000-0000-000000000002'::uuid], 'vista: L ve solo sus precios');
reset role;
select ok((select reloptions from pg_class where relname = 'producto_precios_bs') @> array['security_invoker=true'], 'la vista es security_invoker');
set local role anon;
select throws_ok($$select * from public.producto_precios_bs$$, '42501', null, 'vista: anon sin acceso');

select * from finish();
rollback;
