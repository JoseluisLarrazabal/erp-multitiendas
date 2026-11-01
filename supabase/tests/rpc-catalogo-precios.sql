-- RPC guardar_precios y registrar_tipo_cambio.
begin;
select plan(43);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería, F frial.
-- d: dueño de T, L y F · v: vendedor de T · x: encargado de L (ajeno a T)
select pg_temp.crear_usuario(('99999999-3000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-3000-0000-0000-000000000002', 'L', 'lavanderia'),
  ('aaaaaaaa-3000-0000-0000-000000000003', 'F', 'frial');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'dueno'),
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000002', 'dueno'),
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000003', 'dueno'),
  ('99999999-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'vendedor'),
  ('99999999-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000002', 'encargado');
insert into public.productos (id, negocio_id, codigo, nombre, tipo) values
  ('eeeeeeee-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'P1', 'P1', 'producto'),
  ('eeeeeeee-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'P2', 'P2', 'producto'),
  ('eeeeeeee-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000002', 'S1', 'S1', 'servicio'),
  ('eeeeeeee-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000003', 'C1', 'C1', 'producto');

-- guardar_precios: feliz
select pg_temp.como('99999999-3000-0000-0000-000000000001');
select is(public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":10,"credito":12.5,"mayorista":9,"minimo":8}}]'), 1, 'precios: devuelve los productos procesados');
select is((select count(*) from public.producto_precios where producto_id = 'eeeeeeee-3000-0000-0000-000000000001'), 4::bigint, 'precios: 4 listas guardadas');
select is((select monto from public.producto_precios where producto_id = 'eeeeeeee-3000-0000-0000-000000000001' and lista = 'credito'), 12.50::numeric, 'precios: monto con decimales');
select lives_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":11,"credito":null}}]')$$, 'precios: actualizar una lista y borrar otra');
select results_eq(
  $$select lista, monto from public.producto_precios where producto_id = 'eeeeeeee-3000-0000-0000-000000000001' order by lista$$,
  $$values ('contado', 11.00::numeric), ('mayorista', 9.00::numeric), ('minimo', 8.00::numeric)$$,
  'precios: contado actualizada, credito borrada, las no mencionadas intactas'
);
select lives_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000002","moneda":"USD","precios":{"contado":99.5}},{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":5}}]')$$, 'precios: lote de 2 productos, USD y BOB');
select is((select moneda from public.producto_precios where producto_id = 'eeeeeeee-3000-0000-0000-000000000002'), 'USD', 'precios: moneda USD guardada');
select lives_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000002', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000003","moneda":"BOB","precios":{"normal":15,"express":25}}]')$$, 'precios: listas de lavandería');
select lives_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000003', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000004","moneda":"BOB","precios":{"contado":60,"minimo":50}}]')$$, 'precios: listas de frial');
select lives_ok(format($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', %L::jsonb)$$,
  (select jsonb_agg(jsonb_build_object('producto_id', 'eeeeeeee-3000-0000-0000-000000000001', 'moneda', 'BOB', 'precios', jsonb_build_object('contado', n))) from generate_series(1, 200) n)), 'precios: lote de 200 productos');
-- guardar_precios: rechazos
select throws_ok(format($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', %L::jsonb)$$,
  (select jsonb_agg(jsonb_build_object('producto_id', 'eeeeeeee-3000-0000-0000-000000000001', 'moneda', 'BOB', 'precios', jsonb_build_object('contado', n))) from generate_series(1, 201) n)), 'P0001', 'ERP_LOTE_GRANDE', 'precios: 201 productos');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lote vacío');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '{"a":1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lote que no es arreglo');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lote nulo');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000002', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000003","moneda":"BOB","precios":{"contado":5}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lista de tienda en lavandería');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"normal":5}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lista de lavandería en tienda');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"vip":5}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lista inexistente');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":-1}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: monto negativo');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":0}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: monto cero (quitar un precio es null)');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":"10"}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: monto como texto');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":1e12}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: monto fuera de rango');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"EUR","precios":{"contado":1}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: moneda inválida');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","precios":{"contado":1}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: moneda ausente');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":[1]}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: precios que no es objeto');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"nada","moneda":"BOB","precios":{"contado":1}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: producto_id mal formado');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000003","moneda":"BOB","precios":{"contado":1}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: producto de otro negocio');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"USD","precios":{"credito":5}}]')$$, 'P0001', 'ERP_MONEDA_MIXTA', 'precios: otra moneda dejaría listas mezcladas');
-- Todo o nada: el primer item es válido, el segundo no.
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000002","moneda":"USD","precios":{"minimo":1}},{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":-5}}]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precios: lote con un item inválido');
select is((select count(*) from public.producto_precios where producto_id = 'eeeeeeee-3000-0000-0000-000000000002' and lista = 'minimo'), 0::bigint, 'precios: el lote fallido no dejó nada');
select pg_temp.como('99999999-3000-0000-0000-000000000002');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":1}}]')$$, 'P0001', 'ERP_SIN_PERMISO', 'precios: el vendedor no edita productos');
select pg_temp.como('99999999-3000-0000-0000-000000000003');
select throws_ok($$select public.guardar_precios('aaaaaaaa-3000-0000-0000-000000000001', '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","moneda":"BOB","precios":{"contado":1}}]')$$, 'P0001', 'ERP_SIN_PERMISO', 'precios: usuario de otro negocio');

-- registrar_tipo_cambio
select pg_temp.como('99999999-3000-0000-0000-000000000001');
select isnt(public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 6.96), null, 'tipo de cambio: devuelve el id');
select is((select usuario_id from public.tipos_cambio where negocio_id = 'aaaaaaaa-3000-0000-0000-000000000001'), '99999999-3000-0000-0000-000000000001'::uuid, 'tipo de cambio: usuario_id es quien lo registró');
select lives_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 7.0000)$$, 'tipo de cambio: un segundo registro');
select is((select count(*) from public.tipos_cambio where negocio_id = 'aaaaaaaa-3000-0000-0000-000000000001'), 2::bigint, 'tipo de cambio: el anterior se conserva');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 0)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo de cambio: cero');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo de cambio: negativo');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo de cambio: nulo');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 'NaN')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo de cambio: NaN');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 0.00001)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo de cambio: redondea a cero');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 1e12)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo de cambio: fuera de rango');
select pg_temp.como('99999999-3000-0000-0000-000000000002');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 7)$$, 'P0001', 'ERP_SIN_PERMISO', 'tipo de cambio: el vendedor no edita productos');
select pg_temp.como('99999999-3000-0000-0000-000000000003');
select throws_ok($$select public.registrar_tipo_cambio('aaaaaaaa-3000-0000-0000-000000000001', 7)$$, 'P0001', 'ERP_SIN_PERMISO', 'tipo de cambio: usuario de otro negocio');

select * from finish();
rollback;
