-- M-8: registrar_compra en el frial exige lote y vence por línea y crea el lote; fuera del frial no admite lote ni vence.
begin;
select plan(22);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9600' || n)::uuid $$;
-- d dueño de F (frial) y de T (tienda)
insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i('d'), 'd@test.local', jsonb_build_object('nombre', 'd'));
insert into public.negocios (id, nombre, tipo) values (pg_temp.i('F'), 'F', 'frial'), (pg_temp.i('T'), 'T', 'tienda');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('F'), 'dueno'), (pg_temp.i('d'), pg_temp.i('T'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('UF'), pg_temp.i('F'), 'UF', 'local'), (pg_temp.i('UT'), pg_temp.i('T'), 'UT', 'local');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PA'), pg_temp.i('F'), 'PA', 'PA', 'producto', 'unidad', false),
  (pg_temp.i('PB'), pg_temp.i('F'), 'PB', 'PB', 'producto', 'unidad', false),
  (pg_temp.i('PS'), pg_temp.i('F'), 'PS', 'PS', 'producto', 'unidad', true),
  (pg_temp.i('PT'), pg_temp.i('T'), 'PT', 'PT', 'producto', 'unidad', false);
insert into public.proveedores (id, negocio_id, nombre) values
  (pg_temp.i('VF'), pg_temp.i('F'), 'VF'), (pg_temp.i('VT'), pg_temp.i('T'), 'VT');

-- Línea con lote y vence opcionales (null = clave ausente).
create function pg_temp.it(p text, c numeric, k numeric, lote text default null, vence text default null)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('producto_id', pg_temp.i(p), 'cantidad', c, 'costo_unitario', k,
    'lote', lote, 'vence', vence))
$$;
create function pg_temp.compra(o text, items jsonb, neg text default 'F') returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(o), 'negocio_id', pg_temp.i(neg),
    'proveedor_id', pg_temp.i(case when neg = 'F' then 'VF' else 'VT' end),
    'ubicacion_id', pg_temp.i(case when neg = 'F' then 'UF' else 'UT' end), 'condicion', 'credito',
    'total', (select sum(round((e ->> 'cantidad')::numeric * (e ->> 'costo_unitario')::numeric, 2)) from jsonb_array_elements(items) e),
    'items', items)
$$;
create function pg_temp.hoy(dias integer) returns text language sql as $$
  select (((now() at time zone 'America/La_Paz')::date) + dias)::text
$$;

select pg_temp.como(pg_temp.i('d'));
-- Rechazos en el frial
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: sin lote ni vence');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, 'L1'))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: sin vence');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, null, pg_temp.hoy(5)))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: sin lote');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, '   ', pg_temp.hoy(5)))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: lote en blanco');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, repeat('x', 41), pg_temp.hoy(5)))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: lote de más de 40 caracteres');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, 'L1', pg_temp.hoy(-1)))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: vence ayer');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, 'L1', '2026-02-30'))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: fecha inexistente (overflow)');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, 'L1', '10/11/2027'))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: fecha mal formada');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, 'L1', 'infinity'))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: infinity no es fecha');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PS', 1, 10, 'L1', pg_temp.hoy(5)))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: producto con serie rechazado');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O1', jsonb_build_array(pg_temp.it('PA', 5, 10, 'L1', pg_temp.hoy(5)), pg_temp.it('PB', 2, 3))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'frial: una línea sin lote rechaza toda la compra');
select is((select count(id) from public.compras where negocio_id = pg_temp.i('F')) + (select count(*) from public.lotes where negocio_id = pg_temp.i('F')),
  0::bigint, 'los rechazos no dejan compra ni lote');

-- Compra válida
select set_config('t.r2', public.registrar_compra(pg_temp.compra('O2', jsonb_build_array(
  pg_temp.it('PA', 5, 10, ' L-A1 ', pg_temp.hoy(3)), pg_temp.it('PB', 2, 3, 'L-B1', pg_temp.hoy(0)))))::text, true);
select is((current_setting('t.r2')::jsonb ->> 'total')::numeric, 56::numeric, 'frial: compra con lote y vence (vence hoy vale)');
select results_eq($$select l.codigo, l.vence::text, l.cantidad, l.producto_id, l.ubicacion_id, l.usuario_id, m.tipo, m.ref_id
    from public.lotes l join public.movimientos_inventario m on m.id = l.movimiento_id
    where l.negocio_id = pg_temp.i('F') order by l.codigo$$,
  $$values ('L-A1', pg_temp.hoy(3), 5.000::numeric, pg_temp.i('PA'), pg_temp.i('UF'), pg_temp.i('d'), 'compra', pg_temp.i('O2')),
           ('L-B1', pg_temp.hoy(0), 2.000::numeric, pg_temp.i('PB'), pg_temp.i('UF'), pg_temp.i('d'), 'compra', pg_temp.i('O2'))$$,
  'frial: un lote por línea, ligado al movimiento de la compra, con el lote recortado');
select is((select count(*) from jsonb_array_elements(public.lotes_por_vencer(pg_temp.i('F'), 7)) e where e ->> 'codigo' in ('L-A1', 'L-B1')),
  2::bigint, 'los lotes de la compra aparecen en Por vencer');
select is(public.registrar_compra(pg_temp.compra('O2', jsonb_build_array(
  pg_temp.it('PA', 5, 10, ' L-A1 ', pg_temp.hoy(3)), pg_temp.it('PB', 2, 3, 'L-B1', pg_temp.hoy(0)))))::text,
  current_setting('t.r2'),
  'idempotencia: repetir devuelve la misma compra');
select is((select count(*) from public.lotes where negocio_id = pg_temp.i('F')), 2::bigint, 'idempotencia: no duplica lotes');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O2', jsonb_build_array(
  pg_temp.it('PA', 5, 10, 'OTRO', pg_temp.hoy(3)), pg_temp.it('PB', 2, 3, 'L-B1', pg_temp.hoy(0)))))$$,
  'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: mismo id con otro lote');

-- Fuera del frial
select throws_ok($$select public.registrar_compra(pg_temp.compra('O3', jsonb_build_array(pg_temp.it('PT', 1, 5, 'L1', pg_temp.hoy(5))), 'T'))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'tienda: lote y vence rechazados');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O3', jsonb_build_array(pg_temp.it('PT', 1, 5, 'L1')), 'T'))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'tienda: solo lote rechazado');
select lives_ok($$select public.registrar_compra(pg_temp.compra('O3', jsonb_build_array(
  jsonb_build_object('producto_id', pg_temp.i('PT'), 'cantidad', 1, 'costo_unitario', 5, 'lote', null, 'vence', null)), 'T'))$$,
  'tienda: lote y vence nulos explícitos valen');
select is((select count(*) from public.lotes where negocio_id = pg_temp.i('T')), 0::bigint, 'tienda: no crea lotes');

select * from finish();
rollback;
