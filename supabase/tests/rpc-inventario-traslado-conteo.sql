-- RPC trasladar_stock (DB-16) y registrar_conteo (DB-17).
begin;
select plan(50);
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
select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 5, null);
select public.registrar_entrada(pg_temp.i('O2'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 15, null);

-- trasladar_stock
select set_config('t.m', public.trasladar_stock(pg_temp.i('O3'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 5, 'reposición', null)::text, true);
select is((select tipo from public.movimientos_inventario where id = current_setting('t.m')::uuid), 'traslado_salida', 'traslado: devuelve el movimiento de salida');
select results_eq($$select ubicacion_id, cantidad from public.stock where producto_id = pg_temp.i('P1') order by ubicacion_id$$,
  $$values (pg_temp.i('U1'), 15.000::numeric), (pg_temp.i('U2'), 5.000::numeric)$$, 'traslado: origen baja y destino sube');
select is((select sum(cantidad) from public.stock where producto_id = pg_temp.i('P1')), 20.000::numeric, 'DB-16: el stock total no cambia');
reset role;
select results_eq($$select tipo, ubicacion_id, cantidad, costo_unitario from public.movimientos_inventario where ref_id = pg_temp.i('O3') order by tipo$$,
  $$values ('traslado_entrada', pg_temp.i('U2'), 5.000::numeric, 10.0000::numeric), ('traslado_salida', pg_temp.i('U1'), -5.000::numeric, 10.0000::numeric)$$,
  'traslado: dos movimientos con el costo promedio del origen');
select is((select costo_promedio from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U2')), 10.0000::numeric, 'traslado: el destino hereda el promedio del origen');
select pg_temp.como(pg_temp.i('d'));
select is(public.trasladar_stock(pg_temp.i('O3'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 5, 'reposición', null)::text, current_setting('t.m'), 'traslado: repetir devuelve el mismo resultado');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O3')), 2::bigint, 'traslado: repetir no duplica movimientos');
select is((select sum(cantidad) from public.stock where producto_id = pg_temp.i('P1')), 20.000::numeric, 'traslado: repetir no cambia el stock');
select lives_ok($$select public.trasladar_stock(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 100, null, null)$$, 'RN-04: traslado con stock insuficiente se permite');
select is((select sum(cantidad) from public.stock where producto_id = pg_temp.i('P1')), 20.000::numeric, 'DB-16: el total sigue igual con origen negativo');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U1'), 1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: origen igual a destino');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 0, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: cantidad 0');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), -1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: cantidad negativa');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 'NaN', null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: cantidad NaN');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 1.5, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: decimal en unidad');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('UL'), 1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: destino de otro negocio');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('UL'), pg_temp.i('U2'), 1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: origen de otro negocio');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('PI'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: producto de otro negocio');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'traslado: serie_ids en producto sin serie');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.trasladar_stock(pg_temp.i('O6'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, null)$$, 'P0001', 'ERP_SIN_PERMISO', 'traslado: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.trasladar_stock(pg_temp.i('O6'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, null)$$, 'P0001', 'ERP_SIN_PERMISO', 'traslado: usuario de otro negocio');

-- Traslado con series
select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('O10'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 2, 50, null);
reset role;
insert into public.series (id, negocio_id, producto_id, serie, ubicacion_id) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('PS'), 'A1', pg_temp.i('U1')),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('PS'), 'A2', pg_temp.i('U1'));
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.trasladar_stock(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: el traslado exige serie_ids');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), pg_temp.i('U2'), 2, null, array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: cantidad distinta de serie_ids');
select lives_ok($$select public.trasladar_stock(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, array[pg_temp.i('S1')])$$, 'serie: traslado con su serie');
select is((select ubicacion_id from public.series where id = pg_temp.i('S1')), pg_temp.i('U2'), 'serie: cambia de ubicación');
select lives_ok($$select public.trasladar_stock(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, array[pg_temp.i('S1')])$$, 'serie: repetir la operación no falla');
select throws_ok($$select public.trasladar_stock(pg_temp.i('O12'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), pg_temp.i('U2'), 1, null, array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: ya no está en el origen');

-- registrar_conteo (U2 tiene 10 de P1 tras los traslados: +5 +100 = 105... se mide con lo que haya)
select cantidad as sistema from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U2') \gset
select is(public.registrar_conteo(pg_temp.i('O20'), pg_temp.i('T'), pg_temp.i('U2'), jsonb_build_array(
    jsonb_build_object('producto_id', pg_temp.i('P1'), 'cantidad_contada', :sistema),
    jsonb_build_object('producto_id', pg_temp.i('PK'), 'cantidad_contada', 4.5)), 'conteo mensual'),
  1, 'DB-17: el conteo ajusta solo donde hay diferencia');
select results_eq($$select producto_id, cantidad_sistema, cantidad_contada from public.conteo_items where conteo_id = pg_temp.i('O20') order by cantidad_contada$$,
  format($$values (%L::uuid, 0.000::numeric, 4.500::numeric), (%L::uuid, %s::numeric, %s::numeric)$$, pg_temp.i('PK'), pg_temp.i('P1'), :sistema, :sistema),
  'conteo: guarda lo que decía el sistema y lo contado');
select results_eq($$select producto_id, tipo, cantidad, ref_tipo, ref_id, motivo from public.movimientos_inventario where ref_id = pg_temp.i('O20')$$,
  format($$values (%L::uuid, 'ajuste', 4.500::numeric, 'conteo', %L::uuid, 'conteo mensual')$$, pg_temp.i('PK'), pg_temp.i('O20')), 'conteo: un ajuste por la diferencia');
select is((select cantidad from public.stock where producto_id = pg_temp.i('PK') and ubicacion_id = pg_temp.i('U2')), 4.500::numeric, 'conteo: el stock queda en lo contado');
select is(public.registrar_conteo(pg_temp.i('O20'), pg_temp.i('T'), pg_temp.i('U2'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PK'), 'cantidad_contada', 99)), null), 1, 'conteo: repetir devuelve el resultado original');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O20')), 1::bigint, 'conteo: repetir no genera ajustes');
select is((select count(*) from public.conteo_items where conteo_id = pg_temp.i('O20')), 2::bigint, 'conteo: repetir no cambia los items');
select is(public.registrar_conteo(pg_temp.i('O21'), pg_temp.i('T'), pg_temp.i('U2'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PK'), 'cantidad_contada', 1)), null), 1, 'conteo: diferencia negativa');
select is((select cantidad from public.stock where producto_id = pg_temp.i('PK') and ubicacion_id = pg_temp.i('U2')), 1.000::numeric, 'conteo: baja el stock a lo contado');
select is(public.registrar_conteo(pg_temp.i('O22'), pg_temp.i('T'), pg_temp.i('U2'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PK'), 'cantidad_contada', 1)), null), 0, 'conteo: sin diferencias no genera ajustes');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O20'), pg_temp.i('T'), pg_temp.i('U1'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: la misma operación en otra ubicación');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: sin items');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), (select jsonb_agg(jsonb_build_object('producto_id', pg_temp.i('P1'), 'cantidad_contada', 1)) from generate_series(1, 501)), null)$$, 'P0001', 'ERP_LOTE_GRANDE', 'conteo: más de 500 items');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":-1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: contada negativa');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":"NaN"}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: contada NaN');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":1.5}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: decimal en unidad');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":1},{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":2}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: producto repetido');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000005","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: producto de otro negocio');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('UL'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: ubicación de otro negocio');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"not-a-uuid","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: producto_id mal formado');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_conteo(pg_temp.i('O24'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'conteo: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_conteo(pg_temp.i('O24'), pg_temp.i('T'), pg_temp.i('U2'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000001","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'conteo: usuario de otro negocio');
select throws_ok($$select public.registrar_conteo(pg_temp.i('O20'), pg_temp.i('L'), pg_temp.i('UL'), '[{"producto_id":"eeeeeeee-3000-0000-0000-000000000005","cantidad_contada":1}]', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'conteo: una operación de otro negocio no se reutiliza');

select * from finish();
rollback;
