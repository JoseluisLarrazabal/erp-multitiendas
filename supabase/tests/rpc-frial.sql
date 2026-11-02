-- Fase 5, PR 1: peso fijo del paquete, DB-11 en el frial, lotes (registrar_entrada_lote, lotes_por_vencer con saldo
-- FIFO estimado) y merma.
begin;
select plan(77);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9500' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- Usuarios: d dueño de F (frial) · v vendedor de F · x dueño de O (otro negocio)
select pg_temp.crear_usuario(n) from (values ('d'), ('v'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo) values
  (pg_temp.i('F'), 'F', 'frial'), (pg_temp.i('O'), 'O', 'tienda');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('F'), 'dueno'), (pg_temp.i('v'), pg_temp.i('F'), 'vendedor'),
  (pg_temp.i('x'), pg_temp.i('O'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('UF'), pg_temp.i('F'), 'UF', 'local'), (pg_temp.i('UF2'), pg_temp.i('F'), 'UF2', 'local'), (pg_temp.i('UO'), pg_temp.i('O'), 'UO', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('DF'), pg_temp.i('F'), pg_temp.i('UF'), 'DF', 'F1');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('SF'), pg_temp.i('F'), pg_temp.i('DF'), pg_temp.i('d'), 0);
-- Productos de F: PN (saldo FIFO con entrada sin lote) · PK kg · PP paquete de 1 kg · PS con serie · PA, PM, PV y PL (lotes, merma, vencido, lejano) · de O: PO
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie, peso_paquete_kg) values
  (pg_temp.i('PK'), pg_temp.i('F'), 'PK', 'PK', 'producto', 'kg', false, null),
  (pg_temp.i('PP'), pg_temp.i('F'), 'PP', 'PP', 'producto', 'unidad', false, 1.000),
  (pg_temp.i('PS'), pg_temp.i('F'), 'PS', 'PS', 'producto', 'unidad', true, null),
  (pg_temp.i('PA'), pg_temp.i('F'), 'PA', 'PA', 'producto', 'unidad', false, null),
  (pg_temp.i('PM'), pg_temp.i('F'), 'PM', 'PM', 'producto', 'kg', false, null),
  (pg_temp.i('PV'), pg_temp.i('F'), 'PV', 'PV', 'producto', 'unidad', false, null),
  (pg_temp.i('PL'), pg_temp.i('F'), 'PL', 'PL', 'producto', 'unidad', false, null),
  (pg_temp.i('PN'), pg_temp.i('F'), 'PN', 'PN', 'producto', 'unidad', false, null),
  (pg_temp.i('PO'), pg_temp.i('O'), 'PO', 'PO', 'producto', 'unidad', false, null);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('F'), pg_temp.i('PK'), 'contado', 59.99, 'BOB'), (pg_temp.i('F'), pg_temp.i('PA'), 'contado', 10, 'BOB'),
  (pg_temp.i('F'), pg_temp.i('PN'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('F'), pg_temp.i('UF'), pg_temp.i('PK'), 'inicial', 20, 30),
  (pg_temp.i('F'), pg_temp.i('UF'), pg_temp.i('PM'), 'inicial', 10, 5);

create function pg_temp.v(p_id text, p_num text, p_prod text, p_cant numeric, p_precio numeric, p_total numeric) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('DF'), 'caja_sesion_id', pg_temp.i('SF'),
    'numero', p_num, 'creada_en_cliente', now(), 'total', p_total,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(p_prod), 'lista', 'contado', 'cantidad', p_cant, 'precio_unitario', p_precio)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', p_total)))
$$;
-- Lote de la RPC: l(op, producto, cantidad, código, días hasta vencer)
create function pg_temp.l(p_op text, p_prod text, p_cant numeric, p_codigo text, p_dias integer) returns uuid language sql as $$
  select public.registrar_entrada_lote(pg_temp.i(p_op), pg_temp.i('F'), pg_temp.i(p_prod), pg_temp.i('UF'), p_cant, 20, null,
    p_codigo, (now() at time zone 'America/La_Paz')::date + p_dias)
$$;
-- "codigo=saldo" de los lotes por vencer de un producto, por vencimiento
create function pg_temp.lv(p_prod text, p_dias integer default 7) returns text language sql as $$
  select coalesce(string_agg(e ->> 'codigo' || '=' || trim_scale((e ->> 'saldo')::numeric)::text, ',' order by e ->> 'vence', e ->> 'codigo'), '')
  from jsonb_array_elements(public.lotes_por_vencer(pg_temp.i('F'), p_dias)) e
  where e ->> 'producto_id' = pg_temp.i(p_prod)::text
$$;

-- Estructura
select ok((select relrowsecurity from pg_class where oid = 'public.lotes'::regclass), 'lotes: RLS activa');
select ok(has_function_privilege('authenticated', 'public.registrar_entrada_lote(uuid, uuid, uuid, uuid, numeric, numeric, text, text, date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.registrar_entrada_lote(uuid, uuid, uuid, uuid, numeric, numeric, text, text, date)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.lotes_por_vencer(uuid, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.lotes_por_vencer(uuid, integer)', 'EXECUTE'), 'RPC de lotes: authenticated sí, anon no');

-- Peso del paquete
select throws_ok($$insert into public.productos (negocio_id, codigo, nombre, tipo, unidad, peso_paquete_kg)
  values (pg_temp.i('F'), 'X1', 'X1', 'producto', 'kg', 1)$$, '23514', null, 'peso_paquete_kg con unidad kg: rechazado');
select throws_ok($$insert into public.productos (negocio_id, codigo, nombre, tipo, unidad, peso_paquete_kg)
  values (pg_temp.i('F'), 'X2', 'X2', 'producto', 'unidad', 0)$$, '23514', null, 'peso_paquete_kg cero: rechazado');
select is((select peso_paquete_kg::text from public.productos where id = pg_temp.i('PP')), '1.000', 'peso fijo guardado con 3 decimales');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.guardar_producto(pg_temp.i('F'), '{"codigo": "X3", "nombre": "X3", "tipo": "producto", "unidad": "kg", "peso_paquete_kg": 1}')$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'guardar_producto: peso con kg rechazado');
select lives_ok($$select public.guardar_producto(pg_temp.i('F'), '{"codigo": "X4", "nombre": "X4", "tipo": "producto", "unidad": "unidad", "peso_paquete_kg": 0.5}')$$, 'guardar_producto: paquete de 0.5 kg');
select is((select peso_paquete_kg::text from public.productos_lista where codigo = 'X4'), '0.500', 'productos_lista expone el peso');
select lives_ok(format($$select public.guardar_producto(pg_temp.i('F'), '{"id": "%s", "codigo": "PP", "nombre": "PP", "tipo": "producto", "unidad": "unidad"}')$$, pg_temp.i('PP')),
  'guardar_producto: editar sin la clave del peso');
select is((select peso_paquete_kg::text from public.productos where id = pg_temp.i('PP')), '1.000', 'guardar_producto: editar sin la clave conserva el peso');

-- DB-11: 1.255 kg a 59.99 = 75.287 -> 75.29
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v('V1', 'F1-000001', 'PK', 1.255, 59.99, 75.29))$$, 'DB-11: venta de 1.255 kg a 59.99');
reset role;
select throws_ok($$insert into public.productos (negocio_id, codigo, nombre, tipo, unidad, peso_paquete_kg)
  values (pg_temp.i('F'), 'X5', 'X5', 'servicio', 'unidad', 1)$$, '23514', null, 'peso_paquete_kg en un servicio: rechazado');
select is((select cantidad::text from public.venta_items where venta_id = pg_temp.i('V1')), '1.255', 'DB-11: cantidad con 3 decimales');
select is((select total::text from public.ventas where id = pg_temp.i('V1')), '75.29', 'DB-11: total con 2 decimales');
select is((select cantidad::text from public.stock where producto_id = pg_temp.i('PK')), '18.745', 'DB-11: el stock baja 1.255 kg');

-- registrar_entrada_lote
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.l('E0', 'PP', 5, 'L-001', 10)$$, 'P0001', 'ERP_SIN_PERMISO', 'lote: vendedor sin permiso');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.l('E0', 'PP', 5, 'L-001', 10)$$, 'P0001', 'ERP_SIN_PERMISO', 'lote: otro negocio sin permiso');
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select pg_temp.l('E1', 'PP', 5, 'L-001', 10)$$, 'lote: dueño registra la entrada con lote');
select is((select count(*)::int from public.lotes where producto_id = pg_temp.i('PP')), 1, 'lote: se crea uno');
select is((select codigo || ':' || cantidad::text from public.lotes where producto_id = pg_temp.i('PP')), 'L-001:5.000', 'lote: código y cantidad');
select is((select l.movimiento_id from public.lotes l where l.producto_id = pg_temp.i('PP')),
  (select m.id from public.movimientos_inventario m where m.ref_id = pg_temp.i('E1') and m.tipo = 'entrada'), 'lote: ligado al movimiento de entrada');
select is(pg_temp.l('E1', 'PP', 5, 'L-001', 10), (select id from public.lotes where producto_id = pg_temp.i('PP')), 'lote: reintento devuelve el mismo lote');
select is((select count(*)::int from public.lotes where producto_id = pg_temp.i('PP')), 1, 'lote: el reintento no duplica el lote');
select is((select count(*)::int from public.movimientos_inventario where ref_id = pg_temp.i('E1')), 1, 'lote: el reintento no duplica la entrada');
select throws_ok($$select pg_temp.l('E1', 'PP', 5, 'L-002', 10)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'lote: misma operación con otro código');
select throws_ok($$select pg_temp.l('E1', 'PP', 5, 'L-001', 11)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'lote: misma operación con otro vencimiento');
select lives_ok($$select public.registrar_entrada(pg_temp.i('E8'), pg_temp.i('F'), pg_temp.i('PP'), pg_temp.i('UF'), 1, 20, null)$$, 'lote: entrada sin lote previa');
select throws_ok($$select pg_temp.l('E8', 'PP', 1, 'L-008', 10)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'lote: la operación ya era una entrada sin lote');
select throws_ok($$select pg_temp.l('E2', 'PS', 1, 'L-002', 10)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lote: producto con series rechazado');
select throws_ok($$select pg_temp.l('E3', 'PP', 1, 'L-003', -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lote: vence ayer (La Paz) rechazado');
select is((select count(*)::int from public.movimientos_inventario where ref_id in (pg_temp.i('E2'), pg_temp.i('E3'))), 0, 'lote: un rechazo no deja la entrada');
select lives_ok($$select pg_temp.l('E4', 'PP', 1, 'L-004', 0)$$, 'lote: vence hoy es válido');
select throws_ok($$select pg_temp.l('E5', 'PP', 1, '   ', 10)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lote: código vacío');
select throws_ok($$select pg_temp.l('E5', 'PP', 1, repeat('a', 41), 10)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lote: código de 41 caracteres');
select lives_ok($$select pg_temp.l('E6', 'PP', 1, repeat('a', 40), 10)$$, 'lote: código de 40 caracteres');
select throws_ok($$select public.registrar_entrada_lote(pg_temp.i('E7'), pg_temp.i('F'), pg_temp.i('PP'), pg_temp.i('UF'), 1, null, null, 'L-007', null)$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'lote: sin vencimiento');
select throws_ok($$select public.registrar_entrada_lote(pg_temp.i('E7'), pg_temp.i('F'), pg_temp.i('PO'), pg_temp.i('UF'), 1, null, null, 'L-007', current_date + 5)$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'lote: producto de otro negocio');

-- Lotes: solo lectura
select throws_ok($$insert into public.lotes (negocio_id, producto_id, ubicacion_id, codigo, vence, cantidad, movimiento_id)
  select negocio_id, producto_id, ubicacion_id, 'Z', current_date, 1, movimiento_id from public.lotes limit 1$$, '42501', null, 'lotes: insert directo denegado');
select is((select count(*)::int from public.lotes), 3, 'lotes: el dueño ve los del negocio');
select pg_temp.como(pg_temp.i('x'));
select is((select count(*)::int from public.lotes), 0, 'lotes: otro negocio no los ve (RLS)');
reset role;
select throws_ok($$update public.lotes set codigo = 'Z'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'lotes: UPDATE rechazado');
select throws_ok($$delete from public.lotes$$, 'P0001', 'ERP_SOLO_AGREGAR', 'lotes: DELETE rechazado');
select throws_ok($$truncate public.lotes$$, 'P0001', 'ERP_SOLO_AGREGAR', 'lotes: TRUNCATE rechazado');

-- Saldo FIFO: PA, lote A (10, +2 días) antes que B (5, +3 días); el stock se reparte primero en el más nuevo (B).
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select pg_temp.l('A1', 'PA', 10, 'A', 2)$$, 'fifo: lote A');
select lives_ok($$select pg_temp.l('A2', 'PA', 5, 'B', 3)$$, 'fifo: lote B');
select is(pg_temp.lv('PA'), 'A=10,B=5', 'fifo: sin salidas, cada lote con su cantidad');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('A3'), pg_temp.i('F'), pg_temp.i('PA'), pg_temp.i('UF'), 'merma', -7, 'corte', null)$$, 'fifo: merma de 7');
select is(pg_temp.lv('PA'), 'A=3,B=5', 'fifo: la merma baja el lote más viejo');
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v('V2', 'F1-000002', 'PA', 2, 10, 20))$$, 'fifo: venta de 2');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.lv('PA'), 'A=1,B=5', 'fifo: la venta también baja el más viejo');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('A4'), pg_temp.i('F'), pg_temp.i('PA'), pg_temp.i('UF'), 'merma', -3, 'corte', null)$$, 'fifo: merma de 3');
select is(pg_temp.lv('PA'), 'B=3', 'fifo: lote sin saldo no aparece');

-- Entrada sin lote más nueva: PN lote N-A 5, entrada sin lote 10, venta 5 -> stock 10 y el lote ya se consumió (FIFO).
select lives_ok($$select pg_temp.l('N1', 'PN', 5, 'N-A', 2)$$, 'sin lote: lote N-A');
select lives_ok($$select public.registrar_entrada(pg_temp.i('N2'), pg_temp.i('F'), pg_temp.i('PN'), pg_temp.i('UF'), 10, 20, null)$$, 'sin lote: entrada sin lote posterior');
select is(pg_temp.lv('PN'), 'N-A=5', 'sin lote: con stock 15, N-A conserva su saldo');
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.v('V3', 'F1-000003', 'PN', 5, 10, 50))$$, 'sin lote: venta de 5');
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.lv('PN'), '', 'sin lote: la entrada sin lote más nueva empuja a N-A a 0');

-- Vencido con saldo (la RPC no deja crearlo: se inserta como lo haría un lote que ya venció) y filtro por días.
reset role;
with e as (
  insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario)
  values (pg_temp.i('F'), pg_temp.i('UF'), pg_temp.i('PV'), 'entrada', 4, 10) returning id
)
insert into public.lotes (negocio_id, producto_id, ubicacion_id, codigo, vence, cantidad, movimiento_id)
select pg_temp.i('F'), pg_temp.i('PV'), pg_temp.i('UF'), 'VENCIDO', (now() at time zone 'America/La_Paz')::date - 1, 4, e.id from e;
select pg_temp.como(pg_temp.i('d'));
select is(pg_temp.lv('PV'), 'VENCIDO=4', 'vencido con saldo aparece');
select is((select (e ->> 'dias_restantes')::int from jsonb_array_elements(public.lotes_por_vencer(pg_temp.i('F'))) e where e ->> 'codigo' = 'VENCIDO'), -1, 'vencido: días restantes negativos');
select lives_ok($$select pg_temp.l('L1', 'PL', 6, 'LEJANO', 30)$$, 'lote lejano');
select lives_ok($$select public.trasladar_stock(pg_temp.i('T1'), pg_temp.i('F'), pg_temp.i('PL'), pg_temp.i('UF'), pg_temp.i('UF2'), 4, 'mover', null)$$, 'traslado de 4 del lote lejano');
select is(pg_temp.lv('PL', 30), 'LEJANO=6', 'traslado: el saldo del lote no cambia');
select is(pg_temp.lv('PL', 7), '', 'p_dias 7: el lejano no aparece');
select is(pg_temp.lv('PL', 30), 'LEJANO=6', 'p_dias 30: el lejano aparece (límite incluido)');
select is(pg_temp.lv('PA', 2), '', 'p_dias 2: B (+3) fuera');
select is(pg_temp.lv('PA', 3), 'B=3', 'p_dias 3: B (+3) dentro');
select throws_ok($$select public.lotes_por_vencer(pg_temp.i('F'), -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'lotes_por_vencer: p_dias negativo');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.lotes_por_vencer(pg_temp.i('F'))$$, 'P0001', 'ERP_SIN_PERMISO', 'lotes_por_vencer: vendedor sin permiso');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.lotes_por_vencer(pg_temp.i('F'))$$, 'P0001', 'ERP_SIN_PERMISO', 'lotes_por_vencer: otro negocio sin permiso');

-- Merma (PM: 10 kg a costo 5)
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.ajustar_inventario(pg_temp.i('M1'), pg_temp.i('F'), pg_temp.i('PM'), pg_temp.i('UF'), 'merma', -2.5, 'recorte', null)$$, 'merma: negativa');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('M2'), pg_temp.i('F'), pg_temp.i('PM'), pg_temp.i('UF'), 'merma', 1, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'merma: positiva rechazada');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('M3'), pg_temp.i('F'), pg_temp.i('PM'), pg_temp.i('UF'), 'merma', -1, '  ', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'merma: sin motivo rechazada');
select is((select cantidad::text from public.stock where producto_id = pg_temp.i('PM')), '7.500', 'merma: baja el stock');
select is((select cantidad::text || ':' || motivo from public.kardex_producto(pg_temp.i('PM')) where tipo = 'merma'), '-2.500:recorte', 'merma: aparece en el kardex');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.ajustar_inventario(pg_temp.i('M5'), pg_temp.i('O'), pg_temp.i('PO'), pg_temp.i('UO'), 'merma', -1, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'merma: en una tienda rechazada');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.ajustar_inventario(pg_temp.i('M4'), pg_temp.i('F'), pg_temp.i('PM'), pg_temp.i('UF'), 'merma', -1, 'x', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'merma: vendedor sin permiso');
reset role;
select is((select costo_unitario::text from public.movimientos_inventario where tipo = 'merma' and producto_id = pg_temp.i('PM')), '5.0000', 'merma: queda con el costo promedio vigente');

select * from finish();
rollback;
