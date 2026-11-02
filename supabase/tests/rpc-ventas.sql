-- registrar_venta: permisos, validación del payload, idempotencia, aritmética, descuentos, series, numeración,
-- foto de precio/costo/tipo de cambio y kardex. Cubre DB-01, DB-08, DB-11, DB-13, DB-15.
begin;
select plan(109);
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
-- Cliente de L (la lavandería exige cliente)
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

-- Permisos de ejecución
select ok(has_function_privilege('authenticated', 'public.registrar_venta(jsonb, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.registrar_venta(jsonb, jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.efectivo_esperado(uuid)', 'EXECUTE'), 'registrar_venta: authenticated sí, anon no');

-- Permisos y forma del payload
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C1-000001', 2))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador no vende');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C1-000001', 2))$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no vende en mi equipo');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C1-000001', 2) || '{"extra": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10, '{"x": 1}')), jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'clave desconocida en item');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10) || '{"cantidad": "2"}'), jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad como string');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, '[]', jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'sin items');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, (select jsonb_agg(pg_temp.it('P1', 1, 0.1)) from generate_series(1, 201)), jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'más de 200 items');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), '[]'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'sin pagos');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C2-000001', 2))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'número con prefijo de otro equipo');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C1-1', 2))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'número mal formado');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10.005)), jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precio con 3 decimales');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C1-000001', 2) || jsonb_build_object('cliente_id', pg_temp.i('nadie')))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cliente inexistente');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_venta(pg_temp.v('VL0', 'DL', 'SL', 'L1-000009', 15, jsonb_build_array(pg_temp.it('PLV', 1, 15)), jsonb_build_array(pg_temp.pg('efectivo', 15))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lavandería exige cliente');
select pg_temp.como(pg_temp.i('v'));
select is((select count(*) from public.ventas)::integer, 0, 'nada escrito tras los rechazos');

-- Estado de la caja
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'SC', 'C1-000001', 2))$$, 'P0001', 'ERP_CAJA_CERRADA', 'sesión cerrada');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S2', 'C1-000001', 2))$$, 'P0001', 'ERP_CAJA_CERRADA', 'sesión de otro equipo');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V1', 'D1', 'SL', 'C1-000001', 2))$$, 'P0001', 'ERP_CAJA_CERRADA', 'sesión de otro negocio');

-- Reglas de producto
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 10, jsonb_build_array(pg_temp.it('PX', 1, 9)), jsonb_build_array(pg_temp.pg('efectivo', 9))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto de otro negocio');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 30, jsonb_build_array(pg_temp.it('PV', 1, 30)), jsonb_build_array(pg_temp.pg('efectivo', 30))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'servicio fuera de lavandería');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 15, jsonb_build_array(pg_temp.it('P1', 1.5, 10)), jsonb_build_array(pg_temp.pg('efectivo', 15))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad decimal en unidad');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('PK', 1.0001, 20)), jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'kg con 4 decimales');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 5, jsonb_build_array(pg_temp.it('PN', 1, 5)), jsonb_build_array(pg_temp.pg('efectivo', 5))))$$, 'P0001', 'ERP_PRODUCTO_SIN_PRECIO', 'producto sin precio');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 12, jsonb_build_array(pg_temp.it('P1', 1, 12, '{"lista": "credito"}')), jsonb_build_array(pg_temp.pg('efectivo', 12))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lista crédito no aceptada');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 15, jsonb_build_array(pg_temp.it('P1', 1, 10, '{"lista": "mayorista"}')), jsonb_build_array(pg_temp.pg('efectivo', 15))))$$, 'P0001', 'ERP_PRODUCTO_SIN_PRECIO', 'lista sin precio para el producto');

-- Aritmética (DB-11) y pagos
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 21, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 21))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'total enviado distinto del calculado');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 19.99))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagos no suman el total');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 30), pg_temp.pg('qr', -10))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pago negativo');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('cheque', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'medio inválido');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('qr', 20))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'qr sin verificado');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('qr', 20, false))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'qr con verificado false');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 20, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('qr', 20) || '{"verificado": "si"}')))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'verificado no booleano');

-- Descuentos (RF-VEN-03, DB-13)
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 19, jsonb_build_array(pg_temp.it('P1', 2, 10, '{"descuento": 1}')), jsonb_build_array(pg_temp.pg('efectivo', 19))))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor sin descontar: descuento de línea');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 19, jsonb_build_array(pg_temp.it('P1', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 19)), '{"descuento": 1}'))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor sin descontar: descuento de venta');
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 14, jsonb_build_array(pg_temp.it('P1', 2, 7)), jsonb_build_array(pg_temp.pg('efectivo', 14))))$$, 'P0001', 'ERP_SIN_PERMISO', 'precio bajo la lista mínimo exige descontar');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 88, jsonb_build_array(pg_temp.it('P1', 10, 10, '{"descuento": 6}')), jsonb_build_array(pg_temp.pg('efectivo', 88)), '{"descuento": 6}'))$$, 'P0001', 'ERP_DESCUENTO_TOPE', 'descuento total 12% sobre el tope de 10% (DB-13)');
select lives_ok($$select public.registrar_venta(pg_temp.v('V1', 'D1', 'S1', 'C1-000001', 90, jsonb_build_array(pg_temp.it('P1', 10, 10, '{"descuento": 4}')), jsonb_build_array(pg_temp.pg('efectivo', 90)), '{"descuento": 6}'))$$, 'descuento justo en el tope (10%) pasa con descontar');
select is((select descuento_venta || '/' || descuento || '/' || total_linea from public.venta_items where venta_id = pg_temp.i('V1')), '6.00/4.00/96.00', 'el descuento de venta se reparte en la línea');
select is((select subtotal || '/' || descuento || '/' || total from public.ventas where id = pg_temp.i('V1')), '100.00/6.00/90.00', 'subtotal bruto, descuento y total guardados');

-- Camino feliz, foto y kardex (DB-08)
select pg_temp.como(pg_temp.i('v'));
select is(public.registrar_venta(pg_temp.v1('V2', 'D1', 'S1', 'C1-000002', 2)), jsonb_build_object('id', pg_temp.i('V2'), 'numero', 'C1-000002', 'total', 20.00), 'venta feliz devuelve {id, numero, total}');
reset role;
select is((select vendedor_id = pg_temp.i('v') and enviada_por = pg_temp.i('v') and origen = 'online' and estado = 'completada'
  and tipo_cambio = 7 and ubicacion_id = pg_temp.i('U1') from public.ventas where id = pg_temp.i('V2')), true, 'vendedor, origen, tipo de cambio y ubicación');
select is((select precio_unitario || '/' || precio_lista_servidor || '/' || costo_unitario from public.venta_items where venta_id = pg_temp.i('V2')), '10.00/10.00/4.0000', 'precio visto, precio de lista y costo promedio (foto)');
select is((select tipo || '/' || cantidad || '/' || ref_tipo from public.movimientos_inventario where ref_id = pg_temp.i('V2')), 'venta/-2.000/venta', 'un movimiento venta negativo');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1')), 88.000, 'stock de P1 tras V1 (10) y V2 (2)');
select is((select ultimo_numero from public.dispositivos where id = pg_temp.i('D1')), 2, 'ultimo_numero avanza');
select is((select verificacion from public.venta_pagos where venta_id = pg_temp.i('V2')), 'no_aplica', 'efectivo no_aplica');

-- Cambios posteriores no alteran la venta pasada (DB-08)
update public.producto_precios set monto = 99 where producto_id = pg_temp.i('P1') and lista = 'contado';
insert into public.tipos_cambio (negocio_id, valor) values (pg_temp.i('T'), 8);
select is((select precio_lista_servidor || '/' || tipo_cambio from public.venta_items vi join public.ventas v on v.id = vi.venta_id where v.id = pg_temp.i('V2')), '10.00/7.0000', 'precio y tipo de cambio de V2 intactos tras el cambio');
update public.producto_precios set monto = 10 where producto_id = pg_temp.i('P1') and lista = 'contado';
select pg_temp.como(pg_temp.i('v'));
-- USD: 5 * 8 = 40
select lives_ok($$select public.registrar_venta(pg_temp.v('V3', 'D1', 'S1', 'C1-000003', 40, jsonb_build_array(pg_temp.it('PU', 1, 40)), jsonb_build_array(pg_temp.pg('efectivo', 40))))$$, 'producto en USD con el tipo de cambio vigente');
select is((select tipo_cambio from public.ventas where id = pg_temp.i('V3')), 8.0000, 'V3 guarda el tipo de cambio nuevo');

-- Idempotencia (DB-01)
select is(public.registrar_venta(pg_temp.v1('V2', 'D1', 'S1', 'C1-000002', 2)), jsonb_build_object('id', pg_temp.i('V2'), 'numero', 'C1-000002', 'total', 20.00), 'reenvío igual devuelve lo original');
select is((select count(*) from public.ventas where id = pg_temp.i('V2'))::integer, 1, 'una sola venta');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('V2'))::integer, 1, 'un solo movimiento');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V2', 'D1', 'S1', 'C1-000002', 3))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro total');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V2', 'D1', 'S1', 'C1-000009', 2))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro número');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V2', 'D2', 'S2', 'C2-000002', 2))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id, otro equipo');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_venta(pg_temp.v1('V2', 'DL', 'SL', 'L1-000002', 2))$$, 'P0001', 'ERP_SIN_PERMISO', 'id de una venta de otro negocio');
select lives_ok($$select public.registrar_venta(pg_temp.v('VL', 'DL', 'SL', 'L1-000001', 15, jsonb_build_array(pg_temp.it('PLV', 1, 15)), jsonb_build_array(pg_temp.pg('qr', 15, true)), jsonb_build_object('cliente_id', pg_temp.i('CL'))))$$, 'servicio en lavandería: se vende');
select is((select count(*) from public.venta_pagos where venta_id = pg_temp.i('VL') and verificacion = 'verificado')::integer, 1, 'qr verificado');
select is((select count(*) from public.ventas)::integer, 1, 'x solo ve la venta de L (RLS)');
select pg_temp.como(pg_temp.i('v'));

-- Numeración
select throws_ok($$select public.registrar_venta(pg_temp.v1('V4', 'D1', 'S1', 'C1-000002', 1))$$, 'P0001', 'ERP_NUMERO_DUPLICADO', 'número repetido con otro id');
select lives_ok($$select public.registrar_venta(pg_temp.v1('V5', 'D1', 'S1', 'C1-000010', 1))$$, 'número más alto');
select lives_ok($$select public.registrar_venta(pg_temp.v1('V4', 'D1', 'S1', 'C1-000004', 1))$$, 'reintento con el mismo UUID y número nuevo');
select is((select ultimo_numero from public.dispositivos where id = pg_temp.i('D1')), 10, 'ultimo_numero no retrocede');

-- kg: 3 decimales, total con 2 (DB-11)
select lives_ok($$select public.registrar_venta(pg_temp.v('V6', 'D2', 'S2', 'C2-000001', 25, jsonb_build_array(pg_temp.it('PK', 1.250, 20)), jsonb_build_array(pg_temp.pg('efectivo', 10), pg_temp.pg('qr', 15, true))))$$, 'venta por kg con pago mixto');
reset role;
select is((select cantidad::text from public.venta_items where venta_id = pg_temp.i('V6')), '1.250', 'cantidad con 3 decimales');
select is((select string_agg(medio || ':' || verificacion, ',' order by medio) from public.venta_pagos where venta_id = pg_temp.i('V6')), 'efectivo:no_aplica,qr:verificado', 'el pago qr guardado queda verificado');

-- Series (DB-15)
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v('V7', 'D1', 'S1', 'C1-000011', 100, jsonb_build_array(pg_temp.it('PS', 1, 100, jsonb_build_object('serie_id', pg_temp.i('SE1')))), jsonb_build_array(pg_temp.pg('efectivo', 100))))$$, 'venta con serie disponible');
select is((select estado from public.series where id = pg_temp.i('SE1')), 'vendida', 'la serie pasa a vendida');
select throws_ok($$select public.registrar_venta(pg_temp.v('V8', 'D1', 'S1', 'C1-000012', 100, jsonb_build_array(pg_temp.it('PS', 1, 100, jsonb_build_object('serie_id', pg_temp.i('SE1')))), jsonb_build_array(pg_temp.pg('efectivo', 100))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'no se vende dos veces la misma serie');
select throws_ok($$select public.registrar_venta(pg_temp.v('V8', 'D1', 'S1', 'C1-000012', 100, jsonb_build_array(pg_temp.it('PS', 1, 100)), jsonb_build_array(pg_temp.pg('efectivo', 100))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto con serie exige serie');
select throws_ok($$select public.registrar_venta(pg_temp.v('V8', 'D1', 'S1', 'C1-000012', 200, jsonb_build_array(pg_temp.it('PS', 2, 100, jsonb_build_object('serie_id', pg_temp.i('SE2')))), jsonb_build_array(pg_temp.pg('efectivo', 200))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad 2 con una serie');
select throws_ok($$select public.registrar_venta(pg_temp.v('V8', 'D1', 'S1', 'C1-000012', 10, jsonb_build_array(pg_temp.it('P1', 1, 10, jsonb_build_object('serie_id', pg_temp.i('SE2')))), jsonb_build_array(pg_temp.pg('efectivo', 10))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie en producto sin serie');
select is((select estado from public.series where id = pg_temp.i('SE2')), 'disponible', 'una venta rechazada no toca la serie');

-- Piso de precio y tope (RF-VEN-03). P1: lista 10, mínimo 8. PK: lista 20, sin mínimo. Equipo D3.
select throws_ok($$select public.registrar_venta(pg_temp.v('V9', 'D3', 'S3', 'C3-000001', 0.01, jsonb_build_array(pg_temp.it('PK', 1, 0.01)), jsonb_build_array(pg_temp.pg('efectivo', 0.01))))$$, 'P0001', 'ERP_SIN_PERMISO', 'sin mínimo, bajo la lista exige descontar aunque sea 0.01');
select throws_ok($$select public.registrar_venta(pg_temp.v('V9', 'D3', 'S3', 'C3-000001', 0, jsonb_build_array(pg_temp.it('PK', 1, 0)), jsonb_build_array(pg_temp.pg('efectivo', 0))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'precio 0');
reset role;
update public.negocios set tope_descuento = 0 where id = pg_temp.i('T');
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v('V9', 'D3', 'S3', 'C3-000001', 9, jsonb_build_array(pg_temp.it('P1', 1, 9)), jsonb_build_array(pg_temp.pg('efectivo', 9))))$$, 'entre mínimo y lista: sin permiso y con tope 0');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.registrar_venta(pg_temp.v('V10', 'D3', 'S3', 'C3-000002', 19, jsonb_build_array(pg_temp.it('PK', 1, 19)), jsonb_build_array(pg_temp.pg('efectivo', 19))))$$, 'P0001', 'ERP_DESCUENTO_TOPE', 'con descontar y tope 0 no se baja del piso');
reset role;
update public.negocios set tope_descuento = 10 where id = pg_temp.i('T');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select public.registrar_venta(pg_temp.v('V10', 'D3', 'S3', 'C3-000002', 70, jsonb_build_array(pg_temp.it('P1', 10, 7)), jsonb_build_array(pg_temp.pg('efectivo', 70))))$$, 'P0001', 'ERP_DESCUENTO_TOPE', 'brecha de 10 sobre base 80 (12.5%) excede el tope de 10%');
select lives_ok($$select public.registrar_venta(pg_temp.v('V10', 'D3', 'S3', 'C3-000002', 75, jsonb_build_array(pg_temp.it('P1', 10, 7.5)), jsonb_build_array(pg_temp.pg('efectivo', 75))))$$, 'brecha de 5 sobre base 80 (6.25%) pasa');
select is((select subtotal from public.ventas where id = pg_temp.i('V10')), 75.00, 'subtotal guardado = bruto enviado');
select pg_temp.como(pg_temp.i('v'));

-- Huella, salto de numeración y fecha del cliente
select throws_ok($$select public.registrar_venta(pg_temp.v('V2', 'D1', 'S1', 'C1-000002', 20, jsonb_build_array(pg_temp.it('PK', 2, 10)), jsonb_build_array(pg_temp.pg('efectivo', 20))))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id con otros productos, mismo total y número de líneas');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V11', 'D3', 'S3', 'C3-001500', 1))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'número a más de 1000 del último');
select is(public.registrar_venta(pg_temp.v1('V2', 'D1', 'S1', 'C1-000002', 2)) ->> 'numero', 'C1-000002', 'el reenvío sigue funcionando con el último número más alto');
select lives_ok($$select public.registrar_venta(pg_temp.v1('V11', 'D3', 'S3', 'C3-001002', 1))$$, 'justo ultimo_numero + 1000');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V12', 'D3', 'S3', 'C3-002003', 1))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ultimo_numero + 1001');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V12', 'D3', 'S3', 'C3-001003', 1) || '{"creada_en_cliente": "infinity"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'fecha infinity');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V12', 'D3', 'S3', 'C3-001003', 1) || '{"creada_en_cliente": "2026-01-01T00:00:00+99:99"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'zona fuera de rango');
select throws_ok($$select public.registrar_venta(pg_temp.v1('V12', 'D3', 'S3', 'C3-001003', 1) || '{"creada_en_cliente": "2026-13-45T00:00:00Z"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'fecha imposible');
select lives_ok($$select public.registrar_venta(pg_temp.v1('V12', 'D3', 'S3', 'C3-001003', 1) || '{"creada_en_cliente": "2026-01-01T12:00:00Z"}')$$, 'fecha ISO con Z');

-- fijar_tope_descuento
select pg_temp.como(pg_temp.i('d'));
select is(public.fijar_tope_descuento(pg_temp.i('T'), 12.5), 12.5, 'el dueño fija el tope y recibe el valor');
select is((select tope_descuento from public.negocios where id = pg_temp.i('T')), 12.50, 'guardado');
select is((select (antes ->> 'tope_descuento')::numeric || '/' || (despues ->> 'tope_descuento')::numeric || '/' || usuario_id::text || '/' || (select count(*) from public.auditoria where tabla = 'negocios')
  from public.auditoria where tabla = 'negocios' and registro_id = pg_temp.i('T')::text and negocio_id = pg_temp.i('T')), '10.00/12.5/' || pg_temp.i('d')::text || '/1', 'el cambio queda auditado con antes y después');
select public.fijar_tope_descuento(pg_temp.i('T'), 12.5);
select is((select count(*) from public.auditoria where tabla = 'negocios')::integer, 1, 'fijar el mismo valor no audita');
select throws_ok($$select public.fijar_tope_descuento(pg_temp.i('T'), 101)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tope sobre 100');
select throws_ok($$select public.fijar_tope_descuento(pg_temp.i('T'), -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tope negativo');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.fijar_tope_descuento(pg_temp.i('T'), 5)$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor no fija el tope');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.fijar_tope_descuento(pg_temp.i('T'), 5)$$, 'P0001', 'ERP_SIN_PERMISO', 'dueño de otro negocio no fija el tope');

-- Un producto vendido no cambia de naturaleza aunque no tenga kardex (servicio vendido en VL)
select throws_ok($$select public.guardar_producto(pg_temp.i('L'), '{"codigo": "PLV", "nombre": "PLV", "tipo": "insumo"}'::jsonb || jsonb_build_object('id', pg_temp.i('PLV')))$$, 'P0001', 'ERP_PRODUCTO_CON_MOVIMIENTOS', 'servicio vendido no pasa a insumo');
select lives_ok($$select public.guardar_producto(pg_temp.i('L'), '{"codigo": "PLV", "nombre": "PLV2", "tipo": "servicio"}'::jsonb || jsonb_build_object('id', pg_temp.i('PLV')))$$, 'sí se renombra');
select pg_temp.como(pg_temp.i('v'));

-- Piso = el menor entre mínimo y lista: mayorista (6) bajo el mínimo (8) se vende a su precio sin `descontar`
reset role;
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PY'), pg_temp.i('T'), 'PY', 'PY', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('PY'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('PY'), 'minimo', 8, 'BOB'),
  (pg_temp.i('T'), pg_temp.i('PY'), 'mayorista', 6, 'BOB');
update public.negocios set tope_descuento = 0 where id = pg_temp.i('T');
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VY1', 'D1', 'S1', 'C1-000013', 6, jsonb_build_array(pg_temp.it('PY', 1, 6, '{"lista": "mayorista"}')), jsonb_build_array(pg_temp.pg('efectivo', 6))))$$, 'lista mayorista bajo el mínimo a su precio exacto, sin descontar y con tope 0');
select throws_ok($$select public.registrar_venta(pg_temp.v('VY2', 'D1', 'S1', 'C1-000014', 5.99, jsonb_build_array(pg_temp.it('PY', 1, 5.99, '{"lista": "mayorista"}')), jsonb_build_array(pg_temp.pg('efectivo', 5.99))))$$, 'P0001', 'ERP_SIN_PERMISO', 'un centavo bajo la lista mayorista exige descontar');

-- Inmutabilidad y costos ocultos
select throws_ok($$update public.ventas set total = 1 where id = pg_temp.i('V2')$$, '42501', null, 'authenticated no actualiza ventas');
select throws_ok($$select costo_unitario from public.venta_items$$, '42501', null, 'vendedor no lee venta_items.costo_unitario');
select lives_ok($$select id, precio_unitario, total_linea from public.venta_items$$, 'vendedor lee las columnas sin costo');
reset role;
select throws_ok($$update public.ventas set total = 1 where id = pg_temp.i('V2')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'ni el dueño de la base cambia el total');
select throws_ok($$delete from public.ventas where id = pg_temp.i('V2')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'venta no se borra');
select throws_ok($$update public.venta_items set cantidad = 9 where venta_id = pg_temp.i('V2')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'venta_items append-only');
select throws_ok($$delete from public.venta_pagos where venta_id = pg_temp.i('V2')$$, 'P0001', 'ERP_SOLO_AGREGAR', 'venta_pagos append-only');
select is((select count(*) from public.stock s where negocio_id = pg_temp.i('T')
  and cantidad <> (select coalesce(sum(m.cantidad), 0) from public.movimientos_inventario m where m.producto_id = s.producto_id and m.ubicacion_id = s.ubicacion_id))::integer, 0, 'stock = suma del kardex');

select * from finish();
rollback;
