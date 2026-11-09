-- Reservas con anticipo (RF-RES-01 a 03): DB-23 (completar no descuenta dos veces), DB-24 (cancelar libera y devuelve),
-- DB-04 con reservas (stock = kardex), arqueo con anticipos y devoluciones, permisos, idempotencia, rechazos.
begin;
select plan(104);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8150' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de T · v vendedor de T · c contador de T · y dueño de T2 · x dueño de la lavandería L
select pg_temp.crear_usuario(n) from (values ('d'), ('v'), ('c'), ('y'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('T2'), 'T2', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('y'), pg_temp.i('T2'), 'dueno'),
  (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('U2'), pg_temp.i('T'), 'U2', 'local'),
  (pg_temp.i('UX'), pg_temp.i('T2'), 'UX', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'),
  (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('D3'), pg_temp.i('T'), pg_temp.i('U1'), 'D3', 'C3'),
  (pg_temp.i('D4'), pg_temp.i('T'), pg_temp.i('U2'), 'D4', 'C4'),
  (pg_temp.i('DX'), pg_temp.i('T2'), pg_temp.i('UX'), 'DX', 'X1'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
-- S1 (inicial 100) y S2 (inicial 0) abiertas en U1 · S3 (inicial 5) en U1 · S4 en U2 · SC cerrada (D3 no tiene otra)
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 0),
  (pg_temp.i('S4'), pg_temp.i('T'), pg_temp.i('D4'), pg_temp.i('d'), 0),
  (pg_temp.i('SX'), pg_temp.i('T2'), pg_temp.i('DX'), pg_temp.i('y'), 0),
  (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0);
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial, cerrada_en, usuario_cierre,
  monto_contado, monto_esperado, diferencia) values
  (pg_temp.i('SC'), pg_temp.i('T'), pg_temp.i('D3'), pg_temp.i('d'), 0, now(), pg_temp.i('d'), 0, 0, 0);
insert into public.clientes (id, negocio_id, nombre) values
  (pg_temp.i('CL'), pg_temp.i('T'), 'Cliente'), (pg_temp.i('CL2'), pg_temp.i('T'), 'Otro'),
  (pg_temp.i('CLX'), pg_temp.i('T2'), 'ClienteX');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false),
  (pg_temp.i('P2'), pg_temp.i('T'), 'P2', 'P2', 'producto', 'unidad', false),
  (pg_temp.i('PS'), pg_temp.i('T'), 'PS', 'PS', 'servicio', 'unidad', false),
  (pg_temp.i('PR'), pg_temp.i('T'), 'PR', 'PR', 'producto', 'unidad', true);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P2'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P2'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U2'), pg_temp.i('P1'), 'inicial', 100, 4);

create function pg_temp.res(o text, ses text, cli text, prod text, cant numeric, precio numeric, ant numeric, med text)
returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(o), 'caja_sesion_id', pg_temp.i(ses), 'cliente_id', pg_temp.i(cli),
    'producto_id', pg_temp.i(prod), 'cantidad', cant, 'precio_acordado', precio, 'anticipo', ant, 'medio', med)
$$;
create function pg_temp.pg(p_medio text, p_monto numeric) returns jsonb language sql as $$
  select jsonb_build_object('medio', p_medio, 'monto', p_monto)
$$;
-- Venta que completa la reserva r (P1, c unidades, precio p). Con r null no lleva reserva_id.
create function pg_temp.v(p_id text, p_num text, r text, p_cant numeric, p_precio numeric, p_pagos jsonb,
  p_cli text default 'CL') returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'),
    'caja_sesion_id', pg_temp.i('S1'), 'numero', p_num, 'creada_en_cliente', now(), 'cliente_id', pg_temp.i(p_cli),
    'reserva_id', case when r is null then null else pg_temp.i(r) end, 'total', round(p_cant * p_precio, 2),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'lista', 'contado', 'cantidad', p_cant,
      'precio_unitario', p_precio)),
    'pagos', p_pagos))
$$;
create function pg_temp.stock(p text, u text default 'U1') returns numeric language sql as $$
  select cantidad from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i(u)
$$;
create function pg_temp.kardex(p_ref text, p_tipo text) returns numeric language sql as $$
  select sum(cantidad) from public.movimientos_inventario where ref_id = pg_temp.i(p_ref) and tipo = p_tipo
$$;
create function pg_temp.costo_kardex(p_ref text, p_tipo text) returns numeric language sql security definer as $$
  select round(costo_unitario, 2) from public.movimientos_inventario where ref_id = pg_temp.i(p_ref) and tipo = p_tipo
$$;
create function pg_temp.costo_item(p_venta text) returns numeric language sql security definer as $$
  select costo_unitario from public.venta_items where venta_id = pg_temp.i(p_venta)
$$;
create function pg_temp.item_id(p_venta text) returns uuid language sql security definer as $$
  select id from public.venta_items where venta_id = pg_temp.i(p_venta)
$$;
create function pg_temp.res_caja(p_ses text, p_clave text) returns numeric language sql as $$
  select (public.resumen_caja(pg_temp.i(p_ses)) ->> p_clave)::numeric
$$;

select ok(has_function_privilege('authenticated', 'public.crear_reserva(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cancelar_reserva(uuid, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reservas_activas(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.crear_reserva(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.cancelar_reserva(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reservas_activas(uuid)', 'EXECUTE'), 'solo authenticated ejecuta');
select ok(not exists (select 1 from pg_proc p where p.proname in ('registrar_venta', 'efectivo_esperado', 'total_qr_sesion',
    'anular_venta', 'devolver_venta', 'resumen_caja') and p.pronamespace = 'public'::regnamespace
  group by p.proname having count(*) > 1), 'las funciones redefinidas no crearon sobrecargas');

-- crear_reserva (v: vendedor con gestionar_reservas y caja). R1: 5 de P1 a 12 (total 60), anticipo 20 en efectivo.
select pg_temp.como(pg_temp.i('v'));
select is(public.crear_reserva(pg_temp.res('R1', 'S1', 'CL', 'P1', 5, 12, 20, 'efectivo')), jsonb_build_object('id', pg_temp.i('R1')), 'R1 creada');
select is(pg_temp.stock('P1'), 95::numeric, 'DB-23: la reserva descuenta el disponible');
select is((select cantidad from public.movimientos_inventario where ref_id = pg_temp.i('R1') and tipo = 'reserva'), -5::numeric, 'kardex: reserva -5');
select is(pg_temp.costo_kardex('R1', 'reserva'), 4.00, 'kardex: costo foto');
select is((select estado from public.reservas where id = pg_temp.i('R1')), 'activa', 'estado activa');
select results_eq($$select tipo, medio, monto, caja_sesion_id from public.reserva_pagos where reserva_id = pg_temp.i('R1')$$,
  $$values ('anticipo'::text, 'efectivo'::text, 20::numeric, pg_temp.i('S1'))$$, 'anticipo por caja en la sesión');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S1', 'anticipos_efectivo'), 20::numeric, 'resumen: anticipos en efectivo');
select is(pg_temp.res_caja('S1', 'esperado'), 120::numeric, 'arqueo: esperado = 100 + anticipo 20');

-- Idempotencia
select pg_temp.como(pg_temp.i('v'));
select is(public.crear_reserva(pg_temp.res('R1', 'S1', 'CL', 'P1', 5, 12, 20, 'efectivo')), jsonb_build_object('id', pg_temp.i('R1')), 'reintento idéntico devuelve lo mismo');
select is((select count(*) from public.reservas where id = pg_temp.i('R1')), 1::bigint, 'una sola fila');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('R1')), 1::bigint, 'un solo movimiento');
select is((select count(*) from public.reserva_pagos where reserva_id = pg_temp.i('R1')), 1::bigint, 'un solo anticipo');
select is(pg_temp.stock('P1'), 95::numeric, 'el reintento no descuenta otra vez');
select throws_ok($$select public.crear_reserva(pg_temp.res('R1', 'S1', 'CL', 'P1', 6, 12, 20, 'efectivo'))$$, 'ERP_OPERACION_REPETIDA', 'mismo id con otros datos');

-- Rechazos de datos
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx1', 'S1', 'CL', 'P1', 5, 12, 61, 'efectivo'))$$, 'ERP_DATOS_INVALIDOS', 'anticipo mayor que el total');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx2', 'S1', 'CL', 'P1', 5, 12, 0, 'efectivo'))$$, 'ERP_DATOS_INVALIDOS', 'anticipo cero');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx3', 'S1', 'CL', 'P1', 5, 12, 10, 'tarjeta'))$$, 'ERP_DATOS_INVALIDOS', 'medio inválido');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx4', 'S1', 'CL', 'P1', 0, 12, 10, 'qr'))$$, 'ERP_DATOS_INVALIDOS', 'cantidad cero');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx5', 'S1', 'CL', 'P1', 1.5, 12, 10, 'qr'))$$, 'ERP_DATOS_INVALIDOS', 'unidad con decimales');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx6', 'S1', 'CL', 'PS', 1, 12, 10, 'qr'))$$, 'ERP_DATOS_INVALIDOS', 'servicio no se reserva');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx7', 'S1', 'CL', 'PR', 1, 12, 10, 'qr'))$$, 'ERP_DATOS_INVALIDOS', 'producto con serie no se reserva');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rx8', 'S1', 'CLX', 'P1', 1, 12, 10, 'qr'))$$, 'ERP_DATOS_INVALIDOS', 'cliente de otro negocio');
select throws_ok($$select public.crear_reserva(jsonb_set(pg_temp.res('Rx9', 'S1', 'CL', 'P1', 1, 12, 10, 'qr'), '{extra}', '1'))$$, 'ERP_DATOS_INVALIDOS', 'clave desconocida');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rxa', 'SC', 'CL', 'P1', 1, 12, 10, 'qr'))$$, 'ERP_CAJA_CERRADA', 'sesión cerrada');
select is((select count(*) from public.reservas where id in (pg_temp.i('Rx1'), pg_temp.i('Rx8'), pg_temp.i('Rxa'))), 0::bigint, 'nada quedó de los rechazos');

-- Permisos
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.crear_reserva(pg_temp.res('Rp1', 'S1', 'CL', 'P1', 1, 12, 10, 'qr'))$$, 'ERP_SIN_PERMISO', 'contador no crea');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.crear_reserva(pg_temp.res('Rp2', 'SL', 'CL', 'P1', 1, 12, 10, 'qr'))$$, 'ERP_SIN_PERMISO', 'lavandería no tiene gestionar_reservas');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.crear_reserva(pg_temp.res('Rp3', 'S1', 'CL', 'P1', 1, 12, 10, 'qr'))$$, 'ERP_SIN_PERMISO', 'otro negocio no crea sobre mi sesión');
select throws_ok($$select public.reservas_activas(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'otro negocio no lista');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.reservas_activas(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'contador no lista');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.reservas_activas(pg_temp.i('L'))$$, 'ERP_SIN_PERMISO', 'lavandería no lista');
select set_config('role', 'anon', true);
select throws_ok($$select public.crear_reserva(pg_temp.res('Rp5', 'S1', 'CL', 'P1', 1, 12, 10, 'qr'))$$, '42501', null, 'anon no crea');
select pg_temp.como(pg_temp.i('v'));

-- R2 por QR en S1 y R3 en efectivo en S2 (para cancelar). reservas_activas las lista
select lives_ok($$select public.crear_reserva(pg_temp.res('R2', 'S1', 'CL', 'P1', 2, 12, 10, 'qr'))$$, 'R2 anticipo por QR');
select lives_ok($$select public.crear_reserva(pg_temp.res('R3', 'S2', 'CL2', 'P2', 3, 11, 30, 'efectivo'))$$, 'R3 en S2');
select is((select count(*) from public.reservas_activas(pg_temp.i('T'))), 3::bigint, 'reservas_activas: R1, R2 y R3');
select results_eq($$select cliente_nombre, producto_nombre, cantidad, precio_acordado, anticipo, medio from public.reservas_activas(pg_temp.i('T')) where id = pg_temp.i('R2')$$,
  $$values ('Cliente'::text, 'P1'::text, 2::numeric, 12::numeric, 10::numeric, 'qr'::text)$$, 'reservas_activas: datos de R2');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S1', 'anticipos_qr'), 10::numeric, 'resumen: anticipos por QR');
select is(pg_temp.res_caja('S1', 'qr_neto'), 10::numeric, 'total_qr_sesion suma el anticipo QR');
select is(pg_temp.res_caja('S1', 'esperado'), 120::numeric, 'el anticipo QR no entra al efectivo esperado');
select pg_temp.como(pg_temp.i('v'));

-- Completar (DB-23): la venta usa el anticipo de R1 (20) y paga 40 en efectivo
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 4, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 28))))$$, 'ERP_DATOS_INVALIDOS', 'cantidad distinta de la reservada');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 5, 10, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 30))))$$, 'ERP_DATOS_INVALIDOS', 'precio distinto del acordado');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('efectivo', 60))))$$, 'ERP_DATOS_INVALIDOS', 'sin pago anticipo');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 15), pg_temp.pg('efectivo', 45))))$$, 'ERP_DATOS_INVALIDOS', 'anticipo distinto de lo recibido');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 10), pg_temp.pg('anticipo', 10), pg_temp.pg('efectivo', 40))))$$, 'ERP_DATOS_INVALIDOS', 'dos pagos anticipo');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', null, 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))))$$, 'ERP_DATOS_INVALIDOS', 'pago anticipo sin reserva');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40)), 'CL2'))$$, 'ERP_DATOS_INVALIDOS', 'cliente distinto del de la reserva');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))), jsonb_build_object('vendedor_id', pg_temp.i('v'), 'tipo_cambio', null, 'numero_impreso', null))$$, 'ERP_REQUIERE_CONEXION', 'offline con reserva se rechaza');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))), '{reserva_id}', to_jsonb(pg_temp.i('Rnada')::text)))$$, 'ERP_DATOS_INVALIDOS', 'reserva inexistente');
select throws_ok($$select public.registrar_venta(jsonb_set(pg_temp.v('V0', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))), '{descuento}', '2'))$$, 'ERP_DATOS_INVALIDOS', 'descuento en venta de reserva');
select is(pg_temp.stock('P1'), 93::numeric, 'los rechazos no movieron el stock (95 - 2 de R2)');
-- Reserva de otra ubicación: R4 vive en U2 (D4), la venta sale de D1 en U1
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.crear_reserva(pg_temp.res('R4', 'S4', 'CL', 'P1', 5, 12, 20, 'efectivo'))$$, 'R4 en U2');
select throws_ok($$select public.registrar_venta(pg_temp.v('V0', 'C1-000001', 'R4', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))))$$, 'ERP_DATOS_INVALIDOS', 'ubicación distinta de la reserva');
select pg_temp.como(pg_temp.i('v'));

select lives_ok($$select public.registrar_venta(pg_temp.v('V1', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))))$$, 'V1 completa R1');
select is(pg_temp.stock('P1'), 93::numeric, 'DB-23: completar no descuenta dos veces');
select is(pg_temp.kardex('R1', 'reserva'), -5::numeric, 'kardex: reserva -5');
select is(pg_temp.kardex('R1', 'reserva_liberada'), 5::numeric, 'kardex: reserva_liberada +5 (ref reserva)');
select is(pg_temp.kardex('V1', 'venta'), -5::numeric, 'kardex: venta -5 (ref venta)');
select results_eq($$select estado, venta_id from public.reservas where id = pg_temp.i('R1')$$,
  $$values ('completada'::text, pg_temp.i('V1'))$$, 'R1 completada y ligada a la venta');
select results_eq($$select medio, monto, verificacion from public.venta_pagos where venta_id = pg_temp.i('V1') order by medio$$,
  $$values ('anticipo'::text, 20::numeric, 'no_aplica'::text), ('efectivo'::text, 40::numeric, 'no_aplica'::text)$$, 'pagos de la venta');
select is((select total from public.ventas where id = pg_temp.i('V1')), 60::numeric, 'venta por el total de la reserva');
select is(pg_temp.costo_item('V1'), 4::numeric, 'venta_items con costo foto');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S1', 'esperado'), 160::numeric, 'arqueo: 100 + anticipo 20 + efectivo 40, el anticipo no se cuenta dos veces');
select is(pg_temp.res_caja('S1', 'ventas_efectivo'), 40::numeric, 'ventas_efectivo no incluye el anticipo');
select pg_temp.como(pg_temp.i('v'));
select is(public.registrar_venta(pg_temp.v('V1', 'C1-000001', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))))->>'numero', 'C1-000001', 'reenvío de V1 devuelve la original');
select is(pg_temp.stock('P1'), 93::numeric, 'el reenvío no mueve el stock');
select throws_ok($$select public.registrar_venta(pg_temp.v('V2', 'C1-000002', 'R1', 5, 12, jsonb_build_array(pg_temp.pg('anticipo', 20), pg_temp.pg('efectivo', 40))))$$, 'ERP_RESERVA_NO_ACTIVA', 'completar una reserva ya completada');

-- anular y devolver se rechazan para una venta de reserva
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.anular_venta(pg_temp.i('V1'), 'x')$$, 'ERP_VENTA_DE_RESERVA', 'anular_venta rechaza');
select throws_ok($$select public.devolver_venta(jsonb_build_object('id', gen_random_uuid(), 'venta_id', pg_temp.i('V1'),
  'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S1'), 'medio', 'efectivo', 'motivo', 'm',
  'items', jsonb_build_array(jsonb_build_object('venta_item_id', pg_temp.item_id('V1'), 'cantidad', 1))))$$,
  'ERP_VENTA_DE_RESERVA', 'devolver_venta rechaza');

-- Cancelar (DB-24)
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('S2'))$$, 'ERP_SIN_PERMISO', 'contador no cancela');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('SX'))$$, 'ERP_SIN_PERMISO', 'otro negocio no cancela (sesión suya)');
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('S2'))$$, 'ERP_SIN_PERMISO', 'otro negocio no cancela (sesión ajena)');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('SC'))$$, 'ERP_CAJA_CERRADA', 'sesión cerrada');
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R1'), pg_temp.i('S1'))$$, 'ERP_RESERVA_NO_ACTIVA', 'una reserva completada no se cancela');
select throws_ok($$select public.cancelar_reserva(gen_random_uuid(), pg_temp.i('S1'))$$, 'ERP_SIN_PERMISO', 'reserva inexistente');
-- R3 (anticipo 30 en efectivo, S2). S3 no existe aún: S4 tiene 0 + R4 (20) = 20 < 30 -> efectivo insuficiente
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('S4'))$$, 'ERP_EFECTIVO_INSUFICIENTE', 'DB-24: efectivo esperado insuficiente');
select is(pg_temp.stock('P2'), 97::numeric, 'el rechazo no liberó stock');
select is((select estado from public.reservas where id = pg_temp.i('R3')), 'activa', 'R3 sigue activa');
select lives_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('S2'))$$, 'R3 se cancela en S2 (esperado 30)');
select is(pg_temp.stock('P2'), 100::numeric, 'DB-24: cancelar libera el stock');
select is(pg_temp.kardex('R3', 'reserva_liberada'), 3::numeric, 'kardex: reserva_liberada +3');
select results_eq($$select tipo, medio, monto, caja_sesion_id from public.reserva_pagos where reserva_id = pg_temp.i('R3') order by tipo$$,
  $$values ('anticipo'::text, 'efectivo'::text, 30::numeric, pg_temp.i('S2')), ('devolucion'::text, 'efectivo'::text, 30::numeric, pg_temp.i('S2'))$$, 'DB-24: devolución registrada por caja');
select is((select estado from public.reservas where id = pg_temp.i('R3')), 'cancelada', 'R3 cancelada');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S2', 'esperado'), 0::numeric, 'arqueo S2: anticipo 30 - devolución 30');
select is(pg_temp.res_caja('S2', 'devoluciones_reserva_efectivo'), 30::numeric, 'resumen: devoluciones de reserva');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.cancelar_reserva(pg_temp.i('R3'), pg_temp.i('S2'))$$, 'ERP_RESERVA_NO_ACTIVA', 'doble cancelación rechazada');
-- R2 (QR 10): se cancela en S1 y vuelve por QR
select lives_ok($$select public.cancelar_reserva(pg_temp.i('R2'), pg_temp.i('S1'))$$, 'R2 se cancela (QR)');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S1', 'qr_neto'), 0::numeric, 'QR neto: anticipo 10 - devolución 10');
select is(pg_temp.res_caja('S1', 'esperado'), 160::numeric, 'la devolución QR no toca el efectivo');

-- DB-04: stock = suma del kardex con reservas (P1 en U1: inicial 100, R1 -5 +5, V1 -5, R2 -2 +2)
select is(pg_temp.stock('P1'), (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 'DB-04: stock = kardex (P1 U1)');
select is(pg_temp.stock('P1'), 95::numeric, 'P1 U1: 100 - 5 de la venta');
select is(pg_temp.stock('P2'), (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P2') and ubicacion_id = pg_temp.i('U1')), 'DB-04: stock = kardex (P2 U1)');
select is(pg_temp.stock('P1', 'U2'), 95::numeric, 'P1 U2: R4 activa reserva 5');
select is((select count(*) from public.stock_inconsistente(pg_temp.i('T'))), 0::bigint, 'stock_inconsistente vacío');

-- Cierre: el esperado congelado es el del resumen
select is((public.cerrar_caja(pg_temp.i('S1'), 160)->>'monto_esperado')::numeric, 160::numeric, 'cerrar_caja: esperado con anticipos');

-- RLS y escritura directa
select pg_temp.como(pg_temp.i('y'));
select is((select count(*) from public.reservas), 0::bigint, 'otro negocio no lee reservas');
select is((select count(*) from public.reserva_pagos), 0::bigint, 'otro negocio no lee reserva_pagos');
select pg_temp.como(pg_temp.i('d'));
select is((select count(*) from public.reservas), 4::bigint, 'el dueño lee las reservas de su negocio');
select throws_ok($$insert into public.reservas (id, negocio_id, cliente_id, producto_id, ubicacion_id, cantidad, precio_acordado)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('CL'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 1)$$, '42501', null, 'sin insert directo en reservas');
select throws_ok($$update public.reservas set estado = 'cancelada'$$, '42501', null, 'sin update directo en reservas');
select throws_ok($$delete from public.reserva_pagos$$, '42501', null, 'sin delete directo en reserva_pagos');
select set_config('role', 'postgres', true);
select throws_ok($$update public.reserva_pagos set monto = 1$$, null, null, 'reserva_pagos es append-only');
select throws_ok($$delete from public.reservas$$, null, null, 'reservas no se borra');
select * from finish();
rollback;
