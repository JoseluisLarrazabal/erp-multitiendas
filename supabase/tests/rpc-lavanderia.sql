-- Órdenes de lavandería: crear_orden (DB-18), cambiar_estado_orden (DB-19), entregar_orden, anular_orden y los cambios en
-- anular_venta / devolver_venta. Una venta de lavandería sin cliente solo se acepta offline (sin_cliente).
begin;
select plan(89);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9300' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- Usuarios: x dueño de L · em empleado de L · co contador de L · y dueño de T
select pg_temp.crear_usuario(n) from (values ('x'), ('em'), ('co'), ('y')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('x'), pg_temp.i('L'), 'dueno'), (pg_temp.i('em'), pg_temp.i('L'), 'empleado'),
  (pg_temp.i('co'), pg_temp.i('L'), 'contador'), (pg_temp.i('y'), pg_temp.i('T'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('UT'), pg_temp.i('T'), 'UT', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('DT'), pg_temp.i('T'), pg_temp.i('UT'), 'DT', 'C1'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1'),
  (pg_temp.i('DL2'), pg_temp.i('L'), pg_temp.i('UL'), 'DL2', 'L2');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('ST'), pg_temp.i('T'), pg_temp.i('DT'), pg_temp.i('y'), 0),
  (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0),
  (pg_temp.i('SL2'), pg_temp.i('L'), pg_temp.i('DL2'), pg_temp.i('x'), 0);
-- Servicios de L: SV (normal 15, express 25) · producto PX (normal 9) · producto de T: PTP (contado 10)
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad) values
  (pg_temp.i('SV'), pg_temp.i('L'), 'SV', 'SV', 'servicio', 'unidad'),
  (pg_temp.i('PX'), pg_temp.i('L'), 'PX', 'PX', 'producto', 'unidad'),
  (pg_temp.i('PTP'), pg_temp.i('T'), 'PTP', 'PTP', 'producto', 'unidad');
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('L'), pg_temp.i('SV'), 'normal', 15, 'BOB'), (pg_temp.i('L'), pg_temp.i('SV'), 'express', 25, 'BOB'),
  (pg_temp.i('L'), pg_temp.i('PX'), 'normal', 9, 'BOB'), (pg_temp.i('T'), pg_temp.i('PTP'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('PX'), 'inicial', 10, 4),
  (pg_temp.i('T'), pg_temp.i('UT'), pg_temp.i('PTP'), 'inicial', 10, 4);
insert into public.clientes (id, negocio_id, nombre, telefono) values
  (pg_temp.i('CL'), pg_temp.i('L'), 'Cliente Uno', '70011122');

-- Venta de lavandería: 2 x SV normal a 15 = 30 en efectivo, con cliente CL. p_extra pisa claves.
create function pg_temp.vl(p_id text, p_num text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('DL'), 'caja_sesion_id', pg_temp.i('SL'),
    'numero', p_num, 'creada_en_cliente', now(), 'total', 30, 'cliente_id', pg_temp.i('CL'),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('SV'), 'lista', 'normal', 'cantidad', 2, 'precio_unitario', 15)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 30))) || p_extra
$$;
-- Igual, en express: 2 x 25 = 50
create function pg_temp.vx(p_id text, p_num text) returns jsonb language sql as $$
  select pg_temp.vl(p_id, p_num, jsonb_build_object('total', 50,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('SV'), 'lista', 'express', 'cantidad', 2, 'precio_unitario', 25)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 50))))
$$;
create function pg_temp.o(p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('express', false, 'prendas', 3, 'fecha_prometida', '2099-01-01') || p_extra
$$;
create function pg_temp.off(p_vend text) returns jsonb language sql as $$
  select jsonb_build_object('vendedor_id', pg_temp.i(p_vend), 'tipo_cambio', null, 'numero_impreso', null)
$$;
create function pg_temp.eventos(p_id text) returns integer language sql as $$
  select count(*)::integer from public.orden_eventos where orden_id = pg_temp.i(p_id)
$$;
create function pg_temp.esperado() returns numeric language sql as $$
  select (public.resumen_caja(pg_temp.i('SL')) ->> 'esperado')::numeric
$$;

-- DB-18: crear dos veces es una sola orden. La foto del cliente sale de clientes, no del payload.
select pg_temp.como(pg_temp.i('x'));
select is(public.crear_orden(pg_temp.vl('O1', 'L1-000001'), pg_temp.o('{"cliente_nombre": "Ignorado", "casillero": "A7"}'))
  - 'id', jsonb_build_object('numero', 'L1-000001', 'total', 30, 'estado', 'recibida'), 'crear_orden: {numero, total, estado}');
select is(public.crear_orden(pg_temp.vl('O1', 'L1-000001'), pg_temp.o('{"cliente_nombre": "Ignorado", "casillero": "A7"}'))
  - 'id', jsonb_build_object('numero', 'L1-000001', 'total', 30, 'estado', 'recibida'), 'DB-18: reenvío devuelve lo mismo');
select is((select count(*) from public.ordenes where id = pg_temp.i('O1'))::integer, 1, 'DB-18: una orden');
select is((select count(*) from public.ventas where id = pg_temp.i('O1'))::integer, 1, 'DB-18: una venta');
select is(pg_temp.eventos('O1'), 1, 'DB-18: un evento');
select is((select cliente_nombre || '/' || cliente_telefono || '/' || casillero || '/' || recibida_por::text
  from public.ordenes where id = pg_temp.i('O1')), 'Cliente Uno/70011122/A7/' || pg_temp.i('x')::text,
  'foto del cliente desde clientes; recibida_por = vendedor');
select is((select o.estado_en = v.recibida_en from public.ordenes o join public.ventas v on v.id = o.id where o.id = pg_temp.i('O1')),
  true, 'estado_en = recepción de la venta');
select is((select usuario_id from public.orden_eventos where orden_id = pg_temp.i('O1')), pg_temp.i('x'), 'evento recibida con quien recibió');
select throws_ok($$select public.crear_orden(pg_temp.vl('O1', 'L1-000001'), pg_temp.o('{"cliente_nombre": "Ignorado", "casillero": "A7", "prendas": 4}'))$$,
  'P0001', 'ERP_OPERACION_REPETIDA', 'DB-18: mismo id con otra ficha');
select is(pg_temp.esperado(), 30::numeric, 'resumen_caja suma el pago de la orden');

select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.crear_orden(pg_temp.vl('O1', 'L1-000001'), pg_temp.o())$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no ve ni reenvía la orden');
select throws_ok($$select public.crear_orden(pg_temp.vl('OT', 'C1-000001', jsonb_build_object('dispositivo_id', pg_temp.i('DT'),
  'caja_sesion_id', pg_temp.i('ST'), 'total', 10, 'cliente_id', null,
  'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PTP'), 'lista', 'contado', 'cantidad', 1, 'precio_unitario', 10)),
  'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 10)))), pg_temp.o())$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'crear_orden en un negocio que no es lavandería');

-- Rechazos (nada se escribe)
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.crear_orden(pg_temp.vx('O2', 'L1-000002'), pg_temp.o())$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ítems express con orden normal');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"express": true}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ítems normales con orden express');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002', jsonb_build_object('total', 18,
  'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('PX'), 'lista', 'normal', 'cantidad', 2, 'precio_unitario', 9)),
  'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 18)))), pg_temp.o())$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'un producto que no es servicio');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002', '{"cliente_id": null}'), pg_temp.o('{"cliente_nombre": "Mostrador"}'))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'en línea sin cliente: error, aunque haya nombre');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002', '{"cliente_id": null}'), pg_temp.o(), pg_temp.off('x'))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'sin cliente_id ni cliente_nombre');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"prendas": 0}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'prendas 0');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"prendas": 1000}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'prendas 1000');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"prendas": 2.5}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'prendas decimal');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"fecha_prometida": "2000-01-01"}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'fecha prometida anterior a la recepción');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"fecha_prometida": "2099-13-45"}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'fecha inexistente');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o(jsonb_build_object('casillero', repeat('a', 21))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'casillero de 21 caracteres');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o(jsonb_build_object('nota', repeat('a', 501))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'nota de 501 caracteres');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"extra": 1}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida en la ficha');
select throws_ok($$select public.crear_orden(pg_temp.vl('O2', 'L1-000002'), pg_temp.o('{"express": "no"}'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'express no booleano');
select is((select count(*) from public.ordenes)::integer, 1, 'nada escrito tras los rechazos');

-- Sin conexión y sin cliente: se acepta con nombre y queda marcada
select is(public.crear_orden(pg_temp.vl('O3', 'L1-000002', '{"cliente_id": null}'),
  pg_temp.o('{"cliente_nombre": " Mostrador ", "cliente_telefono": "70099988"}'), pg_temp.off('x')) ->> 'estado', 'recibida',
  'offline sin cliente pero con nombre: se crea');
select is((select motivos_revision from public.ventas where id = pg_temp.i('O3')), array['sin_cliente'], 'la venta queda con sin_cliente');
select is((select cliente_nombre || '/' || cliente_telefono from public.ordenes where id = pg_temp.i('O3')), 'Mostrador/70099988', 'ficha con lo escrito');
select is((select count(*) from public.ventas where cliente_id is null and origen = 'offline')::integer, 1, 'venta offline sin cliente_id');

-- DB-19: transiciones
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O1'), 'lista')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'DB-19: recibida -> lista');
select is(public.cambiar_estado_orden(pg_temp.i('O1'), 'en_lavado') ->> 'estado', 'en_lavado', 'recibida -> en_lavado');
select is(pg_temp.eventos('O1'), 2, 'el cambio deja evento');
select is(public.cambiar_estado_orden(pg_temp.i('O1'), 'recibida') ->> 'estado', 'recibida', 'volver un paso: en_lavado -> recibida');
select is(public.cambiar_estado_orden(pg_temp.i('O1'), 'en_lavado') ->> 'estado', 'en_lavado', 'recibida -> en_lavado otra vez');
select is(public.cambiar_estado_orden(pg_temp.i('O1'), 'lista') ->> 'estado', 'lista', 'en_lavado -> lista');
select is(pg_temp.eventos('O1'), 5, 'cada cambio válido suma un evento');
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O1'), 'recibida')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'DB-19: lista -> recibida');
select is(public.cambiar_estado_orden(pg_temp.i('O1'), 'lista') ->> 'estado', 'lista', 'mismo estado: sin cambios');
select is(pg_temp.eventos('O1'), 5, 'mismo estado no suma evento');
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O1'), 'entregada')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'entregada solo con entregar_orden');
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O1'), 'xx')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'estado desconocido');
select is((select usuario_id from public.orden_eventos where orden_id = pg_temp.i('O1') order by created_at desc, id limit 1),
  pg_temp.i('x'), 'el evento lleva al usuario');
select pg_temp.como(pg_temp.i('co'));
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O3'), 'en_lavado')$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no cambia estados');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O3'), 'en_lavado')$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no cambia estados');
select pg_temp.como(pg_temp.i('em'));
select is(public.cambiar_estado_orden(pg_temp.i('O3'), 'en_lavado') ->> 'estado', 'en_lavado', 'el empleado sí cambia estados');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('nada'), 'en_lavado')$$, 'P0001', 'ERP_SIN_PERMISO', 'orden inexistente');

-- Entrega
select throws_ok($$select public.entregar_orden(pg_temp.i('O3'), 'Ana', 'boleta')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'entregar solo desde lista');
select throws_ok($$select public.entregar_orden(pg_temp.i('O1'), 'Ana', 'carnet')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'carnet exige documento');
select throws_ok($$select public.entregar_orden(pg_temp.i('O1'), 'Ana', 'otro')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'retiro_con desconocido');
select throws_ok($$select public.entregar_orden(pg_temp.i('O1'), '  ', 'boleta')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'retirada_por vacío');
select pg_temp.como(pg_temp.i('co'));
select throws_ok($$select public.entregar_orden(pg_temp.i('O1'), 'Ana', 'boleta')$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no entrega');
select pg_temp.como(pg_temp.i('x'));
select is(public.entregar_orden(pg_temp.i('O1'), 'Ana', 'carnet', ' 1234567 ') ->> 'estado', 'entregada', 'entrega con carnet');
select is((select retirada_por || '/' || retiro_con || '/' || documento_retiro || '/' || entregada_por::text
  from public.ordenes where id = pg_temp.i('O1')), 'Ana/carnet/1234567/' || pg_temp.i('x')::text, 'datos de la entrega');
select is(public.entregar_orden(pg_temp.i('O1'), 'Ana', 'carnet', '1234567') ->> 'estado', 'entregada', 'entrega idempotente');
select is(pg_temp.eventos('O1'), 6, 'la entrega repetida no suma evento');
select throws_ok($$select public.entregar_orden(pg_temp.i('O1'), 'Beto', 'boleta')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'entrega repetida con otros datos');
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O1'), 'lista')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'entregada no vuelve atrás');
select throws_ok($$select public.anular_orden(pg_temp.i('O1'), 'tarde')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'una orden entregada no se anula');

-- anular_venta y devolver_venta sobre una orden activa
select throws_ok($$select public.anular_venta(pg_temp.i('O3'), 'x')$$, 'P0001', 'ERP_ES_ORDEN', 'anular_venta de una orden activa');
select throws_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('DV'), 'venta_id', pg_temp.i('O3'),
  'dispositivo_id', pg_temp.i('DL'), 'caja_sesion_id', pg_temp.i('SL'), 'medio', 'efectivo', 'motivo', 'x',
  'items', jsonb_build_array(jsonb_build_object('venta_item_id', pg_temp.i('nada'), 'cantidad', 1))))$$,
  'P0001', 'ERP_ES_ORDEN', 'devolver_venta de una orden activa');

-- Anulación con la caja abierta: la venta se anula y el efectivo vuelve a la caja
select is(public.crear_orden(pg_temp.vl('O4', 'L1-000003'), pg_temp.o())  ->> 'estado', 'recibida', 'orden para anular');
select is(pg_temp.esperado(), 90::numeric, 'esperado con tres cobros en efectivo');
select throws_ok($$select public.anular_orden(pg_temp.i('O4'), '  ')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'anular sin motivo');
select pg_temp.como(pg_temp.i('co'));
select throws_ok($$select public.anular_orden(pg_temp.i('O4'), 'error')$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no anula');
select pg_temp.como(pg_temp.i('x'));
select is(public.anular_orden(pg_temp.i('O4'), 'cliente se arrepintió'), jsonb_build_object('id', pg_temp.i('O4'), 'estado', 'cancelada', 'reembolso', true),
  'anular con caja abierta: reembolso');
select is((select estado from public.ventas where id = pg_temp.i('O4')), 'anulada', 'la venta queda anulada');
select is(pg_temp.esperado(), 60::numeric, 'el efectivo sale del esperado');
select is((select estado || '/' || motivo_anulacion || '/' || anulada_por::text from public.ordenes where id = pg_temp.i('O4')),
  'cancelada/cliente se arrepintió/' || pg_temp.i('x')::text, 'la orden guarda motivo y quién');
select is((select motivo from public.orden_eventos where orden_id = pg_temp.i('O4') and estado = 'cancelada'), 'cliente se arrepintió', 'evento cancelada con motivo');
select is(public.anular_orden(pg_temp.i('O4'), 'cliente se arrepintió') ->> 'reembolso', 'true', 'anular repetida: igual');
select is(pg_temp.eventos('O4'), 2, 'anular repetida no suma evento');
select throws_ok($$select public.anular_orden(pg_temp.i('O4'), 'otro motivo')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'anular repetida con otro motivo');
select throws_ok($$select public.cambiar_estado_orden(pg_temp.i('O4'), 'en_lavado')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'una orden cancelada no cambia de estado');
select throws_ok($$select public.entregar_orden(pg_temp.i('O4'), 'Ana', 'boleta')$$, 'P0001', 'ERP_ORDEN_ESTADO', 'una orden cancelada no se entrega');

-- Anulación con la caja cerrada: la orden se cancela, el dinero no se toca
select is(public.crear_orden(pg_temp.vl('O5', 'L2-000001', jsonb_build_object('dispositivo_id', pg_temp.i('DL2'),
  'caja_sesion_id', pg_temp.i('SL2'))), pg_temp.o()) ->> 'numero', 'L2-000001', 'orden en otra caja');
select public.cerrar_caja(pg_temp.i('SL2'), 30);
select is(public.anular_orden(pg_temp.i('O5'), 'devuelta mañana'), jsonb_build_object('id', pg_temp.i('O5'), 'estado', 'cancelada', 'reembolso', false),
  'anular con caja cerrada: sin reembolso');
select is((select estado from public.ventas where id = pg_temp.i('O5')), 'completada', 'la venta sigue completada');
select is(public.anular_orden(pg_temp.i('O5'), 'devuelta mañana') ->> 'reembolso', 'false', 'repetida con caja cerrada: igual');
-- Camino documentado del reembolso: la orden cancelada con caja cerrada se devuelve desde una caja abierta (SL)
select lives_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('DV5'), 'venta_id', pg_temp.i('O5'),
  'dispositivo_id', pg_temp.i('DL'), 'caja_sesion_id', pg_temp.i('SL'), 'medio', 'efectivo', 'motivo', 'reembolso orden',
  'items', jsonb_build_array(jsonb_build_object('venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('O5')), 'cantidad', 2))))$$,
  'devolver_venta de una orden cancelada con caja cerrada');
select is((select count(*)::integer from public.devoluciones where id = pg_temp.i('DV5') and venta_id = pg_temp.i('O5')), 1, 'la devolución existe');
select throws_ok($$select public.anular_venta(pg_temp.i('O5'), 'x')$$, 'P0001', 'ERP_CAJA_CERRADA', 'orden cancelada: anular_venta vuelve a sus reglas');

-- Una orden entregada ya no es activa: su venta se devuelve como cualquier otra
select lives_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('DV1'), 'venta_id', pg_temp.i('O1'),
  'dispositivo_id', pg_temp.i('DL'), 'caja_sesion_id', pg_temp.i('SL'), 'medio', 'efectivo', 'motivo', 'entregada devuelta',
  'items', jsonb_build_array(jsonb_build_object('venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('O1')), 'cantidad', 2))))$$,
  'devolver_venta de una orden entregada');

-- crear_orden sobre una venta ya anulada
select public.registrar_venta(pg_temp.vl('V7', 'L1-000007'));
select public.anular_venta(pg_temp.i('V7'), 'error de caja');
select throws_ok($$select public.crear_orden(pg_temp.vl('V7', 'L1-000007'), pg_temp.o())$$, 'P0001', 'ERP_VENTA_ANULADA', 'crear_orden sobre una venta anulada');

-- Offline la venta ya se cobró: una fecha prometida pasada se acepta
select is(public.crear_orden(pg_temp.vl('O6', 'L1-000008'), pg_temp.o('{"fecha_prometida": "2000-01-01"}'), pg_temp.off('x')) ->> 'estado',
  'recibida', 'offline con fecha prometida pasada: se crea');
select is((select count(*)::integer from public.ordenes where id = pg_temp.i('O6')), 1, 'la orden offline existe');

-- La ficha de recepción no se edita ni se borra, ni siquiera el dueño de la base
select pg_temp.como(pg_temp.i('x'));
reset role;
select throws_ok($$update public.ordenes set prendas = 9 where id = $$ || quote_literal(pg_temp.i('O1')), 'P0001', 'ERP_SOLO_AGREGAR', 'la ficha no se edita');
select throws_ok($$delete from public.orden_eventos$$, 'P0001', 'ERP_SOLO_AGREGAR', 'eventos append-only');
select * from finish();
rollback;
