-- B-2: el conteo espera stock + reservado activo (la mercadería reservada sigue en el local), y la vista stock_reservado.
begin;
select plan(12);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9130' || n)::uuid $$;
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.i(n), n || '@test.local', jsonb_build_object('nombre', n) from (values ('d'), ('y')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('T2'), 'T2', 'tienda', 10);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('y'), pg_temp.i('T2'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1');
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 0);
insert into public.clientes (id, negocio_id, nombre) values (pg_temp.i('CL'), pg_temp.i('T'), 'Cliente');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('PA'), pg_temp.i('T'), 'PA', 'PA', 'producto', 'unidad', false),
  (pg_temp.i('PB'), pg_temp.i('T'), 'PB', 'PB', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('PA'), 'contado', 10, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PA'), 'inicial', 10, 4),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PB'), 'inicial', 5, 4);

create function pg_temp.res(o text, cant numeric) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(o), 'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S1'),
    'cliente_id', pg_temp.i('CL'), 'producto_id', pg_temp.i('PA'), 'cantidad', cant, 'precio_acordado', 12,
    'anticipo', 5, 'medio', 'efectivo')
$$;
create function pg_temp.conteo(op text, p text, c numeric) returns integer language sql as $$
  select public.registrar_conteo(pg_temp.i(op), pg_temp.i('T'), pg_temp.i('U1'),
    jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(p), 'cantidad_contada', c)), null)
$$;
create function pg_temp.stock(p text) returns numeric language sql as $$
  select cantidad from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i('U1')
$$;
create function pg_temp.sistema(op text, p text) returns numeric language sql security definer as $$
  select cantidad_sistema from public.conteo_items where conteo_id = pg_temp.i(op) and producto_id = pg_temp.i(p)
$$;
create function pg_temp.ajustes(op text) returns bigint language sql security definer as $$
  select count(*) from public.movimientos_inventario where ref_id = pg_temp.i(op) and tipo = 'ajuste'
$$;

select pg_temp.como(pg_temp.i('d'));
select public.crear_reserva(pg_temp.res('R1', 3));
select is(pg_temp.stock('PA'), 7::numeric, 'la reserva baja el stock a 7');
select is(pg_temp.conteo('C1', 'PA', 10), 0, 'conteo 10 con 3 reservadas: sin ajustes');
select is(pg_temp.sistema('C1', 'PA'), 10::numeric, 'cantidad_sistema = stock + reservado');
select is(pg_temp.ajustes('C1'), 0::bigint, 'ningún movimiento de ajuste');
select public.cancelar_reserva(pg_temp.i('K1'), pg_temp.i('R1'), pg_temp.i('S1'), pg_temp.i('D1'));
select is(pg_temp.stock('PA'), 10::numeric, 'cancelar la reserva deja 10, igual al local');
select public.crear_reserva(pg_temp.res('R2', 3));
select is(pg_temp.conteo('C2', 'PA', 9), 1, 'conteo 9 con 3 reservadas: un ajuste');
select is(pg_temp.stock('PA'), 6::numeric, 'ajuste -1: 7 - 1 = 6 (más 3 reservadas = 9)');
select is(pg_temp.conteo('C3', 'PB', 4), 1, 'producto sin reservas: ajuste -1 como antes');
select is(pg_temp.sistema('C3', 'PB'), 5::numeric, 'sin reservas, cantidad_sistema = stock');
select is((select cantidad from public.stock_reservado where producto_id = pg_temp.i('PA')), 3::numeric, 'la vista suma lo activo');
select pg_temp.como(pg_temp.i('y'));
select is((select count(*) from public.stock_reservado), 0::bigint, 'otro negocio no ve filas');
select ok(not has_table_privilege('anon', 'public.stock_reservado', 'SELECT'), 'anon no lee la vista');

select * from finish();
rollback;
