-- Reservas con anticipo (RF-RES-01 a 03): DB-23 (completar no descuenta dos veces), DB-24 (cancelar libera y devuelve),
-- DB-04 con reservas (stock = kardex), arqueo con anticipos y devoluciones, permisos, idempotencia, rechazos.
begin;
select plan(144);
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
  (pg_temp.i('PR'), pg_temp.i('T'), 'PR', 'PR', 'producto', 'unidad', true),
  (pg_temp.i('PF'), pg_temp.i('T'), 'PF', 'PF', 'producto', 'unidad', false),
  (pg_temp.i('PL'), pg_temp.i('T'), 'PL', 'PL', 'producto', 'unidad', false),
  (pg_temp.i('PC'), pg_temp.i('T'), 'PC', 'PC', 'producto', 'unidad', false),
  (pg_temp.i('PD'), pg_temp.i('T'), 'PD', 'PD', 'producto', 'unidad', false),
  (pg_temp.i('PN'), pg_temp.i('T'), 'PN', 'PN', 'producto', 'unidad', false),
  (pg_temp.i('PE'), pg_temp.i('T'), 'PE', 'PE', 'producto', 'unidad', false),
  (pg_temp.i('PZ'), pg_temp.i('T'), 'PZ', 'PZ', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P2'), 'contado', 10, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PF'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('PF'), 'minimo', 8, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PL'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('PC'), 'contado', 10, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PD'), 'contado', 10, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PE'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('PZ'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P2'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U2'), pg_temp.i('P1'), 'inicial', 100, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PF'), 'inicial', 50, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PL'), 'inicial', 3, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PC'), 'inicial', 5, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PD'), 'inicial', 5, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PE'), 'inicial', 1, 10);

create function pg_temp.disp(ses text) returns uuid language sql as $$
  select pg_temp.i(case ses when 'S1' then 'D1' when 'S2' then 'D2' when 'S4' then 'D4' when 'SX' then 'DX'
    when 'SL' then 'DL' when 'SC' then 'D3' end)
$$;
create function pg_temp.cancelar(op text, r text, ses text, dev text default null) returns jsonb language sql as $$
  select public.cancelar_reserva(pg_temp.i(op), pg_temp.i(r), pg_temp.i(ses), coalesce(pg_temp.i(dev), pg_temp.disp(ses)))
$$;
create function pg_temp.res(o text, ses text, cli text, prod text, cant numeric, precio numeric, ant numeric, med text)
returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(o), 'dispositivo_id', pg_temp.disp(ses), 'caja_sesion_id', pg_temp.i(ses), 'cliente_id', pg_temp.i(cli),
    'producto_id', pg_temp.i(prod), 'cantidad', cant, 'precio_acordado', precio, 'anticipo', ant, 'medio', med)
$$;
create function pg_temp.pg(p_medio text, p_monto numeric) returns jsonb language sql as $$
  select jsonb_build_object('medio', p_medio, 'monto', p_monto)
$$;
-- Venta que completa la reserva r (P1, c unidades, precio p). Con r null no lleva reserva_id.
create function pg_temp.v(p_id text, p_num text, r text, p_cant numeric, p_precio numeric, p_pagos jsonb,
  p_cli text default 'CL', p_prod text default 'P1') returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'),
    'caja_sesion_id', pg_temp.i('S1'), 'numero', p_num, 'creada_en_cliente', now(), 'cliente_id', pg_temp.i(p_cli),
    'reserva_id', case when r is null then null else pg_temp.i(r) end, 'total', round(p_cant * p_precio, 2),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(p_prod), 'lista', 'contado', 'cantidad', p_cant,
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
create function pg_temp.costo_prom(p text) returns numeric language sql security definer as $$
  select round(costo_promedio, 2) from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i('U1')
$$;
create function pg_temp.comprar(p text, c numeric, k numeric) returns void language sql security definer as $$
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario)
  values (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i(p), 'compra', c, k)
$$;
create function pg_temp.res_caja(p_ses text, p_clave text) returns numeric language sql as $$
  select (public.resumen_caja(pg_temp.i(p_ses)) ->> p_clave)::numeric
$$;

select ok(has_function_privilege('authenticated', 'public.crear_reserva(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cancelar_reserva(uuid, uuid, uuid, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reservas_activas(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.crear_reserva(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.cancelar_reserva(uuid, uuid, uuid, uuid)', 'EXECUTE')
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
select ok(pg_temp.res_caja('S1', 'anticipos_qr') > 0
  and (select (f ->> 'reservas_qr')::numeric from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), (now() at time zone 'America/La_Paz')::date, (now() at time zone 'America/La_Paz')::date) -> 'filas') f
       where f ->> 'sesion_id' = pg_temp.i('S1')::text) = pg_temp.res_caja('S1', 'anticipos_qr') - pg_temp.res_caja('S1', 'devoluciones_reserva_qr')
  and (select (f ->> 'ventas_qr')::numeric + (f ->> 'reservas_qr')::numeric from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), (now() at time zone 'America/La_Paz')::date, (now() at time zone 'America/La_Paz')::date) -> 'filas') f
       where f ->> 'sesion_id' = pg_temp.i('S1')::text) = pg_temp.res_caja('S1', 'qr_neto'),
  'reporte_caja: el QR de reservas va en reservas_qr y no en ventas_qr');
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
select throws_ok($$select pg_temp.cancelar('OP1', 'R3', 'S2')$$, 'ERP_SIN_PERMISO', 'contador no cancela');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select pg_temp.cancelar('OP2', 'R3', 'SX')$$, 'ERP_SIN_PERMISO', 'otro negocio no cancela (sesión suya)');
select throws_ok($$select pg_temp.cancelar('OP3', 'R3', 'S2')$$, 'ERP_SIN_PERMISO', 'otro negocio no cancela (sesión ajena)');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.cancelar('OP4', 'R3', 'SC')$$, 'ERP_CAJA_CERRADA', 'sesión cerrada');
select throws_ok($$select pg_temp.cancelar('OP5', 'R1', 'S1')$$, 'ERP_RESERVA_NO_ACTIVA', 'una reserva completada no se cancela');
select throws_ok($$select pg_temp.cancelar('OPn', 'Rnada', 'S1')$$, 'ERP_SIN_PERMISO', 'reserva inexistente');
-- R3 (anticipo 30 en efectivo, S2). S3 no existe aún: S4 tiene 0 + R4 (20) = 20 < 30 -> efectivo insuficiente
select throws_ok($$select pg_temp.cancelar('OP6', 'R3', 'S4')$$, 'ERP_EFECTIVO_INSUFICIENTE', 'DB-24: efectivo esperado insuficiente');
select is(pg_temp.stock('P2'), 97::numeric, 'el rechazo no liberó stock');
select is((select estado from public.reservas where id = pg_temp.i('R3')), 'activa', 'R3 sigue activa');
select lives_ok($$select pg_temp.cancelar('OP7', 'R3', 'S2')$$, 'R3 se cancela en S2 (esperado 30)');
select is(pg_temp.stock('P2'), 100::numeric, 'DB-24: cancelar libera el stock');
select is(pg_temp.kardex('R3', 'reserva_liberada'), 3::numeric, 'kardex: reserva_liberada +3');
select results_eq($$select tipo, medio, monto, caja_sesion_id from public.reserva_pagos where reserva_id = pg_temp.i('R3') order by tipo$$,
  $$values ('anticipo'::text, 'efectivo'::text, 30::numeric, pg_temp.i('S2')), ('devolucion'::text, 'efectivo'::text, 30::numeric, pg_temp.i('S2'))$$, 'DB-24: devolución registrada por caja');
select is((select estado from public.reservas where id = pg_temp.i('R3')), 'cancelada', 'R3 cancelada');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S2', 'esperado'), 0::numeric, 'arqueo S2: anticipo 30 - devolución 30');
select is(pg_temp.res_caja('S2', 'devoluciones_reserva_efectivo'), 30::numeric, 'resumen: devoluciones de reserva');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.cancelar('OP8', 'R3', 'S2')$$, 'ERP_RESERVA_NO_ACTIVA', 'doble cancelación rechazada');
-- R2 (QR 10): se cancela en S1 y vuelve por QR
select lives_ok($$select pg_temp.cancelar('OP9', 'R2', 'S1')$$, 'R2 se cancela (QR)');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.res_caja('S1', 'qr_neto'), 0::numeric, 'QR neto: anticipo 10 - devolución 10');
select is(pg_temp.res_caja('S1', 'esperado'), 160::numeric, 'la devolución QR no toca el efectivo');

-- DB-04: stock = suma del kardex con reservas (P1 en U1: inicial 100, R1 -5 +5, V1 -5, R2 -2 +2)
select is(pg_temp.stock('P1'), (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 'DB-04: stock = kardex (P1 U1)');
select is(pg_temp.stock('P1'), 95::numeric, 'P1 U1: 100 - 5 de la venta');
select is(pg_temp.stock('P2'), (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P2') and ubicacion_id = pg_temp.i('U1')), 'DB-04: stock = kardex (P2 U1)');
select is(pg_temp.stock('P1', 'U2'), 95::numeric, 'P1 U2: R4 activa reserva 5');
select is((select count(*) from public.stock_inconsistente(pg_temp.i('T'))), 0::bigint, 'stock_inconsistente vacío');

-- Precio acordado: mismo piso y tope que una línea de venta (PF: contado 10, mínimo 8; tope 10 %)
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.crear_reserva(pg_temp.res('Rf1', 'S1', 'CL', 'PF', 1, 7, 5, 'qr'))$$, 'ERP_SIN_PERMISO', 'bajo el mínimo sin descontar');
select lives_ok($$select public.crear_reserva(pg_temp.res('Rf2', 'S1', 'CL', 'PF', 1, 8, 5, 'qr'))$$, 'en el mínimo no pide permiso');
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.crear_reserva(pg_temp.res('Rf3', 'S1', 'CL', 'PF', 1, 7.5, 5, 'qr'))$$, 'con descontar y dentro del tope');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rf4', 'S1', 'CL', 'PF', 1, 5, 5, 'qr'))$$, 'ERP_DESCUENTO_TOPE', 'con descontar pero sobre el tope');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rf5', 'S1', 'CL', 'PN', 1, 5, 5, 'qr'))$$, 'ERP_PRODUCTO_SIN_PRECIO', 'producto sin precio de contado');

-- Stock: la reserva exige disponible (PL tiene 3)
select throws_ok($$select public.crear_reserva(pg_temp.res('Rl1', 'S1', 'CL', 'PL', 4, 10, 5, 'qr'))$$, 'ERP_STOCK_INSUFICIENTE', 'más que el stock disponible');
select is((select count(*) from public.reservas where id = pg_temp.i('Rl1')), 0::bigint, 'el rechazo no dejó reserva');
select lives_ok($$select public.crear_reserva(pg_temp.res('Rl2', 'S1', 'CL', 'PL', 3, 10, 5, 'qr'))$$, 'todo el stock disponible se puede reservar');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rl3', 'S1', 'CL', 'PL', 1, 10, 5, 'qr'))$$, 'ERP_STOCK_INSUFICIENTE', 'lo ya reservado no está disponible');

-- Equipo: la sesión debe ser del dispositivo
select throws_ok($$select public.crear_reserva(jsonb_set(pg_temp.res('Re1', 'S1', 'CL', 'P1', 1, 10, 5, 'qr'), '{dispositivo_id}', to_jsonb(pg_temp.i('D2')::text)))$$, 'ERP_SIN_PERMISO', 'crear con la sesión de otro equipo');
select throws_ok($$select pg_temp.cancelar('OPe', 'R4', 'S4', 'D1')$$, 'ERP_SIN_PERMISO', 'cancelar con la sesión de otro equipo');
select throws_ok($$select pg_temp.cancelar('OPe2', 'Rf2', 'SC')$$, 'ERP_CAJA_CERRADA', 'cancelar en sesión cerrada');

-- Cancelar es idempotente por operación
select is(pg_temp.cancelar('OPi', 'Rf2', 'S1'), jsonb_build_object('id', pg_temp.i('Rf2'), 'estado', 'cancelada'), 'cancela');
select is(pg_temp.cancelar('OPi', 'Rf2', 'S1'), jsonb_build_object('id', pg_temp.i('Rf2'), 'estado', 'cancelada'), 'la misma operación repetida devuelve lo original');
select is((select count(*) from public.reserva_pagos where reserva_id = pg_temp.i('Rf2') and tipo = 'devolucion'), 1::bigint, 'una sola devolución');
select throws_ok($$select pg_temp.cancelar('OPj', 'Rf2', 'S1')$$, 'ERP_RESERVA_NO_ACTIVA', 'otra operación sobre una reserva cancelada');

-- Costo foto: reservar 5 de PC a 4, comprar 5 a 10, cancelar -> stock 10 con promedio 7
select lives_ok($$select public.crear_reserva(pg_temp.res('Rc1', 'S1', 'CL', 'PC', 5, 10, 10, 'qr'))$$, 'reserva PC');
select is(pg_temp.costo_kardex('Rc1', 'reserva'), 4.00, 'foto de la reserva = 4');
select pg_temp.comprar('PC', 5, 10);
select is(pg_temp.costo_prom('PC'), 10.00, 'tras la compra el promedio es 10');
select lives_ok($$select pg_temp.cancelar('OPc', 'Rc1', 'S1')$$, 'cancela PC');
select is(pg_temp.stock('PC'), 10::numeric, 'cancelar devuelve las 5 unidades');
select is(pg_temp.costo_kardex('Rc1', 'reserva_liberada'), 4.00, 'la liberación reingresa con el costo foto');
select is(pg_temp.costo_prom('PC'), 7.00, 'promedio 7 = (5 x 10 + 5 x 4) / 10');
-- Completar: la venta usa el costo foto aunque el promedio ya sea otro
select lives_ok($$select public.crear_reserva(pg_temp.res('Rc2', 'S1', 'CL', 'PD', 5, 10, 10, 'qr'))$$, 'reserva PD');
select pg_temp.comprar('PD', 5, 10);
select lives_ok($$select public.registrar_venta(pg_temp.v('V3', 'C1-000002', 'Rc2', 5, 10, jsonb_build_array(pg_temp.pg('anticipo', 10), pg_temp.pg('efectivo', 40)), 'CL', 'PD'))$$, 'completa PD');
select is(pg_temp.costo_item('V3'), 4::numeric, 'la línea de la venta usa el costo foto (4), no el promedio');
select is(pg_temp.costo_kardex('V3', 'venta'), 4.00, 'el kardex de la venta lleva el costo foto');
select is(pg_temp.costo_kardex('Rc2', 'reserva_liberada'), null::numeric, 'liberación al completar: sin costo (no re-promedia)');
select is(pg_temp.stock('PD'), 5::numeric, 'PD: 5 - 5 + 5 + 5 - 5');

-- Completar no re-promedia: reservar 1 a 10, comprar 10 a 20, completar -> el promedio sigue exactamente en 20
select lives_ok($$select public.crear_reserva(pg_temp.res('Rp1x', 'S1', 'CL', 'PE', 1, 10, 5, 'qr'))$$, 'reserva PE');
select pg_temp.comprar('PE', 10, 20);
select is(pg_temp.costo_prom('PE'), 20.00, 'PE: promedio 20 tras la compra');
select lives_ok($$select public.registrar_venta(pg_temp.v('V4', 'C1-000003', 'Rp1x', 1, 10, jsonb_build_array(pg_temp.pg('anticipo', 5), pg_temp.pg('efectivo', 5)), 'CL', 'PE'))$$, 'completa PE');
select is(pg_temp.costo_prom('PE'), 20.00, 'completar no cambia el promedio del stock restante');
select is(pg_temp.stock('PE'), 10::numeric, 'PE: 1 - 1 + 10 + 1 - 1');
select is(pg_temp.costo_item('V4'), 10::numeric, 'la venta lleva el costo foto (10)');
select is(pg_temp.costo_kardex('Rp1x', 'reserva_liberada'), null::numeric, 'liberación sin costo');
-- Producto sin fila de stock en la ubicación: no hay disponible
select is((select count(*) from public.stock where producto_id = pg_temp.i('PZ')), 0::bigint, 'PZ no tiene fila de stock');
select throws_ok($$select public.crear_reserva(pg_temp.res('Rz1', 'S1', 'CL', 'PZ', 1, 10, 5, 'qr'))$$, 'ERP_STOCK_INSUFICIENTE', 'sin stock registrado no se reserva');

-- Carrito: no hay más reglas de servidor; arqueo y kardex coherentes
select is((select count(*) from public.stock_inconsistente(pg_temp.i('T'))), 0::bigint, 'stock_inconsistente sigue vacío');

-- Cierre: el esperado congelado es el del resumen
select is((public.cerrar_caja(pg_temp.i('S1'), 205)->>'monto_esperado')::numeric, 205::numeric, 'cerrar_caja: esperado con anticipos');

-- RLS y escritura directa
select pg_temp.como(pg_temp.i('y'));
select is((select count(*) from public.reservas), 0::bigint, 'otro negocio no lee reservas');
select is((select count(*) from public.reserva_pagos), 0::bigint, 'otro negocio no lee reserva_pagos');
select pg_temp.como(pg_temp.i('d'));
select is((select count(*) from public.reservas), 10::bigint, 'el dueño lee las reservas de su negocio');
select throws_ok($$insert into public.reservas (id, negocio_id, cliente_id, producto_id, ubicacion_id, cantidad, precio_acordado)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('CL'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 1)$$, '42501', null, 'sin insert directo en reservas');
select throws_ok($$update public.reservas set estado = 'cancelada'$$, '42501', null, 'sin update directo en reservas');
select throws_ok($$delete from public.reserva_pagos$$, '42501', null, 'sin delete directo en reserva_pagos');
select set_config('role', 'postgres', true);
select throws_ok($$update public.reserva_pagos set monto = 1$$, null, null, 'reserva_pagos es append-only');
select throws_ok($$delete from public.reservas$$, null, null, 'reservas no se borra');

select * from finish();
rollback;
