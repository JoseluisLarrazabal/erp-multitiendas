-- M-10: lo que llega sin conexión tras el cierre no cambia el arqueo guardado; resumen_caja lo cuenta aparte y
-- reporte_caja usa el esperado guardado en sesiones cerradas (y el vivo en las abiertas).
begin;
select plan(18);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9500' || n)::uuid $$;
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.i(n), n || '@test.local', jsonb_build_object('nombre', n) from (values ('d'), ('v')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values (pg_temp.i('T'), 'T', 'tienda', 10);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'), (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, abierta_en, monto_inicial) values
  (pg_temp.i('S'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), now() - interval '3 hours', 100),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), now() - interval '3 hours', 50);
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4);

create function pg_temp.vd(p_id text, p_num text, p_min integer, p_cant numeric) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S'),
    'numero', p_num, 'creada_en_cliente', now() - make_interval(mins => p_min), 'total', p_cant * 10,
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'lista', 'contado', 'cantidad', p_cant, 'precio_unitario', 10)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', p_cant * 10)))
$$;
create function pg_temp.off(p_vend text) returns jsonb language sql as $$
  select jsonb_build_object('vendedor_id', pg_temp.i(p_vend), 'tipo_cambio', null, 'numero_impreso', null)
$$;
create function pg_temp.sesion_reporte(p_sesion text, p_clave text) returns text language sql as $$
  select f ->> p_clave from jsonb_array_elements(public.reporte_caja(pg_temp.i('T'), current_date - 2, current_date + 1) -> 'filas') f
  where f ->> 'sesion_id' = pg_temp.i(p_sesion)::text
$$;

-- Sesión S: inicial 100 + venta de 50 en efectivo = esperado 150; se cuenta 150.
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_venta(pg_temp.vd('VA', 'C1-000001', 0, 5))$$, 'venta en línea');
select lives_ok($$select public.cerrar_caja(pg_temp.i('S'), 150)$$, 'cierre con contado 150');
select is((select monto_esperado::text || '/' || diferencia::text from public.caja_sesiones where id = pg_temp.i('S')), '150.00/0.00', 'guardado al cierre');

-- Llegan tarde (hechas dentro de la sesión): una venta de 20 y un gasto de 5.
select pg_temp.como(pg_temp.i('v'));
select lives_ok($$select public.registrar_venta(pg_temp.vd('VT', 'C1-000002', 10, 2), pg_temp.off('v'))$$, 'venta tardía aceptada');
select lives_ok($$select public.registrar_movimiento_caja(pg_temp.i('MT'), pg_temp.i('S'), 'gasto', 5, 'tarde',
  jsonb_build_object('creada_en', to_char((now() - interval '90 minutes') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'usuario_id', pg_temp.i('v')))$$,
  'movimiento tardío aceptado');
-- Sin ver_reportes (vendedor): las tres claves en null, como los otros términos.
select is((public.resumen_caja(pg_temp.i('S')) -> 'tardias_ventas') = 'null'::jsonb
  and (public.resumen_caja(pg_temp.i('S')) -> 'tardias_ventas_total') = 'null'::jsonb
  and (public.resumen_caja(pg_temp.i('S')) -> 'tardias_movimientos') = 'null'::jsonb, true, 'sin ver_reportes: tardías en null');

select pg_temp.como(pg_temp.i('d'));
select is((select monto_esperado::text || '/' || diferencia::text from public.caja_sesiones where id = pg_temp.i('S')), '150.00/0.00', 'el cierre guardado no cambia');
select is((public.resumen_caja(pg_temp.i('S')) ->> 'esperado')::numeric, 165.00, 'esperado vivo = 150 + 20 - 5');
select is((public.resumen_caja(pg_temp.i('S')) ->> 'tardias_ventas')::integer, 1, 'tardias_ventas = 1');
select is((public.resumen_caja(pg_temp.i('S')) ->> 'tardias_ventas_total')::numeric, 20.00, 'tardias_ventas_total = 20');
select is((public.resumen_caja(pg_temp.i('S')) ->> 'tardias_movimientos')::integer, 1, 'tardias_movimientos = 1');
select is((public.resumen_caja(pg_temp.i('S2')) ->> 'tardias_ventas')::integer, 0, 'sesión sin tardías: 0');

-- reporte_caja: esperado guardado en la cerrada, y contado - esperado = diferencia.
select is(pg_temp.sesion_reporte('S', 'esperado')::numeric, 150.00, 'reporte_caja: esperado guardado en la cerrada');
select is(pg_temp.sesion_reporte('S', 'contado')::numeric - pg_temp.sesion_reporte('S', 'esperado')::numeric,
  pg_temp.sesion_reporte('S', 'diferencia')::numeric, 'reporte_caja: contado - esperado = diferencia');
select is(pg_temp.sesion_reporte('S2', 'esperado')::numeric, 50.00, 'reporte_caja: la abierta conserva el esperado vivo');
select is((public.reporte_caja(pg_temp.i('T'), current_date - 2, current_date + 1) -> 'totales' ->> 'esperado')::numeric, 150.00,
  'reporte_caja: total esperado de cerradas = guardado');

-- Anular la venta tardía la saca de la línea y del esperado vivo; el movimiento sigue.
select lives_ok($$select public.anular_venta(pg_temp.i('VT'), 'revisada')$$, 'se anula la venta tardía');
select is((public.resumen_caja(pg_temp.i('S')) ->> 'tardias_ventas')::integer || '/' || (public.resumen_caja(pg_temp.i('S')) ->> 'esperado'),
  '0/145.00', 'anulada: sale de tardías y del esperado vivo');
select * from finish();
rollback;
