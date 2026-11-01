-- RPC registrar_series y fijar_costos.
begin;
select plan(36);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería. U1 y U2 en T, UL en L.
-- d: dueño de T y L · v: vendedor de T · c: contador de T · x: encargado de L (ajeno a T)
select pg_temp.crear_usuario(('99999999-3000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-3000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'dueno'),
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000002', 'dueno'),
  ('99999999-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'vendedor'),
  ('99999999-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'contador'),
  ('99999999-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000002', 'encargado');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'U1', 'local'),
  ('bbbbbbbb-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'U2', 'deposito'),
  ('bbbbbbbb-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000002', 'UL', 'local');
-- P1 unidad · PK kg · PS unidad con serie · PL servicio (L) · PI insumo (L)
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie, stock_minimo) values
  ('eeeeeeee-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'P1', 'P1', 'producto', 'unidad', false, 20),
  ('eeeeeeee-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'PK', 'PK', 'producto', 'kg', false, null),
  ('eeeeeeee-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'PS', 'PS', 'producto', 'unidad', true, null),
  ('eeeeeeee-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000002', 'PL', 'PL', 'servicio', 'unidad', false, null),
  ('eeeeeeee-3000-0000-0000-000000000005', 'aaaaaaaa-3000-0000-0000-000000000002', 'PI', 'PI', 'insumo', 'unidad', false, null);
-- Atajo de ids: T, L (negocios) · U1, U2, UL (ubicaciones) · P1, PK, PS, PL, PI (productos) · d, v, c, x (usuarios) · O<n> operaciones · S<n> series
create function pg_temp.i(n text) returns uuid language sql as $$
  select (case
    when n = 'T' then 'aaaaaaaa-3000-0000-0000-000000000001'
    when n = 'L' then 'aaaaaaaa-3000-0000-0000-000000000002'
    when n = 'U1' then 'bbbbbbbb-3000-0000-0000-000000000001'
    when n = 'U2' then 'bbbbbbbb-3000-0000-0000-000000000002'
    when n = 'UL' then 'bbbbbbbb-3000-0000-0000-000000000003'
    when n = 'P1' then 'eeeeeeee-3000-0000-0000-000000000001'
    when n = 'PK' then 'eeeeeeee-3000-0000-0000-000000000002'
    when n = 'PS' then 'eeeeeeee-3000-0000-0000-000000000003'
    when n = 'PL' then 'eeeeeeee-3000-0000-0000-000000000004'
    when n = 'PI' then 'eeeeeeee-3000-0000-0000-000000000005'
    when n = 'd' then '99999999-3000-0000-0000-000000000001'
    when n = 'v' then '99999999-3000-0000-0000-000000000002'
    when n = 'c' then '99999999-3000-0000-0000-000000000003'
    when n = 'x' then '99999999-3000-0000-0000-000000000004'
    when n like 'O%' then 'cccccccc-3000-0000-0000-' || lpad(substr(n, 2), 12, '0')
    when n like 'S%' then 'dddddddd-3000-0000-0000-' || lpad(substr(n, 2), 12, '0')
  end)::uuid
$$;

select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 3, null, null);

-- registrar_series
select is(public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array[' A1 ', 'A2']), 2, 'series: registra y devuelve cuántas');
select results_eq($$select serie, estado from public.series order by serie$$, $$values ('A1', 'disponible'), ('A2', 'disponible')$$, 'series: recortadas y disponibles');
select is((select count(*) from public.movimientos_inventario), 1::bigint, 'series: no generan movimientos');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['B1', 'B2'])$$, 'P0001', 'ERP_SERIES_EXCEDEN_STOCK', 'series: disponibles más nuevas exceden el stock');
select is(public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['A3']), 1, 'series: la última cabe justo');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['A4'])$$, 'P0001', 'ERP_SERIES_EXCEDEN_STOCK', 'series: ya completas');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U2'), array['C1'])$$, 'P0001', 'ERP_SERIES_EXCEDEN_STOCK', 'series: ubicación sin stock');
select public.ajustar_inventario(pg_temp.i('O2'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -1, 'x', array[(select id from public.series where serie = 'A1')]);
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['A1'])$$, 'P0001', 'ERP_SERIE_DUPLICADA', 'series: duplicada con una existente, aunque esté en baja');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['Z1', 'Z1'])$$, 'P0001', 'ERP_SERIE_DUPLICADA', 'series: duplicada dentro del lote');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), array['Q1'])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'series: el producto debe controlar serie');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array[]::text[])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'series: lote vacío');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['  '])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'series: serie en blanco');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array[null, 'N1'])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'series: serie nula');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), (select array_agg('M' || g) from generate_series(1, 501) g))$$, 'P0001', 'ERP_LOTE_GRANDE', 'series: más de 500');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('UL'), array['Q1'])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'series: ubicación de otro negocio');
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PI'), pg_temp.i('U1'), array['Q1'])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'series: producto de otro negocio');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['Q1'])$$, 'P0001', 'ERP_SIN_PERMISO', 'series: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_series(pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), array['Q1'])$$, 'P0001', 'ERP_SIN_PERMISO', 'series: usuario de otro negocio');

-- fijar_costos
select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('O10'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 5, null);
select public.registrar_entrada(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U2'), 5, null, null);
select is(public.fijar_costos(pg_temp.i('T'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'costo', 7.5)), 'carga de costos'), 2, 'costos: un ajuste_costo por fila de stock');
select results_eq($$select s.cantidad, c.costo_promedio from public.costos_stock(pg_temp.i('T')) c join public.stock s using (producto_id, ubicacion_id) where producto_id = pg_temp.i('P1') order by s.cantidad$$,
  $$values (5.000::numeric, 7.5000::numeric), (10.000::numeric, 7.5000::numeric)$$, 'costos: ambas ubicaciones quedan con el costo y el stock intacto');
reset role;
select results_eq($$select tipo, cantidad, ref_id, motivo from public.movimientos_inventario where producto_id = pg_temp.i('P1') and tipo = 'ajuste_costo'$$,
  $$values ('ajuste_costo', 0.000::numeric, null::uuid, 'carga de costos'), ('ajuste_costo', 0.000::numeric, null::uuid, 'carga de costos')$$, 'costos: movimientos con cantidad 0 y sin ref_id');
select pg_temp.como(pg_temp.i('d'));
select is(public.fijar_costos(pg_temp.i('T'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'costo', 7.5)), null), 0, 'costos: el mismo costo no genera movimientos');
select is(public.fijar_costos(pg_temp.i('T'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PK'), 'costo', 3)), null), 0, 'costos: sin filas de stock no hace nada');
select is((select count(*) from public.movimientos_inventario where producto_id = pg_temp.i('PK')), 0::bigint, 'costos: sin stock no deja movimientos');
select is(public.fijar_costos(pg_temp.i('T'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'costo', 0)), null), 2, 'costos: costo 0 es válido');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: lote vacío');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), (select jsonb_agg(jsonb_build_object('producto_id', pg_temp.i('P1'), 'costo', 1)) from generate_series(1, 201)), null)$$, 'P0001', 'ERP_LOTE_GRANDE', 'costos: más de 200');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","costo":-1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: negativo');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","costo":"NaN"}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: NaN');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","costo":1.23456}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: más de 4 decimales');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000005","costo":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: producto de otro negocio');
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"x","costo":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: producto_id mal formado');
select throws_ok($$select public.fijar_costos(pg_temp.i('L'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000004","costo":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'costos: un servicio no lleva costo');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","costo":1}]', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'costos: el contador ve costos pero no ajusta inventario');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","costo":1}]', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'costos: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.fijar_costos(pg_temp.i('T'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","costo":1}]', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'costos: usuario de otro negocio');

select * from finish();
rollback;
