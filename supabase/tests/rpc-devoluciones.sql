-- anular_venta, devolver_venta y el cierre de caja con ventas. Cubre DB-05, DB-06, DB-14, DB-15, idempotencia,
-- efectivo insuficiente y stock = suma del kardex.
begin;
select plan(117);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
-- Atajo de ids: cualquier nombre -> uuid estable
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8000' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- Usuarios: d dueño de T · e encargado de T · v vendedor de T · c contador de T · x dueño de L
select pg_temp.crear_usuario(n) from (values ('d'), ('e'), ('v'), ('c'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('e'), pg_temp.i('T'), 'encargado'),
  (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'), (pg_temp.i('c'), pg_temp.i('T'), 'contador'),
  (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'),
  (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('D3'), pg_temp.i('T'), pg_temp.i('U1'), 'D3', 'C3'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
-- Sesiones abiertas: S1 en D1 (100), S2 en D2 (50), S3 en D3 (0), SL en DL (0). SC: cerrada en D1 (antes de S1 no cabe: se crea cerrada con otro equipo libre).
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 50),
  (pg_temp.i('S3'), pg_temp.i('T'), pg_temp.i('D3'), pg_temp.i('d'), 0),
  (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0);
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial, cerrada_en, usuario_cierre,
  monto_contado, monto_esperado, diferencia) values
  (pg_temp.i('SC'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 0, now(), pg_temp.i('d'), 0, 0, 0);
-- Productos T: P1 unidad (contado 10, minimo 8) · PK kg (20) · PS serie (100) · PN sin precio · PU en USD (5) · PV servicio · P2 unidad (3.5)
-- Producto L: PLV servicio (15). PX: de L, unidad.
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false),
  (pg_temp.i('PK'), pg_temp.i('T'), 'PK', 'PK', 'producto', 'kg', false),
  (pg_temp.i('PS'), pg_temp.i('T'), 'PS', 'PS', 'producto', 'unidad', true),
  (pg_temp.i('PN'), pg_temp.i('T'), 'PN', 'PN', 'producto', 'unidad', false),
  (pg_temp.i('PU'), pg_temp.i('T'), 'PU', 'PU', 'producto', 'unidad', false),
  (pg_temp.i('PV'), pg_temp.i('T'), 'PV', 'PV', 'servicio', 'unidad', false),
  (pg_temp.i('P2'), pg_temp.i('T'), 'P2', 'P2', 'producto', 'unidad', false),
  (pg_temp.i('PLV'), pg_temp.i('L'), 'PLV', 'PLV', 'servicio', 'unidad', false),
  (pg_temp.i('PX'), pg_temp.i('L'), 'PX', 'PX', 'producto', 'unidad', false);
insert into public.tipos_cambio (negocio_id, valor) values (pg_temp.i('T'), 7);
insert into public.clientes (id, negocio_id, nombre) values (pg_temp.i('CL'), pg_temp.i('L'), 'CL');
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P1'), 'minimo', 8, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PK'), 'contado', 20, 'BOB'), (pg_temp.i('T'), pg_temp.i('PS'), 'contado', 100, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PU'), 'contado', 5, 'USD'), (pg_temp.i('T'), pg_temp.i('PV'), 'contado', 30, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('P2'), 'contado', 3.5, 'BOB'), (pg_temp.i('T'), pg_temp.i('P1'), 'credito', 12, 'BOB'),
  (pg_temp.i('L'), pg_temp.i('PLV'), 'contado', 15, 'BOB'), (pg_temp.i('L'), pg_temp.i('PX'), 'contado', 9, 'BOB');
-- Stock inicial con costo: P1 100 a 4 · PK 50 a 12 · PS 5 a 60 (con 5 series) · P2 100 a 1 · PU 10 a 20
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PK'), 'inicial', 50, 12),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PS'), 'inicial', 5, 60),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P2'), 'inicial', 100, 1),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PU'), 'inicial', 10, 20);
insert into public.series (id, negocio_id, producto_id, serie, ubicacion_id)
select pg_temp.i('SE' || n), pg_temp.i('T'), pg_temp.i('PS'), 'SN' || n, pg_temp.i('U1') from generate_series(1, 5) n;

-- Payload: v(id, equipo, caja, numero, total, items, pagos, extra)
create function pg_temp.it(p_prod text, p_cant numeric, p_precio numeric, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('producto_id', pg_temp.i(p_prod), 'lista', 'contado', 'cantidad', p_cant, 'precio_unitario', p_precio) || p_extra
$$;
create function pg_temp.pg(p_medio text, p_monto numeric, p_verif boolean default null) returns jsonb language sql as $$
  select jsonb_build_object('medio', p_medio, 'monto', p_monto) || case when p_verif is null then '{}' else jsonb_build_object('verificado', p_verif) end
$$;
create function pg_temp.v(p_id text, p_disp text, p_caja text, p_num text, p_total numeric, p_items jsonb, p_pagos jsonb,
  p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i(p_disp), 'caja_sesion_id', pg_temp.i(p_caja),
    'numero', p_num, 'creada_en_cliente', now(), 'total', p_total, 'items', p_items, 'pagos', p_pagos) || p_extra
$$;
-- Venta simple de n unidades de P1 a 10 en efectivo
create function pg_temp.v1(p_id text, p_disp text, p_caja text, p_num text, p_n numeric) returns jsonb language sql as $$
  select pg_temp.v(p_id, p_disp, p_caja, p_num, p_n * 10, jsonb_build_array(pg_temp.it('P1', p_n, 10)),
    jsonb_build_array(pg_temp.pg('efectivo', p_n * 10)))
$$;
create function pg_temp.item(p_venta text) returns uuid language sql as $$
  select id from public.venta_items where venta_id = pg_temp.i(p_venta) order by linea limit 1
$$;
create function pg_temp.di(p_venta text, p_cant numeric) returns jsonb language sql as $$
  select jsonb_build_object('venta_item_id', pg_temp.item(p_venta), 'cantidad', p_cant)
$$;
create function pg_temp.dv(p_id text, p_venta text, p_disp text, p_caja text, p_medio text, p_motivo text, p_items jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'venta_id', pg_temp.i(p_venta), 'dispositivo_id', pg_temp.i(p_disp),
    'caja_sesion_id', pg_temp.i(p_caja), 'medio', p_medio, 'motivo', p_motivo, 'items', p_items)
$$;
create function pg_temp.mov(p_m text, p_s text, p_tipo text, p_monto numeric) returns uuid language sql as $$
  select public.registrar_movimiento_caja(pg_temp.i(p_m), pg_temp.i(p_s), p_tipo, p_monto, 'test')
$$;

select ok(has_function_privilege('authenticated', 'public.anular_venta(uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.devolver_venta(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.devolver_venta(jsonb)', 'EXECUTE'), 'anular y devolver: authenticated sí, anon no');

-- A. Cierre con pagos mixtos, gasto, retiro, devolución en efectivo y venta anulada (DB-06). S2: inicial 50.
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VA', 'D2', 'S2', 'C2-000001', 50,
  jsonb_build_array(pg_temp.it('P1', 3, 10), pg_temp.it('PK', 1, 20)),
  jsonb_build_array(pg_temp.pg('efectivo', 30), pg_temp.pg('qr', 20, true))))$$, 'venta con pago mixto');
select lives_ok($$select public.registrar_venta(pg_temp.v1('VB', 'D2', 'S2', 'C2-000002', 4))$$, 'venta que se anulará');
select lives_ok($$select public.registrar_venta(pg_temp.v1('VC', 'D2', 'S2', 'C2-000003', 1))$$, 'venta para anular tras el cierre');
select lives_ok($$select pg_temp.mov('M1', 'S2', 'ingreso', 10)$$, 'ingreso');
select lives_ok($$select pg_temp.mov('M2', 'S2', 'gasto', 5)$$, 'gasto');
select lives_ok($$select pg_temp.mov('M3', 'S2', 'retiro', 5)$$, 'retiro');
select is(public.anular_venta(pg_temp.i('VB'), 'Error de cajero')->>'estado', 'anulada', 'anular VB');
select is((select estado || '/' || motivo_anulacion || '/' || (anulada_por = pg_temp.i('e'))::text from public.ventas where id = pg_temp.i('VB')), 'anulada/Error de cajero/true', 'estado, motivo y usuario de anulación');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1')), 100.000 - 3 - 1, 'stock: VA y VC vendidos, VB repuesto');
select is((select string_agg(tipo || ':' || cantidad, ',' order by tipo) from public.movimientos_inventario where ref_id = pg_temp.i('VB')), 'anulacion_venta:4.000,venta:-4.000', 'venta y contramovimiento en el kardex');
select lives_ok($$select public.devolver_venta(pg_temp.dv('DA', 'VA', 'D2', 'S2', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VA', 1))))$$, 'devolución de 1 en efectivo');
select is((select monto from public.devoluciones where id = pg_temp.i('DA')), 10.00, 'monto = lo cobrado por la unidad');
select is(public.cerrar_caja(pg_temp.i('S2'), 80), '{"monto_esperado": 80, "diferencia": 0, "total_qr": 20}'::jsonb,
  'esperado = 50 + (30 VA + 10 VC) + 10 - 5 - 5 - 10 devuelto (sin VB anulada, sin QR); total_qr aparte');
select is(public.cerrar_caja(pg_temp.i('S2'), 80), '{"monto_esperado": 80, "diferencia": 0, "total_qr": 20}'::jsonb, 'el reenvío del cierre también trae total_qr');
select throws_ok($$select public.anular_venta(pg_temp.i('VC'), 'tarde')$$, 'P0001', 'ERP_CAJA_CERRADA', 'no se anula con la caja de la venta cerrada');
select throws_ok($$select public.registrar_venta(pg_temp.v1('VZ', 'D2', 'S2', 'C2-000004', 1))$$, 'P0001', 'ERP_CAJA_CERRADA', 'no se vende en la sesión cerrada');
select throws_ok($$select public.devolver_venta(pg_temp.dv('DZ', 'VA', 'D2', 'S2', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VA', 1))))$$, 'P0001', 'ERP_CAJA_CERRADA', 'no se devuelve contra una sesión cerrada');

-- B. Anulación: permisos, validación e idempotencia (DB-05)
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.anular_venta(pg_temp.i('VB'), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'sin anular no anula (contador)');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.anular_venta(pg_temp.i('VB'), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no anula');
select throws_ok($$select public.anular_venta(pg_temp.i('nadie'), 'x')$$, 'P0001', 'ERP_SIN_PERMISO', 'venta inexistente');
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('VN', 'D1', 'S1', 'C1-000001', 5))$$, 'venta a anular');
select throws_ok($$select public.anular_venta(pg_temp.i('VN'), '  ')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo vacío');
select throws_ok($$select public.anular_venta(pg_temp.i('VN'), repeat('a', 201))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo de 201 caracteres');
select is((select estado from public.ventas where id = pg_temp.i('VN')), 'completada', 'los rechazos no anulan');
select lives_ok($$select public.anular_venta(pg_temp.i('VN'), 'Duplicada')$$, 'anula');
select is(public.anular_venta(pg_temp.i('VN'), ' Duplicada ')->>'estado', 'anulada', 'repetir con el mismo motivo devuelve igual');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('VN') and tipo = 'anulacion_venta')::integer, 1, 'un solo contramovimiento');
select throws_ok($$select public.anular_venta(pg_temp.i('VN'), 'Otro')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'ya anulada con otro motivo');
select throws_ok($$select public.devolver_venta(pg_temp.dv('DN', 'VN', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VN', 1))))$$, 'P0001', 'ERP_VENTA_ANULADA', 'venta anulada no se devuelve');

-- C. Devolución parcial: prorrateo y el resto en la última (VR: 3 x 3.5 - 0.5 = 10.00)
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VR', 'D1', 'S1', 'C1-000002', 10, jsonb_build_array(pg_temp.it('P2', 3, 3.5, '{"descuento": 0.5}')), jsonb_build_array(pg_temp.pg('efectivo', 10))))$$, 'venta con descuento');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 4))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'más de lo vendido');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 0))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad 0');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 1.5))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad decimal en unidad');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'cheque', 'x', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'medio inválido');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'efectivo', ' ', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo vacío');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 1))) || '{"otro": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'DL', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'equipo de otro negocio');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S2', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'P0001', 'ERP_CAJA_CERRADA', 'sesión que no es la abierta del equipo');
select lives_ok($$select public.devolver_venta(pg_temp.dv('R1', 'VR', 'D1', 'S1', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'primera devolución');
select lives_ok($$select public.devolver_venta(pg_temp.dv('R2', 'VR', 'D1', 'S1', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'segunda');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R0', 'VR', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VR', 2))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'no más de lo vendido menos lo devuelto');
select lives_ok($$select public.devolver_venta(pg_temp.dv('R3', 'VR', 'D1', 'S1', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'tercera completa la línea');
select is((select string_agg(monto::text, ',' order by monto) from (select monto from public.devoluciones where venta_id = pg_temp.i('VR')) q), '3.33,3.33,3.34', 'el último toma el resto: sin perder centavos');
select is((select sum(monto) from public.devoluciones where venta_id = pg_temp.i('VR')), 10.00, 'suma devuelta = lo cobrado');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P2')), 100.000, 'stock de P2 repuesto');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('R1') and tipo = 'devolucion_cliente' and ubicacion_id = pg_temp.i('U1'))::integer, 1, 'movimiento devolucion_cliente en la ubicación del equipo');
select throws_ok($$select public.anular_venta(pg_temp.i('VR'), 'x')$$, 'P0001', 'ERP_VENTA_CON_DEVOLUCIONES', 'no se anula una venta con devoluciones');

-- D. Idempotencia de la devolución
select is(public.devolver_venta(pg_temp.dv('R1', 'VR', 'D1', 'S1', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VR', 1))))->>'monto', '3.33', 'reenvío igual devuelve lo original');
select is((select count(*) from public.devolucion_items where devolucion_id = pg_temp.i('R1'))::integer, 1, 'sin duplicar');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R1', 'VR', 'D1', 'S1', 'efectivo', 'Otro motivo', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro motivo');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R1', 'VR', 'D1', 'S1', 'qr', 'Defecto', jsonb_build_array(pg_temp.di('VR', 1))))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro medio');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R1', 'VR', 'D1', 'S1', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VR', 2))))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otra cantidad');
select pg_temp.como(pg_temp.i('x'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VL', 'DL', 'SL', 'L1-000001', 15, jsonb_build_array(pg_temp.it('PLV', 1, 15)), jsonb_build_array(pg_temp.pg('qr', 15, true)), jsonb_build_object('cliente_id', pg_temp.i('CL'))))$$, 'venta en L');
select is((public.devolver_venta(pg_temp.dv('DX', 'VL', 'DL', 'SL', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VL', 1))))->>'monto_efectivo')::numeric, 0::numeric, 'venta solo QR pedida en efectivo sale íntegra por QR');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R1', 'VL', 'DL', 'SL', 'qr', 'Defecto', jsonb_build_array(pg_temp.di('VL', 1))))$$, 'P0001', 'ERP_SIN_PERMISO', 'id de una devolución de otro negocio');
select throws_ok($$select public.devolver_venta(pg_temp.dv('R9', 'VR', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(jsonb_build_object('venta_item_id', pg_temp.i('nadie'), 'cantidad', 1))))$$, 'P0001', 'ERP_SIN_PERMISO', 'venta de otro negocio');
select is((select count(*) from public.devoluciones where negocio_id = pg_temp.i('T'))::integer, 0, 'RLS: x no ve devoluciones de T');
reset role;
select throws_ok($$update public.devoluciones set monto = 0 where id = pg_temp.i('R1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'devoluciones append-only');
select throws_ok($$delete from public.devolucion_items where devolucion_id = pg_temp.i('R1')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'devolucion_items append-only');

-- E. Plazo de 24 h (DB-14)
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('VP', 'D1', 'S1', 'C1-000003', 1))$$, 'venta que envejece');
reset role;
alter table public.ventas disable trigger ventas_inmutable;
update public.ventas set recibida_en = now() - interval '25 hours' where id = pg_temp.i('VP');
alter table public.ventas enable trigger ventas_inmutable;
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.devolver_venta(pg_temp.dv('DP', 'VP', 'D1', 'S1', 'efectivo', 'Tarde', jsonb_build_array(pg_temp.di('VP', 1))))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no devuelve fuera de plazo');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.devolver_venta(pg_temp.dv('DP', 'VP', 'D1', 'S1', 'efectivo', 'Tarde', jsonb_build_array(pg_temp.di('VP', 1))))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no devuelve');
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.devolver_venta(pg_temp.dv('DP', 'VP', 'D1', 'S1', 'efectivo', 'Tarde', jsonb_build_array(pg_temp.di('VP', 1))))$$, 'encargado devuelve fuera de plazo');

-- E2. anular_venta también respeta el plazo de 24 h (RN-08)
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.v1('VP2', 'D1', 'S1', 'C1-000012', 1))$$, 'otra venta que envejece');
reset role;
alter table public.ventas disable trigger ventas_inmutable;
update public.ventas set recibida_en = now() - interval '25 hours' where id = pg_temp.i('VP2');
alter table public.ventas enable trigger ventas_inmutable;
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.anular_venta(pg_temp.i('VP2'), 'Tarde')$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no anula fuera de plazo');
select pg_temp.como(pg_temp.i('e'));
select is(public.anular_venta(pg_temp.i('VP2'), 'Tarde')->>'estado', 'anulada', 'con devolver_fuera_plazo sí anula');
select pg_temp.como(pg_temp.i('e'));
select is(public.anular_venta(pg_temp.i('VP2'), 'Tarde')->>'estado', 'anulada', 'el reenvío idempotente sigue funcionando fuera de plazo');

-- F. Series (DB-15)
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VS', 'D1', 'S1', 'C1-000004', 100, jsonb_build_array(pg_temp.it('PS', 1, 100, jsonb_build_object('serie_id', pg_temp.i('SE3')))), jsonb_build_array(pg_temp.pg('efectivo', 100))))$$, 'venta con serie');
select lives_ok($$select public.devolver_venta(pg_temp.dv('DS', 'VS', 'D1', 'S1', 'efectivo', 'Defecto', jsonb_build_array(pg_temp.di('VS', 1))))$$, 'devolver la serie');
select is((select estado from public.series where id = pg_temp.i('SE3')), 'disponible', 'la serie vuelve a disponible');
select lives_ok($$select public.registrar_venta(pg_temp.v('VT', 'D1', 'S1', 'C1-000005', 100, jsonb_build_array(pg_temp.it('PS', 1, 100, jsonb_build_object('serie_id', pg_temp.i('SE3')))), jsonb_build_array(pg_temp.pg('efectivo', 100))))$$, 'la serie devuelta se vende de nuevo');
select lives_ok($$select public.anular_venta(pg_temp.i('VT'), 'Error')$$, 'anular la venta con serie');
select is((select estado from public.series where id = pg_temp.i('SE3')), 'disponible', 'anular libera la serie');

-- G. Efectivo insuficiente: S3 (inicial 0)
select lives_ok($$select public.registrar_venta(pg_temp.v1('VE', 'D3', 'S3', 'C3-000001', 3))$$, 'venta en efectivo 30');
select lives_ok($$select pg_temp.mov('M4', 'S3', 'retiro', 30)$$, 'retiro de todo el efectivo');
select throws_ok($$select public.anular_venta(pg_temp.i('VE'), 'x')$$, 'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'anular sin efectivo en caja');
select throws_ok($$select public.devolver_venta(pg_temp.dv('DE', 'VE', 'D3', 'S3', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VE', 1))))$$, 'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'devolver en efectivo sin efectivo en caja');
select is((select estado from public.ventas where id = pg_temp.i('VE')), 'completada', 'el rechazo no anula');
select is((select count(*) from public.devoluciones where venta_id = pg_temp.i('VE'))::integer, 0, 'el rechazo no devuelve');
select throws_ok($$select public.devolver_venta(pg_temp.dv('DE', 'VE', 'D3', 'S3', 'qr', 'x', jsonb_build_array(pg_temp.di('VE', 1))))$$, 'P0001', 'ERP_EFECTIVO_INSUFICIENTE', 'pedida por QR, una venta en efectivo sigue sacando efectivo');
select lives_ok($$select public.registrar_venta(pg_temp.v('VQ', 'D3', 'S3', 'C3-000002', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('qr', 20, true))))$$, 'venta por QR');
select lives_ok($$select public.devolver_venta(pg_temp.dv('DQ', 'VQ', 'D3', 'S3', 'qr', 'x', jsonb_build_array(pg_temp.di('VQ', 1))))$$, 'devolver por QR no toca el efectivo');
select is(public.cerrar_caja(pg_temp.i('S3'), 0), '{"monto_esperado": 0, "diferencia": 0, "total_qr": 10}'::jsonb, 'cierra con esperado 0; total_qr neto de la devolución QR');

-- H. Monto parcial por acumulado: 100 unidades con neto 29.60 (100 x 0.30 - 0.40)
reset role;
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PM'), pg_temp.i('T'), 'PM', 'PM', 'producto', 'unidad', false),
  (pg_temp.i('PB'), pg_temp.i('T'), 'PB', 'PB', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('PM'), 'contado', 0.30, 'BOB'), (pg_temp.i('T'), pg_temp.i('PB'), 'contado', 10, 'BOB');
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VF', 'D1', 'S1', 'C1-000006', 29.60, jsonb_build_array(pg_temp.it('PM', 100, 0.30, '{"descuento": 0.40}')), jsonb_build_array(pg_temp.pg('efectivo', 29.60))))$$, 'venta de 100 unidades con neto 29.60');
select lives_ok($$select public.devolver_venta(pg_temp.dv('F1', 'VF', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VF', 1))))$$, 'primera unidad');
select lives_ok($$select public.devolver_venta(pg_temp.dv('F2', 'VF', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VF', 1))))$$, 'segunda unidad');
select lives_ok($$select public.devolver_venta(pg_temp.dv('F3', 'VF', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VF', 1))))$$, 'tercera unidad');
select lives_ok($$select public.devolver_venta(pg_temp.dv('F4', 'VF', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VF', 97))))$$, 'las 97 restantes');
select is((select sum(monto) from public.devoluciones where venta_id = pg_temp.i('VF')), 29.60, 'la suma devuelta es exactamente el neto');
-- Línea con descuento 100%: monto 0
select lives_ok($$select public.registrar_venta(pg_temp.v('VG', 'D1', 'S1', 'C1-000007', 10,
  jsonb_build_array(pg_temp.it('PM', 2, 0.30, '{"descuento": 0.60}'), pg_temp.it('P1', 1, 10)), jsonb_build_array(pg_temp.pg('efectivo', 10))))$$, 'venta con una línea regalada');
select lives_ok($$select public.devolver_venta(pg_temp.dv('G1', 'VG', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VG', 2))))$$, 'devolver la línea de monto 0');
select is((select monto from public.devoluciones where id = pg_temp.i('G1')), 0.00, 'monto 0');

-- I. Reparto por medios: VM = 100 x 10 pagada con 600 efectivo + 400 qr, devuelta en dos veces
select lives_ok($$select public.registrar_venta(pg_temp.v('VM', 'D1', 'S1', 'C1-000008', 1000, jsonb_build_array(pg_temp.it('PB', 100, 10)),
  jsonb_build_array(pg_temp.pg('efectivo', 600), pg_temp.pg('qr', 400, true))))$$, 'venta mixta 600 + 400');
select lives_ok($$select public.devolver_venta(pg_temp.dv('M1', 'VM', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VM', 50))))$$, 'primera mitad, medio efectivo');
select lives_ok($$select public.devolver_venta(pg_temp.dv('M2', 'VM', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VM', 50))))$$, 'segunda mitad, medio efectivo');
select is((select monto_efectivo from public.devoluciones where id = pg_temp.i('M2')), 100.00, 'la segunda respeta lo ya devuelto en efectivo');
select is((select sum(monto_efectivo) from public.devoluciones where venta_id = pg_temp.i('VM')), 600.00, 'suma en efectivo = cobrado en efectivo');
select is((select sum(monto - monto_efectivo) from public.devoluciones where venta_id = pg_temp.i('VM')), 400.00, 'suma por QR = cobrado por QR');

-- J. total_qr neto: devolución QR de una venta de otra sesión (VA, S2) deja S1 en -20 tras cobrar y devolver 400
select lives_ok($$select public.devolver_venta(pg_temp.dv('Q1', 'VA', 'D1', 'S1', 'qr', 'x',
  jsonb_build_array(jsonb_build_object('venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('VA') and linea = 2), 'cantidad', 1))))$$, 'devolución QR de una venta de otra sesión');
reset role;
select is(public.total_qr_sesion(pg_temp.i('S1')), -20.00, 'total_qr de S1: 400 cobrados - 400 - 20 devueltos');

-- K. Una venta mixta de 1 unidad a 1000 (600 efectivo + 400 qr) se devuelve entera con cualquier medio preferido
reset role;
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PC'), pg_temp.i('T'), 'PC', 'PC', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('PC'), 'contado', 1000, 'BOB');
create temp table snap (ef numeric, qr numeric);
create function pg_temp.snap() returns void language sql as $$
  delete from snap;
  insert into snap select public.efectivo_esperado(pg_temp.i('S1')), public.total_qr_sesion(pg_temp.i('S1'))
$$;
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('KA', 'D1', 'S1', 'C1-000009', 1000, jsonb_build_array(pg_temp.it('PC', 1, 1000)),
  jsonb_build_array(pg_temp.pg('efectivo', 600), pg_temp.pg('qr', 400, true))))$$, 'venta mixta de 1 unidad');
reset role;
select pg_temp.snap();
select pg_temp.como(pg_temp.i('d'));
select is((public.devolver_venta(pg_temp.dv('KA1', 'KA', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('KA', 1))))->>'monto_efectivo')::numeric, 600::numeric, 'efectivo preferido: el resultado trae monto_efectivo 600');
reset role;
select is((select monto from public.devoluciones where id = pg_temp.i('KA1')), 1000.00, 'devuelve los 1000');
select is((select ef from snap) - public.efectivo_esperado(pg_temp.i('S1')), 600.00, 'efectivo_esperado baja exactamente 600');
select is((select qr from snap) - public.total_qr_sesion(pg_temp.i('S1')), 400.00, 'total_qr_sesion baja 400');

select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('KB', 'D1', 'S1', 'C1-000010', 1000, jsonb_build_array(pg_temp.it('PC', 1, 1000)),
  jsonb_build_array(pg_temp.pg('efectivo', 600), pg_temp.pg('qr', 400, true))))$$, 'otra venta mixta');
select lives_ok($$select public.devolver_venta(pg_temp.dv('KB1', 'KB', 'D1', 'S1', 'qr', 'x', jsonb_build_array(pg_temp.di('KB', 1))))$$, 'qr preferido');
reset role;
select is((select monto_efectivo from public.devoluciones where id = pg_temp.i('KB1')), 600.00, 'qr cubre 400; los 600 restantes salen en efectivo');

-- Venta solo QR de 1000 pedida en efectivo: no saca efectivo del cajón
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('KC', 'D1', 'S1', 'C1-000011', 1000, jsonb_build_array(pg_temp.it('PC', 1, 1000)),
  jsonb_build_array(pg_temp.pg('qr', 1000, true))))$$, 'venta solo QR de 1000');
reset role;
select pg_temp.snap();
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.devolver_venta(pg_temp.dv('KC1', 'KC', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('KC', 1))))$$, 'devolución pedida en efectivo');
reset role;
select is((select monto_efectivo from public.devoluciones where id = pg_temp.i('KC1')), 0.00, 'monto_efectivo 0');
select is((select ef from snap) - public.efectivo_esperado(pg_temp.i('S1')), 0.00, 'efectivo_esperado no cambia');

-- L. Devolver lo vendido fraccionado aunque el producto pase a controlar serie después
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VK', 'D1', 'S1', 'C1-000013', 30, jsonb_build_array(pg_temp.it('PK', 1.5, 20)), jsonb_build_array(pg_temp.pg('efectivo', 30))))$$, 'venta de 1.5 kg');
reset role;
update public.productos set controla_serie = true where id = pg_temp.i('PK');
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.devolver_venta(pg_temp.dv('DK', 'VK', 'D1', 'S1', 'efectivo', 'x', jsonb_build_array(pg_temp.di('VK', 0.5))))$$, 'se devuelve fraccionado una línea sin serie aunque el producto ya controle serie');

-- Consistencia
reset role;
select is((select count(*) from public.stock s where negocio_id = pg_temp.i('T')
  and cantidad <> (select coalesce(sum(m.cantidad), 0) from public.movimientos_inventario m where m.producto_id = s.producto_id and m.ubicacion_id = s.ubicacion_id))::integer, 0, 'stock = suma del kardex tras ventas, anulaciones y devoluciones');
select is((select cantidad from public.stock where producto_id = pg_temp.i('PS')), 5.000, 'stock de PS vuelve a 5');

select * from finish();
rollback;
