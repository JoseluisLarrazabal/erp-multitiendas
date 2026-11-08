-- Venta sin conexión (fase 3, PR 1): registrar_venta con p_offline, marcas de revisión, verificar_pago_qr, revisar_venta
-- y reconciliacion_ventas. Cubre DB-01 (reenvío online/offline) y DB-12 (stock negativo en reconciliación).
begin;
select plan(170);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9100' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- Usuarios: d dueño · e encargado · v y w vendedores · c contador (ver_reportes, sin vender) de T · x dueño de L
select pg_temp.crear_usuario(n) from (values ('d'), ('e'), ('v'), ('w'), ('c'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('e'), pg_temp.i('T'), 'encargado'),
  (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'), (pg_temp.i('w'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'),
  (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 0),
  (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0);
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial, cerrada_en, usuario_cierre,
  monto_contado, monto_esperado, diferencia) values
  (pg_temp.i('SC'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 0, now(), pg_temp.i('d'), 0, 0, 0);
-- T: P1 (contado 10, minimo 8) · PN sin precio · PM solo minimo 8 · PI inactivo (10) · PV servicio · PD (10, minimo de stock 1) · PS serie
-- L: PX activo y PXI inactivo
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie, activo, stock_minimo) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false, true, null),
  (pg_temp.i('PN'), pg_temp.i('T'), 'PN', 'PN', 'producto', 'unidad', false, true, null),
  (pg_temp.i('PM'), pg_temp.i('T'), 'PM', 'PM', 'producto', 'unidad', false, true, null),
  (pg_temp.i('PI'), pg_temp.i('T'), 'PI', 'PI', 'producto', 'unidad', false, false, null),
  (pg_temp.i('PV'), pg_temp.i('T'), 'PV', 'PV', 'servicio', 'unidad', false, true, null),
  (pg_temp.i('PD'), pg_temp.i('T'), 'PD', 'PD', 'producto', 'unidad', false, true, 1),
  (pg_temp.i('PS'), pg_temp.i('T'), 'PS', 'PS', 'producto', 'unidad', true, true, null),
  (pg_temp.i('PX'), pg_temp.i('L'), 'PX', 'PX', 'producto', 'unidad', false, true, null),
  (pg_temp.i('PXI'), pg_temp.i('L'), 'PXI', 'PXI', 'producto', 'unidad', false, false, null);
insert into public.tipos_cambio (negocio_id, valor) values (pg_temp.i('T'), 7);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P1'), 'minimo', 8, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PM'), 'minimo', 8, 'BOB'), (pg_temp.i('T'), pg_temp.i('PI'), 'contado', 10, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PV'), 'contado', 30, 'BOB'), (pg_temp.i('T'), pg_temp.i('PD'), 'contado', 10, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PS'), 'contado', 100, 'BOB'),
  (pg_temp.i('L'), pg_temp.i('PX'), 'contado', 9, 'BOB'), (pg_temp.i('L'), pg_temp.i('PXI'), 'contado', 9, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PI'), 'inicial', 10, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PD'), 'inicial', 2, 1),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PS'), 'inicial', 2, 60);
insert into public.series (id, negocio_id, producto_id, serie, ubicacion_id)
select pg_temp.i('SE' || n), pg_temp.i('T'), pg_temp.i('PS'), 'SN' || n, pg_temp.i('U1') from generate_series(1, 2) n;

-- Payload
create function pg_temp.it(p_prod text, p_cant numeric, p_precio numeric) returns jsonb language sql as $$
  select jsonb_build_object('producto_id', pg_temp.i(p_prod), 'lista', 'contado', 'cantidad', p_cant, 'precio_unitario', p_precio)
$$;
create function pg_temp.pg(p_medio text, p_monto numeric, p_verif boolean default null) returns jsonb language sql as $$
  select jsonb_build_object('medio', p_medio, 'monto', p_monto) || case when p_verif is null then '{}' else jsonb_build_object('verificado', p_verif) end
$$;
create function pg_temp.v(p_id text, p_disp text, p_caja text, p_num text, p_total numeric, p_items jsonb, p_pagos jsonb)
  returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i(p_disp), 'caja_sesion_id', pg_temp.i(p_caja),
    'numero', p_num, 'creada_en_cliente', now(), 'total', p_total, 'items', p_items, 'pagos', p_pagos)
$$;
-- Venta de n unidades de P1 a 10 en efectivo (equipo D1, caja S1)
create function pg_temp.v1(p_id text, p_num text, p_n numeric) returns jsonb language sql as $$
  select pg_temp.v(p_id, 'D1', 'S1', p_num, p_n * 10, jsonb_build_array(pg_temp.it('P1', p_n, 10)),
    jsonb_build_array(pg_temp.pg('efectivo', p_n * 10)))
$$;
-- Venta de un producto, una unidad, a p_precio, con un solo pago
create function pg_temp.vp(p_id text, p_num text, p_prod text, p_precio numeric, p_pago jsonb) returns jsonb language sql as $$
  select pg_temp.v(p_id, 'D1', 'S1', p_num, p_precio, jsonb_build_array(pg_temp.it(p_prod, 1, p_precio)), jsonb_build_array(p_pago))
$$;
-- p_offline: vendedor, numero_impreso (null = no impreso), tipo de cambio visto por el vendedor
create function pg_temp.o(p_vend text, p_imp text default null, p_tc numeric default 6.96) returns jsonb language sql as $$
  select jsonb_build_object('vendedor_id', pg_temp.i(p_vend), 'tipo_cambio', p_tc, 'numero_impreso', p_imp)
$$;
create function pg_temp.motivos(p_id text) returns text language sql as $$
  select array_to_string(motivos_revision, ',') from public.ventas where id = pg_temp.i(p_id)
$$;
create function pg_temp.pago_qr(p_id text) returns uuid language sql as $$
  select id from public.venta_pagos where venta_id = pg_temp.i(p_id) and medio = 'qr'
$$;
create function pg_temp.en_lista(p_id text) returns boolean language sql as $$
  select exists (select 1 from public.reconciliacion_ventas(pg_temp.i('T'), 500) r where r.id = pg_temp.i(p_id))
$$;

-- Permisos de ejecución y firma vieja
select ok(has_function_privilege('authenticated', 'public.registrar_venta(jsonb, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.verificar_pago_qr(uuid, boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.revisar_venta(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reconciliacion_ventas(uuid, integer, uuid)', 'EXECUTE'), 'authenticated ejecuta las 4 RPC');
select ok(not has_function_privilege('anon', 'public.registrar_venta(jsonb, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.verificar_pago_qr(uuid, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.revisar_venta(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reconciliacion_ventas(uuid, integer, uuid)', 'EXECUTE'), 'anon no ejecuta ninguna');
select is(to_regprocedure('public.registrar_venta(jsonb)'), null, 'la firma vieja de registrar_venta ya no existe');

-- Permisos y forma de p_offline (nada se escribe)
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v'))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no vende ni con p_offline');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('x'))$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no vende en mi equipo con p_offline');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v') || '{"extra": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_offline con clave desconocida');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v') - 'vendedor_id')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_offline sin vendedor_id');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v', null, -1))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo_cambio negativo');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v', null, 0))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo_cambio 0');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v') || '{"tipo_cambio": "6.96"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo_cambio como string');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v', null, 6.123456))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo_cambio con 5 decimales');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v', null, 99999999))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo_cambio fuera de rango');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), '[]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_offline no es objeto');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v', 'C1-12'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'numero_impreso mal formado');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v', 'C2-000001'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'numero_impreso con prefijo de otro equipo');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('v') || '{"vendedor_id": 5}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'vendedor_id no es uuid');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('x'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'vendedor de otro negocio');
select throws_ok($$select public.registrar_venta(pg_temp.v1('X1', 'C1-000001', 1), pg_temp.o('nadie'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'vendedor inexistente');
select is((select count(*) from public.ventas)::integer, 0, 'nada escrito tras los rechazos');

-- Camino feliz offline: vendedor, enviada_por, origen y el tipo de cambio que vio el vendedor
select is(public.registrar_venta(pg_temp.v1('O1', 'C1-000001', 2), pg_temp.o('v')), jsonb_build_object('id', pg_temp.i('O1'), 'numero', 'C1-000001', 'total', 20.00), 'venta offline: devuelve {id, numero, total}');
select is(public.registrar_venta(pg_temp.v1('O1', 'C1-000001', 2), pg_temp.o('v')), jsonb_build_object('id', pg_temp.i('O1'), 'numero', 'C1-000001', 'total', 20.00), 'reenvío offline devuelve lo original');
select pg_temp.como(pg_temp.i('w'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('O2', 'C1-000002', 1), pg_temp.o('v'))$$, 'w envía la venta que hizo v');
select is(public.registrar_venta(pg_temp.v1('O2', 'C1-000002', 1), pg_temp.o('w')) ->> 'id', pg_temp.i('O2')::text, 'reenvío con otro vendedor_id devuelve lo original');
reset role;
select is((select origen || '/' || (vendedor_id = pg_temp.i('v'))::text || '/' || (enviada_por = pg_temp.i('v'))::text || '/' || tipo_cambio
  from public.ventas where id = pg_temp.i('O1')), 'offline/true/true/6.9600', 'O1: origen offline, vendedor = envía, tipo de cambio del vendedor');
select is((select (vendedor_id = pg_temp.i('v'))::text || '/' || (enviada_por = pg_temp.i('w'))::text || '/' || motivos_revision::text
  from public.ventas where id = pg_temp.i('O2')), 'true/true/{otra_cuenta}', 'O2: vendedor v, enviada por w: marca otra_cuenta (ambas quedan a la vista)');
select is((select count(*) from public.ventas where id in (pg_temp.i('O1'), pg_temp.i('O2')))::integer, 2, 'una fila por venta tras los reenvíos');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O1'))::integer, 1, 'O1: un solo movimiento de kardex');

-- DB-01 offline: online primero, offline después con el mismo UUID: 1 venta, 1 serie de movimientos, origen original
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('O3', 'C1-000003', 1))$$, 'O3: primer intento en línea');
select is(public.registrar_venta(pg_temp.v1('O3', 'C1-000003', 1), pg_temp.o('w', 'C1-000003', 6.5)) ->> 'numero', 'C1-000003', 'O3: reenvío offline devuelve la venta guardada');
select throws_ok($$select public.registrar_venta(pg_temp.v1('O3', 'C1-000003', 2), pg_temp.o('v'))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'O3: reenvío offline con otro payload');
reset role;
select is((select origen || '/' || (vendedor_id = pg_temp.i('v'))::text || '/' || tipo_cambio from public.ventas where id = pg_temp.i('O3')), 'online/true/7.0000', 'O3 conserva origen, vendedor y tipo de cambio del primer intento');
select is((select count(*) from public.ventas where id = pg_temp.i('O3'))::integer + (select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O3'))::integer, 2, 'DB-01: 1 venta y 1 movimiento');
-- Al revés: offline primero, en línea después
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('O4', 'C1-000004', 1), pg_temp.o('v'))$$, 'O4: primero offline');
select is(public.registrar_venta(pg_temp.v1('O4', 'C1-000004', 1)) ->> 'id', pg_temp.i('O4')::text, 'O4: reenvío en línea devuelve la venta guardada');
reset role;
select is((select origen from public.ventas where id = pg_temp.i('O4')), 'offline', 'O4 conserva origen offline');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O4'))::integer, 1, 'O4: un solo movimiento');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('O1', 'C1-000001', 2), pg_temp.o('x'))$$, 'P0001', 'ERP_SIN_PERMISO', 'reenvío offline de otro negocio: no confirma que exista');

-- Marcas: producto inactivo (solo del mismo negocio)
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_venta(pg_temp.vp('M1', 'C1-000005', 'PI', 10, pg_temp.pg('efectivo', 10)))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'en línea, producto inactivo se rechaza');
select lives_ok($$select public.registrar_venta(pg_temp.vp('M1', 'C1-000005', 'PI', 10, pg_temp.pg('efectivo', 10)), pg_temp.o('v'))$$, 'offline, producto inactivo se acepta');
select throws_ok($$select public.registrar_venta(pg_temp.vp('M0', 'C1-000006', 'PX', 9, pg_temp.pg('efectivo', 9)), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline, producto activo de otro negocio se rechaza');
select throws_ok($$select public.registrar_venta(pg_temp.vp('M0', 'C1-000006', 'PXI', 9, pg_temp.pg('efectivo', 9)), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline, producto inactivo de otro negocio se rechaza');
select throws_ok($$select public.registrar_venta(pg_temp.vp('M0', 'C1-000006', 'PV', 30, pg_temp.pg('efectivo', 30)), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline, servicio fuera de lavandería se rechaza');
-- Marcas: sin precio (la lista no existe: sin piso aunque haya mínimo)
select throws_ok($$select public.registrar_venta(pg_temp.vp('M2', 'C1-000006', 'PN', 5, pg_temp.pg('efectivo', 5)))$$, 'P0001', 'ERP_PRODUCTO_SIN_PRECIO', 'en línea, producto sin precio se rechaza');
select lives_ok($$select public.registrar_venta(pg_temp.vp('M2', 'C1-000006', 'PN', 5, pg_temp.pg('efectivo', 5)), pg_temp.o('v'))$$, 'offline, producto sin precio se acepta');
select lives_ok($$select public.registrar_venta(pg_temp.vp('M3', 'C1-000007', 'PM', 5, pg_temp.pg('efectivo', 5)), pg_temp.o('v'))$$, 'offline, lista sin precio y solo mínimo: se acepta');
-- Marcas: bajo el piso sin descontar y sobre el tope. P1: lista 10, mínimo 8, tope 10%.
select throws_ok($$select public.registrar_venta(pg_temp.v('M4', 'D1', 'S1', 'C1-000008', 75, jsonb_build_array(pg_temp.it('P1', 10, 7.5)), jsonb_build_array(pg_temp.pg('efectivo', 75))))$$, 'P0001', 'ERP_SIN_PERMISO', 'en línea, bajo el piso sin descontar se rechaza');
select lives_ok($$select public.registrar_venta(pg_temp.v('M4', 'D1', 'S1', 'C1-000008', 75, jsonb_build_array(pg_temp.it('P1', 10, 7.5)), jsonb_build_array(pg_temp.pg('efectivo', 75))), pg_temp.o('v'))$$, 'offline, bajo el piso sin descontar se acepta');
select lives_ok($$select public.registrar_venta(pg_temp.v('M5', 'D1', 'S1', 'C1-000009', 70, jsonb_build_array(pg_temp.it('P1', 10, 7)), jsonb_build_array(pg_temp.pg('efectivo', 70))), pg_temp.o('v'))$$, 'offline, bajo el piso y sobre el tope');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.registrar_venta(pg_temp.v('M6', 'D1', 'S1', 'C1-000010', 70, jsonb_build_array(pg_temp.it('P1', 10, 7)), jsonb_build_array(pg_temp.pg('efectivo', 70))))$$, 'P0001', 'ERP_DESCUENTO_TOPE', 'en línea, sobre el tope se rechaza');
select lives_ok($$select public.registrar_venta(pg_temp.v('M6', 'D1', 'S1', 'C1-000010', 70, jsonb_build_array(pg_temp.it('P1', 10, 7)), jsonb_build_array(pg_temp.pg('efectivo', 70))), pg_temp.o('e'))$$, 'offline, con descontar y sobre el tope se acepta');
select lives_ok($$select public.registrar_venta(pg_temp.v1('M7', 'C1-000011', 1), pg_temp.o('e', 'C1-000011'))$$, 'offline con numero_impreso igual al número');
select pg_temp.como(pg_temp.i('v'));
-- Marcas: renumerada
select lives_ok($$select public.registrar_venta(pg_temp.v1('M8', 'C1-000013', 1), pg_temp.o('v', 'C1-000012'))$$, 'offline renumerada: número distinto del impreso');
-- QR pendiente: solo offline
select throws_ok($$select public.registrar_venta(pg_temp.vp('Q0', 'C1-000014', 'P1', 10, pg_temp.pg('qr', 10, false)), 'null')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_offline JSON null = en línea: QR pendiente se rechaza');
select throws_ok($$select public.registrar_venta(pg_temp.vp('Q0', 'C1-000014', 'P1', 10, pg_temp.pg('qr', 10)), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline: QR sin verificado explícito se rechaza');
select lives_ok($$select public.registrar_venta(pg_temp.vp('Q1', 'C1-000014', 'P1', 10, pg_temp.pg('qr', 10, false)), pg_temp.o('v'))$$, 'offline: QR pendiente');
select lives_ok($$select public.registrar_venta(pg_temp.v('Q2', 'D1', 'S1', 'C1-000015', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 10), pg_temp.pg('qr', 10, true))), pg_temp.o('v'))$$, 'offline: QR ya verificado + efectivo');
select lives_ok($$select public.registrar_venta(pg_temp.vp('MQ', 'C1-000016', 'PN', 5, pg_temp.pg('qr', 5, false)), pg_temp.o('v'))$$, 'offline: sin precio + QR pendiente');
-- Siguen rechazando offline
select throws_ok($$select public.registrar_venta(pg_temp.v('H1', 'D1', 'S1', 'C1-000017', 21, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 21))), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline: total distinto del calculado');
select throws_ok($$select public.registrar_venta(pg_temp.v1('H1', 'C1-001700', 1), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline: salto de numeración');
select throws_ok($$select public.registrar_venta(pg_temp.v('H1', 'D1', 'SC', 'C1-000017', 10, jsonb_build_array(pg_temp.it('P1', 1, 10)), jsonb_build_array(pg_temp.pg('efectivo', 10))) || jsonb_build_object('creada_en_cliente', now() + interval '1 minute'), pg_temp.o('v'))$$, 'P0001', 'ERP_CAJA_CERRADA', 'offline: caja cerrada y venta hecha después del cierre (A2: antes del cierre sí se acepta)');
select throws_ok($$select public.registrar_venta(pg_temp.v('H1', 'D2', 'S1', 'C2-000001', 10, jsonb_build_array(pg_temp.it('P1', 1, 10)), jsonb_build_array(pg_temp.pg('efectivo', 10))), pg_temp.o('v'))$$, 'P0001', 'ERP_CAJA_CERRADA', 'offline: sesión de otro equipo');
select lives_ok($$select public.registrar_venta(pg_temp.v('SV1', 'D1', 'S1', 'C1-000017', 100, jsonb_build_array(pg_temp.it('PS', 1, 100) || jsonb_build_object('serie_id', pg_temp.i('SE1'))), jsonb_build_array(pg_temp.pg('efectivo', 100))), pg_temp.o('v'))$$, 'offline: venta con serie disponible');
select throws_ok($$select public.registrar_venta(pg_temp.v('SV2', 'D1', 'S1', 'C1-000018', 100, jsonb_build_array(pg_temp.it('PS', 1, 100) || jsonb_build_object('serie_id', pg_temp.i('SE1'))), jsonb_build_array(pg_temp.pg('efectivo', 100))), pg_temp.o('v'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'offline: la misma serie no se vende dos veces');

-- Marcas guardadas, una por caso
reset role;
select is(pg_temp.motivos('O1') || '|' || pg_temp.motivos('O4') || '|' || pg_temp.motivos('Q2'), '||', 'ventas offline limpias: sin marcas');
select is(pg_temp.motivos('M1'), 'producto_inactivo', 'marca producto_inactivo');
select is(pg_temp.motivos('M2'), 'sin_precio', 'marca sin_precio');
select is((select precio_lista_servidor is null from public.venta_items where venta_id = pg_temp.i('M2')), true, 'sin_precio: precio_lista_servidor nulo');
select is(pg_temp.motivos('M3'), 'sin_precio', 'lista sin precio y solo mínimo: sin descuento_sin_permiso (no hay piso)');
select is(pg_temp.motivos('M4'), 'descuento_sin_permiso', 'marca descuento_sin_permiso');
select is((select precio_lista_servidor from public.venta_items where venta_id = pg_temp.i('M4')), 10.00, 'con precio, precio_lista_servidor sigue guardado');
select is(pg_temp.motivos('M5'), 'descuento_sin_permiso,sobre_tope', 'descuento_sin_permiso y sobre_tope juntos, ordenados');
select is(pg_temp.motivos('M6'), 'sobre_tope', 'marca sobre_tope (con descontar no hay descuento_sin_permiso)');
select is(pg_temp.motivos('M7'), '', 'numero_impreso igual al número: sin marca');
select is(pg_temp.motivos('M8'), 'renumerada', 'marca renumerada');
select is(pg_temp.motivos('Q1'), '', 'QR pendiente no es motivo de revisión');
select is((select string_agg(medio || ':' || verificacion, ',' order by medio) from public.venta_pagos where venta_id = pg_temp.i('Q1')), 'qr:pendiente', 'QR offline false = pendiente');
select is((select string_agg(medio || ':' || verificacion, ',' order by medio) from public.venta_pagos where venta_id = pg_temp.i('Q2')), 'efectivo:no_aplica,qr:verificado', 'QR offline true = verificado');
select is((select count(*) from public.venta_pagos where verificado_por is not null or verificado_en is not null)::integer, 0, 'nadie verificó aún');
select is((select count(*) from public.ventas where origen = 'offline' and tipo_cambio <> 6.96)::integer, 0, 'toda venta offline guarda el tipo de cambio del vendedor');

-- DB-12: una venta offline deja stock negativo y sale en productos_stock_bajo
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.vp('N1', 'C1-000019', 'PD', 10, pg_temp.pg('efectivo', 10)), pg_temp.o('v'))$$, 'PD: venta offline 1 de 2');
select lives_ok($$select public.registrar_venta(pg_temp.v('N2', 'D1', 'S1', 'C1-000020', 40, jsonb_build_array(pg_temp.it('PD', 4, 10)), jsonb_build_array(pg_temp.pg('efectivo', 40))), pg_temp.o('v'))$$, 'PD: venta offline de 4 deja el stock en -3');
select is((select cantidad from public.stock where producto_id = pg_temp.i('PD')), -3.000, 'DB-12: stock negativo permitido');
select is((select cantidad from public.productos_stock_bajo(pg_temp.i('T')) where producto_id = pg_temp.i('PD')), -3.000, 'DB-12: aparece en productos_stock_bajo');
select pg_temp.como(pg_temp.i('c'));
select is((select count(*) from public.stock_inconsistente(pg_temp.i('T')))::integer, 0, 'stock = suma del kardex tras las ventas offline');
select is(pg_temp.motivos('N2'), '', 'el stock negativo no es una marca: sale por productos_stock_bajo');

-- Reconciliación: lista (ventas con marcas sin revisar o QR pendiente), permisos y paginación
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select * from public.reconciliacion_ventas(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no ve la reconciliación');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select * from public.reconciliacion_ventas(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'dueño de otro negocio no ve la reconciliación');
select is((select count(*) from public.reconciliacion_ventas(pg_temp.i('L')))::integer, 0, 'dueño de L ve su reconciliación vacía');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select * from public.reconciliacion_ventas(pg_temp.i('T'), 0)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'límite 0');
select throws_ok($$select * from public.reconciliacion_ventas(pg_temp.i('T'), 501)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'límite 501');
select throws_ok($$select * from public.reconciliacion_ventas(pg_temp.i('T'), 10, pg_temp.i('nadie'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_desde_id inexistente');
select is((select count(*) from public.reconciliacion_ventas(pg_temp.i('T'), 500))::integer, 10, 'contador ve las 10 ventas por revisar (O2, M1 a M6, M8, Q1, MQ)');
select is((select count(*) from public.reconciliacion_ventas(pg_temp.i('T'), 500)
  where id in (pg_temp.i('O1'), pg_temp.i('O3'), pg_temp.i('O4'), pg_temp.i('M7'), pg_temp.i('Q2'), pg_temp.i('N2'), pg_temp.i('SV1')))::integer, 0,
  'falsos positivos: ventas offline limpias y ventas en línea no entran');
select is((select motivos_revision::text || '/' || vendedor_id || '/' || enviada_por || '/' || total || '/' || (pagos_pendientes -> 0 ->> 'monto')
  from public.reconciliacion_ventas(pg_temp.i('T'), 500) where id = pg_temp.i('MQ')),
  '{sin_precio}/' || pg_temp.i('v') || '/' || pg_temp.i('v') || '/5.00/5.00', 'una fila trae marcas, vendedor, enviada_por, total y pagos pendientes');
select is((select vendedor_nombre || '/' || enviada_por_nombre from public.reconciliacion_ventas(pg_temp.i('T'), 500) where id = pg_temp.i('MQ')), 'v/v', 'trae los nombres');
select is((select jsonb_array_length(pagos_pendientes) from public.reconciliacion_ventas(pg_temp.i('T'), 500) where id = pg_temp.i('M4')), 0, 'sin QR pendiente: lista vacía');
select is((select count(*) from (select * from public.reconciliacion_ventas(pg_temp.i('T'), 4)) p1)::integer, 4, 'primera página de 4');
with p1 as (select * from public.reconciliacion_ventas(pg_temp.i('T'), 4)),
  p2 as (select * from public.reconciliacion_ventas(pg_temp.i('T'), 4, (select id from p1 order by recibida_en desc, id desc offset 3 limit 1))),
  p3 as (select * from public.reconciliacion_ventas(pg_temp.i('T'), 4, (select id from p2 order by recibida_en desc, id desc offset 3 limit 1)))
select is((select count(*) || '/' || count(distinct id) from (select id from p1 union all select id from p2 union all select id from p3) t), '10/10', 'tres páginas encadenadas recorren las 10 sin repetir');
select throws_ok($$select * from public.reconciliacion_ventas(pg_temp.i('T'), 10, pg_temp.i('SL'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_desde_id que no es una venta del negocio');

-- verificar_pago_qr
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('Q1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no verifica');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('Q1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'dueño de otro negocio no verifica');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.verificar_pago_qr(pg_temp.i('nadie'))$$, 'P0001', 'ERP_SIN_PERMISO', 'pago inexistente');
select throws_ok($$select public.verificar_pago_qr((select id from public.venta_pagos where venta_id = pg_temp.i('Q2') and medio = 'efectivo'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'un pago en efectivo no se verifica');
select is(public.verificar_pago_qr(pg_temp.pago_qr('Q1')) ->> 'verificacion', 'verificado', 'contador verifica un QR pendiente');
select is(public.verificar_pago_qr(pg_temp.pago_qr('Q1')) ->> 'verificacion', 'verificado', 'verificar de nuevo es idempotente');
select is(public.verificar_pago_qr(pg_temp.pago_qr('Q2')) ->> 'verificacion', 'verificado', 'un QR ya verificado devuelve igual');
select is((select verificado_por = pg_temp.i('c') and verificado_en is not null from public.venta_pagos where id = pg_temp.pago_qr('Q1')), true, 'queda quién y cuándo');
select is((select verificado_por is null from public.venta_pagos where id = pg_temp.pago_qr('Q2')), true, 'el verificado de origen no tiene verificador');
select is(pg_temp.en_lista('Q1'), false, 'verificado el QR, Q1 sale de la lista (no tiene marcas)');

-- revisar_venta
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.revisar_venta(pg_temp.i('M4'))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no revisa');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.revisar_venta(pg_temp.i('M4'))$$, 'P0001', 'ERP_SIN_PERMISO', 'dueño de otro negocio no revisa');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.revisar_venta(pg_temp.i('nadie'))$$, 'P0001', 'ERP_SIN_PERMISO', 'venta inexistente');
select throws_ok($$select public.revisar_venta(pg_temp.i('O1'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'una venta sin marcas no tiene nada que revisar');
select is(public.revisar_venta(pg_temp.i('M4')) ->> 'revisada_por', pg_temp.i('c')::text, 'contador revisa M4');
select is(public.revisar_venta(pg_temp.i('M4')) -> 'revisada_en', (select to_jsonb(revisada_en) from public.ventas where id = pg_temp.i('M4')), 'revisar de nuevo es idempotente y no cambia la hora');
select is(pg_temp.en_lista('M4'), false, 'revisada, M4 sale de la lista');
select is(public.revisar_venta(pg_temp.i('MQ')) ->> 'revisada_por', pg_temp.i('c')::text, 'MQ revisada');
select is(pg_temp.en_lista('MQ'), true, 'revisada pero con QR pendiente: sigue en la lista');
select is(public.verificar_pago_qr(pg_temp.pago_qr('MQ')) ->> 'verificacion', 'verificado', 'MQ: se verifica el QR');
select is(pg_temp.en_lista('MQ'), false, 'revisada y verificada: sale');
select is((select count(*) from public.reconciliacion_ventas(pg_temp.i('T'), 500))::integer, 7, 'quedan 7 por revisar');

-- Venta anulada: no entra a la lista y ya no se verifica ni se revisa
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.vp('A1', 'C1-000021', 'PN', 5, pg_temp.pg('qr', 5, false)), pg_temp.o('v'))$$, 'A1: offline, sin precio, QR pendiente');
select pg_temp.como(pg_temp.i('c'));
select is(pg_temp.en_lista('A1'), true, 'A1 entra a la lista');
select pg_temp.como(pg_temp.i('d'));
select is(public.anular_venta(pg_temp.i('A1'), 'error') ->> 'estado', 'anulada', 'A1 se anula');
select pg_temp.como(pg_temp.i('c'));
select is(pg_temp.en_lista('A1'), false, 'anulada: no entra a la lista');
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('A1'))$$, 'P0001', 'ERP_VENTA_ANULADA', 'no se verifica el QR de una venta anulada');
select throws_ok($$select public.revisar_venta(pg_temp.i('A1'))$$, 'P0001', 'ERP_VENTA_ANULADA', 'no se revisa una venta anulada');

-- tipo_cambio nulo o ausente: se guarda el del servidor. L no tiene tipos_cambio, así que queda null (la venta entra igual).
reset role;
insert into public.clientes (id, negocio_id, nombre) values (pg_temp.i('CL'), pg_temp.i('L'), 'CL');
create function pg_temp.vl(p_id text, p_num text) returns jsonb language sql as $$
  select pg_temp.v(p_id, 'DL', 'SL', p_num, 9, jsonb_build_array(pg_temp.it('PX', 1, 9)), jsonb_build_array(pg_temp.pg('efectivo', 9)))
    || jsonb_build_object('cliente_id', pg_temp.i('CL'))
$$;
select pg_temp.como(pg_temp.i('x'));
select lives_ok($$select public.registrar_venta(pg_temp.vl('TC1', 'L1-000001'), jsonb_build_object('vendedor_id', pg_temp.i('x'), 'tipo_cambio', null, 'numero_impreso', null))$$, 'negocio sin tipo de cambio: tipo_cambio null entra');
select lives_ok($$select public.registrar_venta(pg_temp.vl('TC2', 'L1-000002'), jsonb_build_object('vendedor_id', pg_temp.i('x')))$$, 'negocio sin tipo de cambio: tipo_cambio y numero_impreso ausentes entran');
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('TC3', 'C1-000022', 1), pg_temp.o('v', null, null))$$, 'T: tipo_cambio null en un negocio con tipo de cambio');
select lives_ok($$select public.registrar_venta(pg_temp.v1('TC4', 'C1-000023', 1), pg_temp.o('v', null, 6.5))$$, 'T: tipo_cambio del vendedor');
reset role;
select is((select string_agg(coalesce(tipo_cambio::text, 'null'), ',' order by numero) from public.ventas where id in (pg_temp.i('TC1'), pg_temp.i('TC2'))), 'null,null', 'sin tipos_cambio queda null');
select is((select tipo_cambio from public.ventas where id = pg_temp.i('TC3')), 7.0000, 'sin tipo_cambio de p_offline se usa el del servidor');
select is((select tipo_cambio from public.ventas where id = pg_temp.i('TC4')), 6.5000, 'con tipo_cambio de p_offline se guarda ese');

-- Permiso `descontar` de quien vendió, no de quien envía; otra_cuenta cuando difieren
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.vp('PD1', 'C1-000024', 'P1', 7.5, pg_temp.pg('efectivo', 7.5)), pg_temp.o('v'))$$, 'PD1: v (sin descontar) vendió bajo el piso y lo envía e (con descontar)');
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.vp('PD2', 'C1-000025', 'P1', 7.5, pg_temp.pg('efectivo', 7.5)), pg_temp.o('e'))$$, 'PD2: e (con descontar) vendió bajo el piso y lo envía v');
select throws_ok($$select public.registrar_venta(pg_temp.vp('PD3', 'C1-000026', 'P1', 7.5, pg_temp.pg('efectivo', 7.5)))$$, 'P0001', 'ERP_SIN_PERMISO', 'en línea sigue exigiendo descontar a quien envía');
reset role;
select is(pg_temp.motivos('PD1'), 'descuento_sin_permiso,otra_cuenta', 'PD1: el permiso se evalúa sobre quien vendió, no sobre quien envía');
select is(pg_temp.motivos('PD2'), 'otra_cuenta', 'PD2: e tiene descontar; solo otra_cuenta (poner al dueño como vendedor no esquiva la marca)');

-- QR rechazado: el QR nunca llegó
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.vp('R1', 'C1-000027', 'P1', 10, pg_temp.pg('qr', 10, false)), pg_temp.o('v'))$$, 'R1: offline con QR pendiente');
select pg_temp.como(pg_temp.i('c'));
select is(pg_temp.en_lista('R1'), true, 'R1 pendiente entra a la lista');
select is((public.resumen_caja(pg_temp.i('S1')) ->> 'qr_pendiente')::numeric, 10::numeric, 'resumen_caja: qr_pendiente = 10');
select set_config('t.qr_antes', (public.resumen_caja(pg_temp.i('S1')) ->> 'qr_neto'), true);
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('R1'), null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'p_cobrado null');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('R1'), false)$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no rechaza');
select pg_temp.como(pg_temp.i('c'));
select is(public.verificar_pago_qr(pg_temp.pago_qr('R1'), false) ->> 'verificacion', 'rechazado', 'contador rechaza un QR pendiente');
select is(public.verificar_pago_qr(pg_temp.pago_qr('R1'), false) ->> 'verificacion', 'rechazado', 'rechazar de nuevo es idempotente');
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('R1'))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'un QR rechazado no pasa a verificado');
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('Q1'), false)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'un QR verificado no pasa a rechazado');
select throws_ok($$select public.verificar_pago_qr(pg_temp.pago_qr('Q2'), false)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'ni el verificado de origen');
select is((select verificacion || '/' || (verificado_por = pg_temp.i('c'))::text || '/' || (verificado_en is not null)::text from public.venta_pagos where id = pg_temp.pago_qr('R1')), 'rechazado/true/true', 'queda quién y cuándo');
select is(pg_temp.en_lista('R1'), false, 'rechazado: sale de la lista (no tiene marcas)');
select is((public.resumen_caja(pg_temp.i('S1')) ->> 'qr_pendiente')::numeric, 0::numeric, 'resumen_caja: qr_pendiente baja a 0');
select is(current_setting('t.qr_antes')::numeric - (public.resumen_caja(pg_temp.i('S1')) ->> 'qr_neto')::numeric, 10::numeric, 'qr_neto (total_qr_sesion) no suma el rechazado');
select is((select estado from public.ventas where id = pg_temp.i('R1')), 'completada', 'la venta con QR rechazado sigue completada');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('DR1'), 'venta_id', pg_temp.i('R1'), 'dispositivo_id', pg_temp.i('D1'),
  'caja_sesion_id', pg_temp.i('S1'), 'medio', 'qr', 'motivo', 'm',
  'items', jsonb_build_array(jsonb_build_object('venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('R1')), 'cantidad', 1))))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'devolver_venta no devuelve a un QR rechazado (nunca entró)');

-- Inmutabilidad: solo cambian las marcas, de vacío a lleno
select pg_temp.como(pg_temp.i('c'));
select ok(has_column_privilege('authenticated', 'public.ventas', 'motivos_revision', 'SELECT')
  and has_column_privilege('authenticated', 'public.ventas', 'revisada_por', 'SELECT')
  and has_column_privilege('authenticated', 'public.venta_pagos', 'verificado_por', 'SELECT')
  and not has_column_privilege('authenticated', 'public.ventas', 'huella', 'SELECT'), 'las marcas se leen; la huella sigue oculta');
select throws_ok($$update public.ventas set motivos_revision = '{}' where id = pg_temp.i('M1')$$, '42501', null, 'authenticated no escribe las marcas directo');
reset role;
select throws_ok($$update public.ventas set motivos_revision = '{}' where id = pg_temp.i('M1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'las marcas de la venta no se borran');
select throws_ok($$update public.ventas set revisada_por = pg_temp.i('d'), revisada_en = now() where id = pg_temp.i('M4')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'la revisión no se reasigna');
select throws_ok($$update public.ventas set revisada_por = null, revisada_en = null where id = pg_temp.i('M4')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'la revisión no se deshace');
select throws_ok($$update public.ventas set revisada_por = pg_temp.i('d') where id = pg_temp.i('M1')$$, '23514', null, 'revisada_por y revisada_en van juntas');
select throws_ok($$update public.ventas set total = 99 where id = pg_temp.i('M1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'el total sigue inmutable');
select throws_ok($$update public.venta_pagos set monto = 1 where id = pg_temp.pago_qr('Q2')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'el monto del pago sigue inmutable');
select throws_ok($$update public.venta_pagos set verificacion = 'pendiente', verificado_por = null, verificado_en = null where id = pg_temp.pago_qr('Q1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'un pago verificado no vuelve a pendiente');
select throws_ok($$update public.venta_pagos set verificacion = 'verificado' where id = pg_temp.pago_qr('A1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'verificar sin quién no pasa');
select throws_ok($$update public.venta_pagos set verificacion = 'rechazado' where id = pg_temp.pago_qr('A1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'rechazar sin quién no pasa');
select throws_ok($$update public.venta_pagos set verificacion = 'verificado' where id = pg_temp.pago_qr('R1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'un pago rechazado no cambia por update directo');
select throws_ok($$delete from public.venta_pagos where id = pg_temp.pago_qr('Q1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'el pago no se borra');
select throws_ok($$update public.venta_pagos set verificado_por = pg_temp.i('c'), verificado_en = now() where id = pg_temp.pago_qr('MQ')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'quién verificó no se reasigna');
select is((select count(*) from public.stock s where negocio_id = pg_temp.i('T')
  and cantidad <> (select coalesce(sum(m.cantidad), 0) from public.movimientos_inventario m where m.producto_id = s.producto_id and m.ubicacion_id = s.ubicacion_id))::integer, 0, 'stock = suma del kardex al final');

select * from finish();
rollback;
