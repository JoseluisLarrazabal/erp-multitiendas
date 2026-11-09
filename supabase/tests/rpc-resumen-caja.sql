-- resumen_caja: permisos (caja, ver_reportes, ninguno, otro negocio, anon) y desglose = esperado, sesión abierta y cerrada.
begin;
select plan(22);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8100' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de T · v vendedor de T (caja) · c contador de T (ver_reportes, sin caja) · x dueño de L · n sin rol
select pg_temp.crear_usuario(n) from (values ('d'), ('v'), ('c'), ('x'), ('n')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('L'), 'L', 'lavanderia', 0);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'),
  (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('DL'), pg_temp.i('L'), pg_temp.i('UL'), 'DL', 'L1');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 50),
  (pg_temp.i('SL'), pg_temp.i('L'), pg_temp.i('DL'), pg_temp.i('x'), 0);
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4);

create function pg_temp.pg(p_medio text, p_monto numeric, p_verif boolean default null) returns jsonb language sql as $$
  select jsonb_build_object('medio', p_medio, 'monto', p_monto) || case when p_verif is null then '{}' else jsonb_build_object('verificado', p_verif) end
$$;
create function pg_temp.v(p_id text, p_caja text, p_num text, p_n numeric, p_pagos jsonb) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i(p_caja),
    'numero', p_num, 'creada_en_cliente', now(), 'total', p_n * 10,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'lista', 'contado', 'cantidad', p_n, 'precio_unitario', 10)),
    'pagos', p_pagos)
$$;
create function pg_temp.dv(p_id text, p_venta text, p_caja text, p_medio text, p_cant numeric) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'venta_id', pg_temp.i(p_venta), 'dispositivo_id', pg_temp.i('D1'),
    'caja_sesion_id', pg_temp.i(p_caja), 'medio', p_medio, 'motivo', 'm', 'items', jsonb_build_array(jsonb_build_object(
      'venta_item_id', (select id from public.venta_items where venta_id = pg_temp.i(p_venta) order by linea limit 1), 'cantidad', p_cant)))
$$;

select ok(has_function_privilege('authenticated', 'public.resumen_caja(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.resumen_caja(uuid)', 'EXECUTE'), 'resumen_caja: authenticated sí, anon no');

-- Sesión S1 (inicial 100): VA 5 u = 30 efectivo + 20 qr · VB 3 u en efectivo · VC 2 u en qr · VD anulada.
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.v('VA', 'S1', 'C1-000001', 5, jsonb_build_array(pg_temp.pg('efectivo', 30), pg_temp.pg('qr', 20, true))))$$, 'VA mixta');
select lives_ok($$select public.registrar_venta(pg_temp.v('VB', 'S1', 'C1-000002', 3, jsonb_build_array(pg_temp.pg('efectivo', 30))))$$, 'VB efectivo');
select lives_ok($$select public.registrar_venta(pg_temp.v('VC', 'S1', 'C1-000003', 2, jsonb_build_array(pg_temp.pg('qr', 20, true))))$$, 'VC qr');
select lives_ok($$select public.registrar_venta(pg_temp.v('VD', 'S1', 'C1-000004', 1, jsonb_build_array(pg_temp.pg('efectivo', 10))))$$, 'VD');
select lives_ok($$select public.anular_venta(pg_temp.i('VD'), 'Error')$$, 'VD anulada');
select lives_ok($$select public.devolver_venta(pg_temp.dv('DA', 'VA', 'S1', 'efectivo', 1))$$, 'devolución 1 de VA en efectivo');
select lives_ok($$select public.devolver_venta(pg_temp.dv('DB', 'VC', 'S1', 'qr', 1))$$, 'devolución 1 de VC en qr');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('M1'), pg_temp.i('S1'), 'ingreso', 25, 't')$$, 'ingreso');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('M2'), pg_temp.i('S1'), 'gasto', 7.5, 't')$$, 'gasto');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('M3'), pg_temp.i('S1'), 'retiro', 12, 't')$$, 'retiro');

-- Abierta. Efectivo: 100 + 60 + 25 - 7.5 - 12 - 10 (DA) = 155.5 · QR: 40 - 10 (DB) = 30
select is(public.resumen_caja(pg_temp.i('S1')) - 'esperado',
  jsonb_build_object('monto_inicial', 100, 'ventas_efectivo', 60, 'ingresos', 25, 'gastos', 7.5, 'retiros', 12,
    'devoluciones_efectivo', 10, 'qr_neto', 30, 'qr_pendiente', 0, 'cantidad_ventas', 4, 'cantidad_movimientos', 3,
    'anticipos_efectivo', 0, 'anticipos_qr', 0, 'devoluciones_reserva_efectivo', 0, 'devoluciones_reserva_qr', 0), 'sesión abierta: desglose y conteos');
select is((public.resumen_caja(pg_temp.i('S1'))->>'esperado')::numeric, 155.5, 'esperado a mano');
select is((select r->>'monto_inicial' from (select public.resumen_caja(pg_temp.i('S1')) r) q)::numeric
  + (select (r->>'ventas_efectivo')::numeric + (r->>'ingresos')::numeric - (r->>'gastos')::numeric - (r->>'retiros')::numeric
     - (r->>'devoluciones_efectivo')::numeric from (select public.resumen_caja(pg_temp.i('S1')) r) q),
  (public.resumen_caja(pg_temp.i('S1'))->>'esperado')::numeric, 'el desglose suma exactamente al esperado');

-- Permisos (vendedor tiene caja pero no ver_reportes: M4, el esperado no sale)
select pg_temp.como(pg_temp.i('v'));
select is(public.resumen_caja(pg_temp.i('S2'))->>'cantidad_ventas', '0', 'vendedor (caja): sesión vacía');
select is(public.resumen_caja(pg_temp.i('S1')) -> 'esperado', 'null'::jsonb, 'M4: vendedor (caja, sin ver_reportes) no recibe el esperado');
select pg_temp.como(pg_temp.i('c'));
select is((public.resumen_caja(pg_temp.i('S1'))->>'esperado')::numeric, 155.5, 'contador (ver_reportes, sin caja) lee');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.resumen_caja(pg_temp.i('S1'))$$, 'ERP_SIN_PERMISO', 'dueño de otro negocio: sin permiso');
select pg_temp.como(pg_temp.i('n'));
select throws_ok($$select public.resumen_caja(pg_temp.i('S1'))$$, 'ERP_SIN_PERMISO', 'usuario sin rol: sin permiso');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.resumen_caja(gen_random_uuid())$$, 'ERP_SIN_PERMISO', 'sesión inexistente: sin permiso');

-- Cerrada: el desglose sigue igual y coincide con lo guardado al cerrar
select public.cerrar_caja(pg_temp.i('S1'), 150);
select is(public.resumen_caja(pg_temp.i('S1'))->>'esperado', (select monto_esperado::text from public.caja_sesiones where id = pg_temp.i('S1')), 'cerrada: esperado = monto_esperado guardado');

select set_config('role', 'anon', true);
select throws_ok($$select public.resumen_caja(pg_temp.i('S1'))$$, '42501', null, 'anon no puede ejecutar');
select * from finish();
rollback;
