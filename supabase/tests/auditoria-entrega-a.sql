-- Hallazgos de base de la auditoría de la Entrega A (migración 20261108130000): A2, M3, M4, M5 y los bajos.
begin;
select plan(68);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9400' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- T: d y w dueños · e encargado · v vendedor · c contador · ina vendedor desactivado · L: x dueño, co contador
select pg_temp.crear_usuario(n) from (values ('d'), ('w'), ('e'), ('v'), ('c'), ('ina'), ('x'), ('co')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('w'), pg_temp.i('T'), 'dueno'),
  (pg_temp.i('e'), pg_temp.i('T'), 'encargado'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('ina'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('x'), pg_temp.i('L'), 'dueno'), (pg_temp.i('co'), pg_temp.i('L'), 'contador');
update public.perfiles set activo = false where id = pg_temp.i('ina');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('UT'), pg_temp.i('T'), 'UT', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('DT'), pg_temp.i('T'), pg_temp.i('UT'), 'DT', 'C1'), (pg_temp.i('DT2'), pg_temp.i('T'), pg_temp.i('UT'), 'DT2', 'C2'),
  (pg_temp.i('DT3'), pg_temp.i('T'), pg_temp.i('UT'), 'DT3', 'C3'), (pg_temp.i('DT4'), pg_temp.i('T'), pg_temp.i('UT'), 'DT4', 'C4'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
-- SC: sesión de DT cerrada por otro hace una hora (monto_esperado 0). ST: la abierta de DT. SL: la de lavandería.
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, abierta_en, monto_inicial, cerrada_en,
  usuario_cierre, monto_contado, monto_esperado, diferencia) values
  (pg_temp.i('SC'), pg_temp.i('T'), pg_temp.i('DT'), pg_temp.i('d'), now() - interval '3 hours', 0, now() - interval '1 hour',
   pg_temp.i('e'), 0, 0, 0);
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('ST'), pg_temp.i('T'), pg_temp.i('DT'), pg_temp.i('d'), 100),
  (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0);
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false),
  (pg_temp.i('P2'), pg_temp.i('T'), 'P2', 'P2', 'producto', 'unidad', false),
  (pg_temp.i('SV'), pg_temp.i('L'), 'SV', 'SV', 'servicio', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P1'), 'minimo', 8, 'BOB'),
  (pg_temp.i('L'), pg_temp.i('SV'), 'normal', 15, 'BOB'), (pg_temp.i('L'), pg_temp.i('SV'), 'express', 25, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('UT'), pg_temp.i('P1'), 'inicial', 20, 4),
  (pg_temp.i('T'), pg_temp.i('UT'), pg_temp.i('P2'), 'inicial', 5, 4);
insert into public.clientes (id, negocio_id, nombre, telefono) values (pg_temp.i('CL'), pg_temp.i('L'), 'Cliente', '70011122');

-- Venta de 1 unidad de P1 a 10 en el equipo DT, de la sesión dada, hecha hace p_min minutos.
create function pg_temp.vt(p_id text, p_sesion text, p_num text, p_min integer, p_pagos jsonb default null) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('DT'), 'caja_sesion_id', pg_temp.i(p_sesion),
    'numero', p_num, 'creada_en_cliente', now() - make_interval(mins => p_min), 'total', 10,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'lista', 'contado', 'cantidad', 1, 'precio_unitario', 10)),
    'pagos', coalesce(p_pagos, jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 10))))
$$;
create function pg_temp.off(p_vend text) returns jsonb language sql as $$
  select jsonb_build_object('vendedor_id', pg_temp.i(p_vend), 'tipo_cambio', null, 'numero_impreso', null)
$$;
create function pg_temp.motivos(p_id text) returns text language sql as $$
  select array_to_string(motivos_revision, ',') from public.ventas where id = pg_temp.i(p_id)
$$;
create function pg_temp.dia(p_dias integer) returns text language sql as $$
  select to_char((now() at time zone 'utc')::date - p_dias, 'YYYY-MM-DD') || 'T10:00:00Z'
$$;
create function pg_temp.oc(p_usuario text, p_creada text) returns jsonb language sql as $$
  select jsonb_build_object('creada_en', p_creada, 'usuario_id', pg_temp.i(p_usuario))
$$;
create function pg_temp.ahora(p_min integer) returns text language sql as $$
  select to_char((now() - make_interval(mins => p_min)) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;

-- A2: venta offline hecha antes de que otro cerrara la caja
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.vt('A2a', 'SC', 'C1-000001', 90), pg_temp.off('v'))$$,
  'A2: venta offline hecha antes del cierre se acepta en la sesión cerrada');
select is(pg_temp.motivos('A2a'), 'caja_cerrada', 'A2: queda marcada caja_cerrada');
select is((select caja_sesion_id from public.ventas where id = pg_temp.i('A2a')), pg_temp.i('SC'), 'A2: queda en la sesión cerrada');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1')), 19.000, 'A2: descuenta el stock');
select is((select monto_esperado || '/' || diferencia from public.caja_sesiones where id = pg_temp.i('SC')), '0.00/0.00', 'A2: la sesión cerrada no se muta');
select throws_ok($$select public.registrar_venta(pg_temp.vt('A2b', 'SC', 'C1-000002', 90))$$, 'P0001', 'ERP_CAJA_CERRADA',
  'A2: en línea sigue rechazando');
select throws_ok($$select public.registrar_venta(pg_temp.vt('A2b', 'SC', 'C1-000002', 30), pg_temp.off('v'))$$, 'P0001', 'ERP_CAJA_CERRADA',
  'A2: offline hecha después del cierre se rechaza');
select pg_temp.como(pg_temp.i('c'));
select is((select count(*) from public.reconciliacion_ventas(pg_temp.i('T'), 50) where id = pg_temp.i('A2a'))::integer, 1,
  'A2: aparece en la reconciliación');
select pg_temp.como(pg_temp.i('v'));
select is(public.registrar_movimiento_caja(pg_temp.i('A2m'), pg_temp.i('SC'), 'ingreso', 5, 'tarde', pg_temp.oc('v', pg_temp.ahora(90))),
  pg_temp.i('A2m'), 'A2: movimiento offline hecho antes del cierre se acepta');
select is((select array_to_string(motivos_revision, ',') from public.caja_movimientos where id = pg_temp.i('A2m')), 'caja_cerrada',
  'A2: el movimiento queda marcado caja_cerrada');
select throws_ok($$select public.registrar_movimiento_caja(pg_temp.i('A2n'), pg_temp.i('SC'), 'ingreso', 5, 'x', pg_temp.oc('v', pg_temp.ahora(30)))$$,
  'P0001', 'ERP_CAJA_CERRADA', 'A2: movimiento offline posterior al cierre se rechaza');
select throws_ok($$select public.registrar_movimiento_caja(pg_temp.i('A2o'), pg_temp.i('SC'), 'ingreso', 5, 'x')$$,
  'P0001', 'ERP_CAJA_CERRADA', 'A2: movimiento en línea sobre sesión cerrada se rechaza');

-- M3: el vendedor ya no anula
select is((select count(*) from public.rol_permisos where permiso = 'anular' and rol in ('vendedor', 'empleado'))::integer, 0,
  'M3: la matriz no da anular a vendedor ni empleado');
select lives_ok($$select public.registrar_venta(pg_temp.vt('M3a', 'ST', 'C1-000003', 0))$$, 'M3: venta del vendedor');
select throws_ok($$select public.anular_venta(pg_temp.i('M3a'), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'M3: el vendedor no anula');
select pg_temp.como(pg_temp.i('e'));
select is(public.anular_venta(pg_temp.i('M3a'), 'x') ->> 'estado', 'anulada', 'M3: el encargado sí anula');

-- M4: esperado solo con ver_reportes
select pg_temp.como(pg_temp.i('v'));
select is(public.resumen_caja(pg_temp.i('ST')) -> 'esperado', 'null'::jsonb, 'M4: el vendedor (caja) recibe esperado null');
select pg_temp.como(pg_temp.i('e'));
select is((public.resumen_caja(pg_temp.i('ST')) ->> 'esperado')::numeric, 100::numeric, 'M4: el encargado (ver_reportes) lo recibe');

-- M5: caja offline. Un miembro nunca se rechaza (se acepta y se marca); un no miembro sí.
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.abrir_caja(pg_temp.i('M5z'), pg_temp.i('T'), pg_temp.i('DT2'), 10, pg_temp.oc('x', pg_temp.dia(1)))$$,
  'P0001', 'ERP_SIN_PERMISO', 'M5: abrir offline con un no miembro se rechaza');
select is(public.abrir_caja(pg_temp.i('M5c'), pg_temp.i('T'), pg_temp.i('DT2'), 10, pg_temp.oc('c', pg_temp.dia(1))), pg_temp.i('M5c'),
  'M5: abrir offline con un miembro sin caja (contador) se acepta');
select is((select array_to_string(motivos_revision, ',') from public.caja_sesiones where id = pg_temp.i('M5c')), 'usuario_sin_permiso', 'M5: marcada usuario_sin_permiso');
select is(public.abrir_caja(pg_temp.i('M5i'), pg_temp.i('T'), pg_temp.i('DT3'), 10, pg_temp.oc('ina', pg_temp.dia(1))), pg_temp.i('M5i'),
  'M5: abrir offline con un miembro desactivado se acepta');
select is(public.abrir_caja(pg_temp.i('M5a'), pg_temp.i('T'), pg_temp.i('DT4'), 10, pg_temp.oc('v', pg_temp.dia(40))), pg_temp.i('M5a'),
  'M5: abrir offline con hora de hace 40 días se acepta');
select is((select array_to_string(motivos_revision, ',') || '/' || (abierta_en >= now() - interval '30 days 1 minute')::text from public.caja_sesiones where id = pg_temp.i('M5a')),
  'fecha_fuera_de_rango/true', 'M5: marcada fecha_fuera_de_rango y la hora queda en hoy - 30 días');
select throws_ok($$select public.registrar_movimiento_caja(pg_temp.i('M5m'), pg_temp.i('ST'), 'ingreso', 5, 'x', pg_temp.oc('x', pg_temp.dia(1)))$$,
  'P0001', 'ERP_SIN_PERMISO', 'M5: movimiento offline de un no miembro se rechaza');
select is(public.registrar_movimiento_caja(pg_temp.i('M5n'), pg_temp.i('ST'), 'ingreso', 5, 'x', pg_temp.oc('c', pg_temp.ahora(5))), pg_temp.i('M5n'),
  'M5: movimiento offline de un miembro sin caja se acepta');
select is((select array_to_string(motivos_revision, ',') from public.caja_movimientos where id = pg_temp.i('M5n')), 'usuario_sin_permiso', 'M5: movimiento marcado usuario_sin_permiso');
select is(public.registrar_movimiento_caja(pg_temp.i('M5o'), pg_temp.i('ST'), 'ingreso', 5, 'x', pg_temp.oc('v', pg_temp.dia(35))), pg_temp.i('M5o'),
  'M5: movimiento offline de hace 35 días se acepta');
select is((select array_to_string(motivos_revision, ',') from public.caja_movimientos where id = pg_temp.i('M5o')), 'fecha_fuera_de_rango', 'M5: movimiento marcado fecha_fuera_de_rango');
select throws_ok($$select public.registrar_movimiento_caja(pg_temp.i('M5g'), pg_temp.i('ST'), 'gasto', 500, 'x')$$,
  'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'M5: en línea un gasto sobre el esperado se rechaza');
select is(public.registrar_movimiento_caja(pg_temp.i('M5h'), pg_temp.i('ST'), 'gasto', 20, 'x', pg_temp.oc('v', pg_temp.ahora(10))),
  pg_temp.i('M5h'), 'M5: offline, un gasto dentro del esperado se acepta');
select is((select array_to_string(motivos_revision, ',') from public.caja_movimientos where id = pg_temp.i('M5h')), '', 'M5: sin marca');
select is(public.registrar_movimiento_caja(pg_temp.i('M5g'), pg_temp.i('ST'), 'gasto', 500, 'x', pg_temp.oc('v', pg_temp.ahora(10))),
  pg_temp.i('M5g'), 'M5: offline, un gasto sobre el esperado se acepta');
select is((select array_to_string(motivos_revision, ',') from public.caja_movimientos where id = pg_temp.i('M5g')), 'efectivo_insuficiente',
  'M5: queda marcado efectivo_insuficiente');

-- Bajos: devolución sobre un QR rechazado. Venta de 10 = 5 efectivo + 5 QR (offline, pendiente) y se rechaza el QR.
select lives_ok($$select public.registrar_venta(pg_temp.vt('Q1', 'ST', 'C1-000004', 5, jsonb_build_array(
  jsonb_build_object('medio', 'efectivo', 'monto', 5), jsonb_build_object('medio', 'qr', 'monto', 5, 'verificado', false))), pg_temp.off('v'))$$,
  'venta con QR pendiente');
select pg_temp.como(pg_temp.i('c'));
select is(public.verificar_pago_qr((select id from public.venta_pagos where venta_id = pg_temp.i('Q1') and medio = 'qr'), false) ->> 'verificacion',
  'rechazado', 'el QR se rechaza');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('DQ1'), 'venta_id', pg_temp.i('Q1'), 'dispositivo_id', pg_temp.i('DT'),
  'caja_sesion_id', pg_temp.i('ST'), 'medio', 'qr', 'motivo', 'm', 'items', jsonb_build_array(jsonb_build_object(
    'venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('Q1')), 'cantidad', 1))))$$,
  'P0001', 'ERP_QR_RECHAZADO', 'devolver_venta: no devuelve lo cobrado por un QR rechazado (nunca entró)');

-- Bajos: bloqueos por uuid (el mismo orden que bloquear_stock)
select is((select count(*) from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('registrar_venta', 'guardar_precios', 'registrar_conteo', 'fijar_costos')
  and prosrc like '%(%->> ''producto_id'')::uuid%'
  and prosrc not like '%order by e ->> ''producto_id''%' and prosrc not like '%order by t.e ->> ''producto_id''%')::integer, 4,
  'bloqueos: las 4 RPC ordenan por producto_id como uuid');

-- Bajos: guardar_producto no activa series con stock
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('P2')::text, 'codigo', 'P2', 'nombre', 'P2', 'tipo', 'producto', 'controla_serie', true))$$,
  'P0001', 'ERP_SERIE_CON_STOCK', 'controla_serie con stock: rechazado');
reset role;
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario)
  values (pg_temp.i('T'), pg_temp.i('UT'), pg_temp.i('P2'), 'ajuste', -5, 4);
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('P2')::text, 'codigo', 'P2', 'nombre', 'P2', 'tipo', 'producto', 'controla_serie', true))$$,
  'controla_serie sin stock: se acepta');

-- Bajos: órdenes. El permiso se comprueba antes de bloquear nada (contador de L).
create function pg_temp.vl(p_id text, p_num text) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('DL'), 'caja_sesion_id', pg_temp.i('SL'),
    'numero', p_num, 'creada_en_cliente', now(), 'total', 30, 'cliente_id', pg_temp.i('CL'),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('SV'), 'lista', 'normal', 'cantidad', 2, 'precio_unitario', 15)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 30)))
$$;
select pg_temp.como(pg_temp.i('x'));
select lives_ok($$select public.crear_orden(pg_temp.vl('O1', 'L1-000001'),
  jsonb_build_object('express', false, 'prendas', 3, 'fecha_prometida', '2099-01-01'))$$, 'orden creada');
select pg_temp.como(pg_temp.i('co'));
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O1'), 'en_lavado')$$, 'P0001', 'ERP_SIN_PERMISO', 'cambiar_estado_orden sin permiso');
select throws_ok($$select public.entregar_orden(pg_temp.i('O1'), 'Juan', 'boleta')$$, 'P0001', 'ERP_SIN_PERMISO', 'entregar_orden sin permiso');
select throws_ok($$select public.anular_orden(pg_temp.i('O1'), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'anular_orden sin permiso');
select throws_ok($$select public.anular_orden(gen_random_uuid(), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'anular_orden inexistente');

-- Bajos: anular_venta sobre una orden entregada
select pg_temp.como(pg_temp.i('x'));
select public.cambiar_estado_orden(pg_temp.i('O1'), 'en_lavado');
select public.cambiar_estado_orden(pg_temp.i('O1'), 'lista');
select is(public.entregar_orden(pg_temp.i('O1'), 'Juan', 'boleta') ->> 'estado', 'entregada', 'orden entregada');
select throws_ok($$select public.anular_venta(pg_temp.i('O1'), 'x')$$, 'P0001', 'ERP_ORDEN_ENTREGADA', 'anular_venta de una orden entregada');

-- Bajos: stock sin TRUNCATE
reset role;
select throws_ok($$truncate public.stock$$, 'P0001', 'ERP_SOLO_AGREGAR', 'stock: TRUNCATE rechazado');

-- H1: A2 solo dentro de la sesión y con cierre reciente; reversa por ver_reportes
reset role;
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, abierta_en, monto_inicial, cerrada_en,
  usuario_cierre, monto_contado, monto_esperado, diferencia)
  values (pg_temp.i('SOLD'), pg_temp.i('T'), pg_temp.i('DT4'), pg_temp.i('d'), now() - interval '50 days', 0, now() - interval '40 days',
    pg_temp.i('e'), 0, 0, 0);
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.vt('H1a', 'SC', 'C1-000010', 90), '{creada_en_cliente}', to_jsonb(now() - interval '5 hours')), pg_temp.off('v'))$$,
  'P0001', 'ERP_CAJA_CERRADA', 'H1: hora anterior a abierta_en se rechaza');
select throws_ok($$select public.registrar_movimiento_caja(pg_temp.i('H1m'), pg_temp.i('SC'), 'ingreso', 5, 'x', pg_temp.oc('v', pg_temp.ahora(300)))$$,
  'P0001', 'ERP_CAJA_CERRADA', 'H1: movimiento anterior a abierta_en se rechaza');
select throws_ok($$select public.registrar_movimiento_caja(pg_temp.i('H1o'), pg_temp.i('SOLD'), 'ingreso', 5, 'x', pg_temp.oc('v', pg_temp.dia(45)))$$,
  'P0001', 'ERP_CAJA_CERRADA', 'H1: sesión cerrada hace más de 30 días se rechaza');
select throws_ok($$select public.anular_venta(pg_temp.i('A2a'), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'H1: el vendedor no anula una venta caja_cerrada');
select pg_temp.como(pg_temp.i('e'));
select is(public.anular_venta(pg_temp.i('A2a'), 'revisada') ->> 'estado', 'anulada', 'H1: el encargado anula una venta caja_cerrada de sesión cerrada');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('UT')) >= 19, true, 'H1: el stock vuelve');

-- Revisión de la caja
select is((select count(*) from public.reconciliacion_caja(pg_temp.i('T')) where id = pg_temp.i('M5c'))::integer, 1, 'revisión: la apertura marcada aparece');
select is((select count(*) from public.reconciliacion_caja(pg_temp.i('T')) where id = pg_temp.i('M5n'))::integer, 1, 'revisión: el movimiento marcado aparece');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.revisar_caja('apertura', pg_temp.i('M5c'))$$, 'P0001', 'ERP_SIN_PERMISO', 'revisión: el vendedor no revisa');
select throws_ok($$select public.reconciliacion_caja(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'revisión: el vendedor no lista');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.revisar_caja('movimiento', pg_temp.i('M5h'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'revisión: sin marcas no hay nada que revisar');
select is(public.revisar_caja('apertura', pg_temp.i('M5c')) ->> 'tipo', 'apertura', 'revisión: el encargado revisa la apertura');
select is(public.revisar_caja('apertura', pg_temp.i('M5c')) ->> 'tipo', 'apertura', 'revisión: repetir es idempotente');
select is(public.revisar_caja('movimiento', pg_temp.i('M5n')) ->> 'tipo', 'movimiento', 'revisión: el encargado revisa el movimiento');
select is((select count(*) from public.reconciliacion_caja(pg_temp.i('T')) where id in (pg_temp.i('M5c'), pg_temp.i('M5n')))::integer, 0, 'revisión: salen de la lista');

-- M4: sin ver_reportes todos los términos del esperado van en null
select pg_temp.como(pg_temp.i('v'));
select is((select (r -> 'ventas_efectivo')::text || (r -> 'ingresos')::text || (r -> 'gastos')::text || (r -> 'retiros')::text
  || (r -> 'devoluciones_efectivo')::text || (r -> 'qr_neto')::text from (select public.resumen_caja(pg_temp.i('ST')) r) q),
  'nullnullnullnullnullnull', 'M4: el vendedor recibe nulos en todos los términos');

reset role;
-- Bajos: dos dueños no dejan a T sin dueño activo
update auth.users set banned_until = now() + interval '100 years' where id = pg_temp.i('d');
select is((select activo from public.perfiles where id = pg_temp.i('d')), false, 'dueño: con otro dueño activo, d se desactiva');
select throws_ok($$update auth.users set banned_until = now() + interval '100 years' where id = pg_temp.i('w')$$,
  'P0001', 'ERP_ULTIMO_DUENO', 'dueño: el último dueño activo no se desactiva');
select is((select activo from public.perfiles where id = pg_temp.i('w')), true, 'dueño: w sigue activo');
update auth.users set banned_until = null where id = pg_temp.i('d');
select is((select activo from public.perfiles where id = pg_temp.i('d')), true, 'dueño: reactivar no tiene restricción');

select * from finish();
rollback;
