-- reporte_ventas, reporte_stock, reporte_caja: permisos, rangos, fechas de La Paz, devoluciones, ganancia con costo foto,
-- costos ocultos sin ver_costos, kg, servicios sin costo, última salida del kardex y coincidencia de la caja con resumen_caja.
begin;
select plan(72);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8200' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de T · v vendedor de T (caja, sin ver_reportes) · c contador de T (ver_reportes y ver_costos) · x dueño de L · n sin rol
select pg_temp.crear_usuario(n) from (values ('d'), ('v'), ('c'), ('x'), ('n')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('U2'), pg_temp.i('T'), 'U2', 'local'),
  (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'Caja 1', 'C1'),
  (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'Caja 2', 'C2'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 50);
insert into public.categorias (id, negocio_id, nombre) values (pg_temp.i('CA'), pg_temp.i('T'), 'Cat A');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, categoria_id, marca, stock_minimo, peso_paquete_kg) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'Uno', 'producto', 'unidad', pg_temp.i('CA'), 'M1', 200, null),
  (pg_temp.i('PK'), pg_temp.i('T'), 'PK', 'Kilo', 'producto', 'kg', null, null, null, null),
  (pg_temp.i('PP'), pg_temp.i('T'), 'PP', 'Paquete', 'producto', 'unidad', null, null, null, 2.5),
  (pg_temp.i('PN'), pg_temp.i('T'), 'PN', 'SinCosto', 'producto', 'unidad', null, null, null, null),
  (pg_temp.i('PV'), pg_temp.i('T'), 'PV', 'Servicio', 'servicio', 'unidad', null, null, null, null);
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, activo) values
  (pg_temp.i('PI'), pg_temp.i('T'), 'PI', 'Inactivo', 'producto', 'unidad', false);
-- Para la última salida: PC insumo con consumo reciente · PM con merma reciente · PG con stock negativo en U2 · PQ sin costo
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad) values
  (pg_temp.i('PC'), pg_temp.i('T'), 'PC', 'Insumo', 'insumo', 'unidad'),
  (pg_temp.i('PM'), pg_temp.i('T'), 'PM', 'Merma', 'producto', 'unidad'),
  (pg_temp.i('PG'), pg_temp.i('T'), 'PG', 'Negativo', 'producto', 'unidad'),
  (pg_temp.i('PQ'), pg_temp.i('T'), 'PQ', 'SinCostoStock', 'producto', 'unidad');
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB');
-- Stock neto: P1 100 a 4 (mínimo 200: bajo) · PK 50 a 12 · PP 10 a 20 · PC 5 a 2 · PM 5 a 3 · PG 16 (20 a 5 en U1, -4 en U2) ·
-- PQ 3 sin costo · PN sin stock. Las salidas llevan fecha relativa a now() (el kardex es la fuente de ultima_salida):
-- P1 venta hace 60 días (su traslado de ayer no cuenta) · PK venta hace 100 · PP venta hace 2 · PC consumo hace 2 ·
-- PM merma hace 1 · PG ajuste negativo ahora · PQ ninguna.
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, created_at) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 101, 4, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PK'), 'inicial', 51, 12, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PP'), 'inicial', 11, 20, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PC'), 'inicial', 6, 2, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PM'), 'inicial', 6, 3, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PG'), 'inicial', 20, 5, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PQ'), 'inicial', 3, null, now() - interval '200 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'venta', -1, null, now() - interval '60 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PK'), 'venta', -1, null, now() - interval '100 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PP'), 'venta', -1, null, now() - interval '2 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PC'), 'consumo', -1, null, now() - interval '2 days'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PM'), 'merma', -1, null, now() - interval '1 day'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'traslado_salida', -1, null, now() - interval '1 day'),
  (pg_temp.i('T'), pg_temp.i('U2'), pg_temp.i('P1'), 'traslado_entrada', 1, 4, now() - interval '1 day'),
  (pg_temp.i('T'), pg_temp.i('U2'), pg_temp.i('PG'), 'ajuste', -4, null, now());

-- Ventas directas (fechas fijas, para reporte_ventas) en la sesión S2.
create function pg_temp.vta(p_id text, p_num text, p_vend text, p_ts timestamptz, p_total numeric, p_anulada boolean default false)
returns void language sql as $$
  insert into public.ventas (id, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por,
    origen, creada_en_cliente, recibida_en, subtotal, descuento, total, estado, anulada_en, anulada_por, motivo_anulacion, huella)
  values (pg_temp.i(p_id), pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('D2'), pg_temp.i('S2'), p_num, pg_temp.i(p_vend),
    pg_temp.i(p_vend), 'online', p_ts, p_ts, p_total, 0, p_total, case when p_anulada then 'anulada' else 'completada' end,
    case when p_anulada then p_ts end, case when p_anulada then pg_temp.i('d') end, case when p_anulada then 'x' end, 'h')
$$;
create function pg_temp.lin(p_venta text, p_linea int, p_prod text, p_cant numeric, p_precio numeric, p_desc_venta numeric, p_costo numeric)
returns void language sql as $$
  insert into public.venta_items (negocio_id, venta_id, linea, producto_id, lista, cantidad, precio_unitario,
    precio_lista_servidor, total_linea, descuento_venta, costo_unitario)
  values (pg_temp.i('T'), pg_temp.i(p_venta), p_linea, pg_temp.i(p_prod), 'contado', p_cant, p_precio, p_precio,
    round(p_cant * p_precio, 2), p_desc_venta, p_costo)
$$;
create function pg_temp.dev(p_id text, p_venta text, p_ts timestamptz, p_cant numeric, p_monto numeric) returns void language sql as $$
  with d as (
    insert into public.devoluciones (id, negocio_id, venta_id, dispositivo_id, usuario_id, motivo, monto, monto_efectivo,
      caja_sesion_id, created_at, huella)
    values (pg_temp.i(p_id), pg_temp.i('T'), pg_temp.i(p_venta), pg_temp.i('D2'), pg_temp.i('d'), 'm', p_monto, 0,
      pg_temp.i('S2'), p_ts, 'h') returning id)
  insert into public.devolucion_items (negocio_id, devolucion_id, venta_item_id, cantidad, monto)
  select pg_temp.i('T'), d.id, (select id from public.venta_items where venta_id = pg_temp.i(p_venta) order by linea limit 1),
         p_cant, p_monto from d
$$;
-- V1 (v, 10-mar 23:30 La Paz): 10 P1 a 10 (costo 4) + 2,5 kg PK a 20 (costo 12)
select pg_temp.vta('V1', 'C2-000001', 'v', '2026-03-10 23:30:00-04', 150);
select pg_temp.lin('V1', 1, 'P1', 10, 10, 0, 4);
select pg_temp.lin('V1', 2, 'PK', 2.5, 20, 0, 12);
-- V2 (d, 11-mar): 4 PP a 30 (costo 20, descuento de venta 12) + 1 PN a 50 (sin costo, descuento de venta 5) = 153
select pg_temp.vta('V2', 'C2-000002', 'd', '2026-03-11 10:00:00-04', 153);
select pg_temp.lin('V2', 1, 'PP', 4, 30, 12, 20);
select pg_temp.lin('V2', 2, 'PN', 1, 50, 5, null);
-- V3 anulada (10-mar) y V0 fuera del rango (1-mar, d)
select pg_temp.vta('V3', 'C2-000003', 'v', '2026-03-10 12:00:00-04', 50, true);
select pg_temp.lin('V3', 1, 'P1', 5, 10, 0, 4);
select pg_temp.vta('V0', 'C2-000004', 'd', '2026-03-01 12:00:00-04', 30);
select pg_temp.lin('V0', 1, 'P1', 3, 10, 0, 4);
-- Devoluciones: de V1 (2 P1, 20) el 11-mar, y de V0 (1 P1, 10) el 11-mar, aunque V0 esté fuera del rango.
select pg_temp.dev('DV1', 'V1', '2026-03-11 09:00:00-04', 2, 20);
select pg_temp.dev('DV0', 'V0', '2026-03-11 11:00:00-04', 1, 10);
-- Venta reciente de PP
select pg_temp.vta('VR', 'C2-000005', 'v', now(), 30);
select pg_temp.lin('VR', 1, 'PP', 1, 30, 0, 20);
-- V4 (d, 20-mar): solo un servicio (costo null por diseño: cuenta como costo 0, no como línea sin costo)
select pg_temp.vta('V4', 'C2-000006', 'd', '2026-03-20 10:00:00-04', 40);
select pg_temp.lin('V4', 1, 'PV', 1, 40, 0, null);

create function pg_temp.rv(p_agrupar text, p_desde date default '2026-03-09', p_hasta date default '2026-03-12') returns jsonb
language sql as $$ select public.reporte_ventas(pg_temp.i('T'), p_desde, p_hasta, p_agrupar) $$;

select ok(has_function_privilege('authenticated', 'public.reporte_ventas(uuid, date, date, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reporte_stock(uuid, integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reporte_caja(uuid, date, date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reporte_ventas(uuid, date, date, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reporte_stock(uuid, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reporte_caja(uuid, date, date)', 'EXECUTE'), 'authenticated sí, anon no');

-- Permisos: sin rol, vendedor (sin ver_reportes) y dueño de otro negocio rechazados
select pg_temp.como(pg_temp.i(u)) from (values ('n')) q (u);
select throws_ok($$select pg_temp.rv('dia')$$, 'ERP_SIN_PERMISO', 'ventas: sin rol');
select throws_ok($$select public.reporte_stock(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'stock: sin rol');
select throws_ok($$select public.reporte_caja(pg_temp.i('T'), '2026-03-09', '2026-03-12')$$, 'ERP_SIN_PERMISO', 'caja: sin rol');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.rv('dia')$$, 'ERP_SIN_PERMISO', 'ventas: vendedor');
select throws_ok($$select public.reporte_stock(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'stock: vendedor');
select throws_ok($$select public.reporte_caja(pg_temp.i('T'), '2026-03-09', '2026-03-12')$$, 'ERP_SIN_PERMISO', 'caja: vendedor (tiene caja, no basta)');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.rv('dia')$$, 'ERP_SIN_PERMISO', 'ventas: otro negocio');
select throws_ok($$select public.reporte_stock(pg_temp.i('T'))$$, 'ERP_SIN_PERMISO', 'stock: otro negocio');
select throws_ok($$select public.reporte_caja(pg_temp.i('T'), '2026-03-09', '2026-03-12')$$, 'ERP_SIN_PERMISO', 'caja: otro negocio');

-- Contador: rangos y argumentos
select pg_temp.como(pg_temp.i('c'));
select lives_ok($$select pg_temp.rv('dia')$$, 'ventas: contador ok');
select throws_ok($$select pg_temp.rv('dia', '2026-03-12', '2026-03-09')$$, 'ERP_DATOS_INVALIDOS', 'ventas: desde > hasta');
select throws_ok($$select pg_temp.rv('dia', '2026-01-01', '2027-01-02')$$, 'ERP_DATOS_INVALIDOS', 'ventas: 367 días');
select lives_ok($$select pg_temp.rv('dia', '2026-01-01', '2027-01-01')$$, 'ventas: 366 días exactos ok');
select throws_ok($$select pg_temp.rv('dia', null, '2026-03-12')$$, 'ERP_DATOS_INVALIDOS', 'ventas: fecha nula');
select throws_ok($$select pg_temp.rv('semana')$$, 'ERP_DATOS_INVALIDOS', 'ventas: agrupación desconocida');
select throws_ok($$select pg_temp.rv(null)$$, 'ERP_DATOS_INVALIDOS', 'ventas: agrupación nula');
select throws_ok($$select public.reporte_caja(pg_temp.i('T'), '2026-03-12', '2026-03-09')$$, 'ERP_DATOS_INVALIDOS', 'caja: desde > hasta');
select throws_ok($$select public.reporte_caja(pg_temp.i('T'), '2026-01-01', '2027-01-02')$$, 'ERP_DATOS_INVALIDOS', 'caja: 367 días');
select lives_ok($$select public.reporte_caja(pg_temp.i('T'), '2026-01-01', '2027-01-01')$$, 'caja: 366 días ok');
select throws_ok($$select public.reporte_stock(pg_temp.i('T'), 0)$$, 'ERP_DATOS_INVALIDOS', 'stock: 0 días');
select throws_ok($$select public.reporte_stock(pg_temp.i('T'), 3651)$$, 'ERP_DATOS_INVALIDOS', 'stock: 3651 días');
select throws_ok($$select public.reporte_stock(pg_temp.i('T'), null)$$, 'ERP_DATOS_INVALIDOS', 'stock: días nulos');

-- reporte_ventas por día. 10-mar: V1 (23:30 La Paz = 11-mar 03:30 UTC cae el 10). 11-mar: V2 y las dos devoluciones.
select is(pg_temp.rv('dia') -> 'filas',
  '[{"clave":"2026-03-10","etiqueta":"2026-03-10","ventas":1,"cantidad":12.5,"kg":2.5,"bruto":150,"devuelto":0,"neto":150,"costo":70,"ganancia":80,"lineas_sin_costo":0},
    {"clave":"2026-03-11","etiqueta":"2026-03-11","ventas":1,"cantidad":2,"kg":10,"bruto":153,"devuelto":30,"neto":123,"costo":68,"ganancia":10,"lineas_sin_costo":1}]'::jsonb,
  'por día: 23:30 La Paz cae en su día, la devolución resta en su fecha (también la de una venta fuera del rango), anulada excluida');
select is(pg_temp.rv('dia') -> 'totales',
  '{"ventas":2,"cantidad":14.5,"kg":12.5,"bruto":303,"devuelto":30,"neto":273,"costo":138,"ganancia":90,"lineas_sin_costo":1}'::jsonb,
  'totales: ventas distintas, línea sin costo contada y fuera de la ganancia');
select is(pg_temp.rv('dia', '2026-03-11', '2026-03-11') -> 'totales' ->> 'ventas', '1', 'el día 11 solo ve V2 (no la de las 23:30 del 10)');
select is((pg_temp.rv('dia', '2026-03-10', '2026-03-10') -> 'totales' ->> 'bruto')::numeric, 150::numeric, 'el día 10 ve V1');
select is(pg_temp.rv('dia', '2026-03-05', '2026-03-09') -> 'filas', '[]'::jsonb, 'rango sin ventas: filas vacías');

-- Servicio (V4): costo null por diseño = costo 0; no cuenta como línea sin costo
select is(pg_temp.rv('dia', '2026-03-20', '2026-03-20') -> 'filas',
  '[{"clave":"2026-03-20","etiqueta":"2026-03-20","ventas":1,"cantidad":1,"kg":0,"bruto":40,"devuelto":0,"neto":40,"costo":0,"ganancia":40,"lineas_sin_costo":0}]'::jsonb,
  'servicio: costo 0 y ganancia = neto');
select is(pg_temp.rv('dia', '2026-03-20', '2026-03-20') -> 'totales' ->> 'lineas_sin_costo', '0', 'servicio: no suma lineas_sin_costo');

-- Por vendedor: neto desc. d: V2 + devolución de V0 · v: V1 + devolución de V1 (la V3 anulada no cuenta)
select is(pg_temp.rv('vendedor') -> 'filas',
  jsonb_build_array(
    jsonb_build_object('clave', pg_temp.i('d'), 'etiqueta', 'd', 'ventas', 1, 'cantidad', 4, 'kg', 10, 'bruto', 153, 'devuelto', 10,
      'neto', 143, 'costo', 76, 'ganancia', 22, 'lineas_sin_costo', 1),
    jsonb_build_object('clave', pg_temp.i('v'), 'etiqueta', 'v', 'ventas', 1, 'cantidad', 10.5, 'kg', 2.5, 'bruto', 150, 'devuelto', 20,
      'neto', 130, 'costo', 62, 'ganancia', 68, 'lineas_sin_costo', 0)),
  'por vendedor: devolución atribuida al vendedor de la venta original');

-- Por producto: P1 vendido 10 y devuelto 2 + 1 (de V0). Orden por neto: PP 108, PK 50, PN 45, P1 70 -> PP, P1, PK, PN
select is((select jsonb_agg(f ->> 'etiqueta') from jsonb_array_elements(pg_temp.rv('producto') -> 'filas') f),
  '["PP Paquete","P1 Uno","PK Kilo","PN SinCosto"]'::jsonb, 'por producto: etiqueta código + nombre, orden por neto desc');
select is((select f from jsonb_array_elements(pg_temp.rv('producto') -> 'filas') f where f ->> 'etiqueta' = 'P1 Uno'),
  jsonb_build_object('clave', pg_temp.i('P1'), 'etiqueta', 'P1 Uno', 'ventas', 1, 'cantidad', 7, 'kg', 0, 'bruto', 100, 'devuelto', 30,
    'neto', 70, 'costo', 28, 'ganancia', 42, 'lineas_sin_costo', 0), 'P1: la devolución resta con el mismo costo');
select is((select f from jsonb_array_elements(pg_temp.rv('producto') -> 'filas') f where f ->> 'etiqueta' = 'PP Paquete'),
  jsonb_build_object('clave', pg_temp.i('PP'), 'etiqueta', 'PP Paquete', 'ventas', 1, 'cantidad', 4, 'kg', 10, 'bruto', 108, 'devuelto', 0,
    'neto', 108, 'costo', 80, 'ganancia', 28, 'lineas_sin_costo', 0), 'PP: paquetes x peso_paquete_kg; bruto = total de línea menos su parte del descuento de la venta');
select is(((select f from jsonb_array_elements(pg_temp.rv('producto') -> 'filas') f where f ->> 'etiqueta' = 'PK Kilo') ->> 'kg')::numeric, 2.5::numeric, 'PK: unidad kg cuenta su cantidad');
select is((select f from jsonb_array_elements(pg_temp.rv('producto') -> 'filas') f where f ->> 'etiqueta' = 'PN SinCosto'),
  jsonb_build_object('clave', pg_temp.i('PN'), 'etiqueta', 'PN SinCosto', 'ventas', 1, 'cantidad', 1, 'kg', 0, 'bruto', 45, 'devuelto', 0,
    'neto', 45, 'costo', null, 'ganancia', null, 'lineas_sin_costo', 1),
  'PN: grupo sin ninguna línea con costo -> costo y ganancia null (no 0), con su línea sin costo');

-- Por categoría y marca: lo sin categoría/marca va con clave null
select is(pg_temp.rv('categoria') -> 'filas',
  jsonb_build_array(
    jsonb_build_object('clave', null, 'etiqueta', 'Sin categoría', 'ventas', 2, 'cantidad', 7.5, 'kg', 12.5, 'bruto', 203, 'devuelto', 0,
      'neto', 203, 'costo', 110, 'ganancia', 48, 'lineas_sin_costo', 1),  -- PP 28 + PK 20 (PN sin costo no aporta)
    jsonb_build_object('clave', pg_temp.i('CA'), 'etiqueta', 'Cat A', 'ventas', 1, 'cantidad', 7, 'kg', 0, 'bruto', 100, 'devuelto', 30,
      'neto', 70, 'costo', 28, 'ganancia', 42, 'lineas_sin_costo', 0)),
  'por categoría: "Sin categoría" con clave null');
select is((select jsonb_agg(f ->> 'etiqueta' order by f ->> 'etiqueta') from jsonb_array_elements(pg_temp.rv('marca') -> 'filas') f),
  '["M1","Sin marca"]'::jsonb, 'por marca: "Sin marca"');
select is((select f -> 'clave' from jsonb_array_elements(pg_temp.rv('marca') -> 'filas') f where f ->> 'etiqueta' = 'Sin marca'),
  'null'::jsonb, 'por marca: clave null');
select is(pg_temp.rv('marca') -> 'totales', pg_temp.rv('dia') -> 'totales', 'los totales no dependen de la agrupación');

-- Ganancia con costo foto: cambiar el costo promedio no la altera
reset role;
update public.stock set costo_promedio = 999 where producto_id in (pg_temp.i('P1'), pg_temp.i('PK'), pg_temp.i('PP'));
select pg_temp.como(pg_temp.i('c'));
select is((pg_temp.rv('dia') -> 'totales' ->> 'ganancia')::numeric, 90::numeric, 'costo foto: cambiar costo_promedio no altera la ganancia');

-- Sin ver_costos (el contador pierde el permiso dentro de la transacción)
reset role;
delete from public.rol_permisos where tipo_negocio = 'tienda' and rol = 'contador' and permiso = 'ver_costos';
select pg_temp.como(pg_temp.i('c'));
select is(pg_temp.rv('dia') -> 'totales',
  '{"ventas":2,"cantidad":14.5,"kg":12.5,"bruto":303,"devuelto":30,"neto":273,"costo":null,"ganancia":null,"lineas_sin_costo":1}'::jsonb,
  'sin ver_costos: costo y ganancia null en totales');
select is((select count(*) from jsonb_array_elements(pg_temp.rv('producto') -> 'filas') f
  where f -> 'costo' <> 'null'::jsonb or f -> 'ganancia' <> 'null'::jsonb), 0::bigint, 'sin ver_costos: costo y ganancia null en cada fila');
select is((pg_temp.rv('dia') -> 'filas' -> 0 ->> 'neto')::numeric, 150::numeric, 'sin ver_costos: el resto de columnas sigue');

-- reporte_stock (sin ver_costos todavía)
select is(public.reporte_stock(pg_temp.i('T')) -> 'totales', '{"productos":8,"stock_bajo":1,"sin_movimiento":3,"valor":null,"productos_sin_costo":null}'::jsonb,
  'stock: totales; servicio e inactivo fuera; valor y productos_sin_costo null sin ver_costos');
select is((select count(*) from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f -> 'valor' <> 'null'::jsonb),
  0::bigint, 'stock: valor null en cada fila sin ver_costos');
reset role;
insert into public.rol_permisos (tipo_negocio, rol, permiso) values ('tienda', 'contador', 'ver_costos');
select pg_temp.como(pg_temp.i('c'));
select is(public.reporte_stock(pg_temp.i('T')) -> 'totales', '{"productos":8,"stock_bajo":1,"sin_movimiento":3,"valor":159965,"productos_sin_costo":1}'::jsonb,
  'stock: valor = suma por ubicación de stock positivo x costo_promedio; PQ es el único con stock y sin costo');
select is((select f from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'P1'),
  jsonb_build_object('codigo', 'P1', 'nombre', 'Uno', 'categoria', 'Cat A', 'marca', 'M1', 'unidad', 'unidad', 'stock', 100,
    'stock_minimo', 200, 'stock_bajo', true, 'ultima_salida', (select to_jsonb(m.created_at) from public.movimientos_inventario m
      where m.producto_id = pg_temp.i('P1') and m.tipo = 'venta'),
    'sin_movimiento', true, 'valor', 99900), 'stock: fila de P1 (su traslado_salida de ayer no cuenta como salida)');
select is((select f ->> 'sin_movimiento' from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PP'),
  'false', 'stock: PP con venta reciente no está sin movimiento');
select is((select f ->> 'sin_movimiento' from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PN'),
  'false', 'stock: sin stock no está sin movimiento');
select is((select f ->> 'stock_bajo' from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PK'),
  'false', 'stock: sin mínimo no es stock bajo');
select is(public.reporte_stock(pg_temp.i('T'), 365) -> 'totales' ->> 'sin_movimiento', '1', 'stock: 365 días, solo PQ (sin ninguna salida)');
select is((select f ->> 'sin_movimiento' from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PC'),
  'false', 'stock: insumo con consumo reciente no está sin movimiento');
select is((select f ->> 'sin_movimiento' from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PM'),
  'false', 'stock: merma reciente cuenta como salida');
select is((select f ->> 'sin_movimiento' from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PG'),
  'false', 'stock: ajuste negativo reciente cuenta como salida');
select is((select (f ->> 'valor')::numeric from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f where f ->> 'codigo' = 'PG'),
  100::numeric, 'stock: el stock negativo de una ubicación (-4 en U2) no resta valor (20 x 5)');
select is((select count(*) from jsonb_array_elements(public.reporte_stock(pg_temp.i('T')) -> 'filas') f
  where f ->> 'codigo' in (select codigo from public.productos_stock_bajo(pg_temp.i('T'))) and f ->> 'stock_bajo' = 'false'),
  0::bigint, 'stock: stock_bajo coincide con productos_stock_bajo');

-- reporte_caja: sesión S1 con ventas por registrar_venta y movimientos (como el vendedor, que tiene caja)
create function pg_temp.pg(p_medio text, p_monto numeric, p_verif boolean default null) returns jsonb language sql as $$
  select jsonb_build_object('medio', p_medio, 'monto', p_monto) || case when p_verif is null then '{}' else jsonb_build_object('verificado', p_verif) end
$$;
create function pg_temp.vr(p_id text, p_num text, p_n numeric, p_pagos jsonb) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S1'),
    'numero', p_num, 'creada_en_cliente', now(), 'total', p_n * 10,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'lista', 'contado', 'cantidad', p_n, 'precio_unitario', 10)),
    'pagos', p_pagos)
$$;
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.vr('VA', 'C1-000001', 5, jsonb_build_array(pg_temp.pg('efectivo', 30), pg_temp.pg('qr', 20, true))))$$, 'VA mixta');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('M1'), pg_temp.i('S1'), 'ingreso', 25, 't')$$, 'ingreso');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('M2'), pg_temp.i('S1'), 'gasto', 7.5, 't')$$, 'gasto');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('M3'), pg_temp.i('S1'), 'retiro', 12, 't')$$, 'retiro');
select lives_ok($$select public.devolver_venta(jsonb_build_object('id', pg_temp.i('DA'), 'venta_id', pg_temp.i('VA'),
  'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S1'), 'medio', 'efectivo', 'motivo', 'm', 'items',
  jsonb_build_array(jsonb_build_object('venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i('VA')), 'cantidad', 1))))$$,
  'devolución en efectivo');
select pg_temp.como(pg_temp.i('c'));
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/La_Paz')::date $$;
select is((public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'totales' ->> 'sesiones'), '2', 'caja: dos sesiones de hoy');
select is(
  (select f - 'sesion_id' - 'abierta_en' from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f
   where f ->> 'sesion_id' = pg_temp.i('S1')::text),
  jsonb_build_object('equipo', 'Caja 1', 'prefijo', 'C1', 'cajero', 'd', 'cerrada_en', null, 'monto_inicial', 100,
    'ventas_efectivo', 30, 'ventas_qr', 20, 'qr_pendiente', 0, 'ingresos', 25, 'egresos', 19.5, 'devoluciones_efectivo', 10,
    'reservas_efectivo', 0, 'cuotas_efectivo', 0, 'esperado', 100 + 30 + 25 - 19.5 - 10, 'contado', null, 'diferencia', null),
  'caja: sesión S1 a mano');
select is(
  (select f ->> 'esperado' from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f
   where f ->> 'sesion_id' = pg_temp.i('S1')::text),
  (public.resumen_caja(pg_temp.i('S1')) ->> 'esperado'), 'caja: esperado = resumen_caja');
select is(
  (select jsonb_build_object('e', f -> 'ventas_efectivo', 'q', f -> 'ventas_qr', 'i', f -> 'ingresos', 'g', f -> 'egresos', 'd', f -> 'devoluciones_efectivo')
   from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f where f ->> 'sesion_id' = pg_temp.i('S2')::text),
  (select jsonb_build_object('e', r -> 'ventas_efectivo', 'q', r -> 'qr_neto', 'i', r -> 'ingresos',
     'g', (r ->> 'gastos')::numeric + (r ->> 'retiros')::numeric, 'd', r -> 'devoluciones_efectivo') from (select public.resumen_caja(pg_temp.i('S2')) r) q),
  'caja: S2 (devoluciones sin efectivo) coincide con resumen_caja');
select is(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'totales' ->> 'esperado_abiertas',
  ((public.resumen_caja(pg_temp.i('S1')) ->> 'esperado')::numeric + (public.resumen_caja(pg_temp.i('S2')) ->> 'esperado')::numeric)::text,
  'caja: esperado_abiertas = suma de las sesiones abiertas');
select is(public.reporte_caja(pg_temp.i('T'), '2026-03-09', '2026-03-12') -> 'filas', '[]'::jsonb, 'caja: rango sin sesiones');
-- Sesión cerrada: contado y diferencia salen del cierre
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.cerrar_caja(pg_temp.i('S1'), 170)$$, 'cierre de S1 (esperado 125.5, contado 170)');
select pg_temp.como(pg_temp.i('c'));
select is(
  (select jsonb_build_object('c', f -> 'contado', 'd', f -> 'diferencia', 'x', f -> 'cerrada_en' <> 'null'::jsonb)
   from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'filas') f where f ->> 'sesion_id' = pg_temp.i('S1')::text),
  '{"c":170,"d":44.5,"x":true}'::jsonb, 'caja: sesión cerrada con contado y diferencia');
select is((public.reporte_caja(pg_temp.i('T'), pg_temp.hoy(), pg_temp.hoy()) -> 'totales') - array['monto_inicial', 'ventas_efectivo', 'ventas_qr', 'qr_pendiente', 'ingresos', 'egresos', 'devoluciones_efectivo', 'reservas_efectivo', 'cuotas_efectivo'],
  jsonb_build_object('sesiones', 2, 'esperado', 125.5, 'contado', 170, 'diferencia', 44.5, 'sesiones_abiertas', 1,
    'esperado_abiertas', (public.resumen_caja(pg_temp.i('S2')) ->> 'esperado')::numeric),
  'caja: totales de esperado/contado/diferencia solo sobre cerradas; la abierta va aparte');

-- ERP_LOTE_GRANDE: más de 5.000 filas no se truncan (negocio G con 5.001 productos)
reset role;
select pg_temp.crear_usuario('g');
insert into public.negocios (id, nombre, tipo, tope_descuento) values (pg_temp.i('G'), 'G', 'tienda', 10);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values (pg_temp.i('g'), pg_temp.i('G'), 'dueno');
insert into public.productos (negocio_id, codigo, nombre, tipo, unidad)
  select pg_temp.i('G'), 'G' || n, 'Prod ' || n, 'producto', 'unidad' from generate_series(1, 5001) n;
select pg_temp.como(pg_temp.i('g'));
select throws_ok($$select public.reporte_stock(pg_temp.i('G'))$$, 'ERP_LOTE_GRANDE', 'stock: más de 5.000 filas');
select * from finish();
rollback;
