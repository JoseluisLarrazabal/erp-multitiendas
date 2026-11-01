-- catalogo_pos: permisos, contenido sin costos, precios en Bs, stock y version.
begin;
select plan(22);
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
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.catalogo_pos(pg_temp.i('U1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'contador (sin vender)');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.catalogo_pos(pg_temp.i('U1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio');
select throws_ok($$select public.catalogo_pos(pg_temp.i('nadie'))$$, 'P0001', 'ERP_SIN_PERMISO', 'ubicación inexistente');
select pg_temp.como(pg_temp.i('v'));
create temp table cat1 as select public.catalogo_pos(pg_temp.i('U1')) c;
grant select on cat1 to authenticated;
select is(jsonb_array_length((select c -> 'productos' from cat1)), 7, 'productos activos del negocio (sin los de L)');
select is((select c ->> 'tipo_cambio' from cat1), '7.0000', 'tipo de cambio vigente');
select ok((select c::text !~* 'costo' from cat1), 'sin costos en ninguna clave ni valor');
select is((select p -> 'precios' ->> 'contado' from cat1, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'P1'), '10.00', 'precio en Bs de contado');
select is((select p -> 'precios' ->> 'minimo' from cat1, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'P1'), '8.00', 'precio mínimo');
select is((select p -> 'precios' ->> 'contado' from cat1, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'PU'), '35.00', 'USD convertido a Bs');
select is((select jsonb_typeof(p -> 'precios' -> 'contado') from cat1, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'PN'), 'null', 'sin precio: null, no 0');
select is((select (p -> 'stock_por_ubicacion' ->> pg_temp.i('U1')::text) || '/' || (p ->> 'stock_total') from cat1, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'P1'), '100.000/100.000', 'stock por ubicación y total');
select is((select c -> 'ubicaciones' from cat1), jsonb_build_array(jsonb_build_object('id', pg_temp.i('U1'), 'nombre', 'U1')), 'ubicaciones del negocio (sin las de L)');
select is((select (p ->> 'controla_serie') || '/' || (p ->> 'unidad') from cat1, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'PS'), 'true/unidad', 'serie y unidad');
select is((select c ->> 'version' from cat1), public.catalogo_pos(pg_temp.i('U1')) ->> 'version', 'misma version sin cambios');

-- La version cambia con una venta, un precio y un tipo de cambio
select public.registrar_venta(pg_temp.v1('V1', 'D1', 'S1', 'C1-000001', 1));
select isnt((select c ->> 'version' from cat1), public.catalogo_pos(pg_temp.i('U1')) ->> 'version', 'cambia tras una venta (stock)');
create temp table cat1b as select public.catalogo_pos(pg_temp.i('U1')) c;
grant select on cat1b to authenticated;
reset role;
update public.producto_precios set monto = 11, updated_at = clock_timestamp() where producto_id = pg_temp.i('P1') and lista = 'contado';
select pg_temp.como(pg_temp.i('v'));
create temp table cat2 as select public.catalogo_pos(pg_temp.i('U1')) c;
grant select on cat2 to authenticated;
reset role;
insert into public.tipos_cambio (negocio_id, valor) values (pg_temp.i('T'), 9);
select pg_temp.como(pg_temp.i('v'));
select isnt((select c ->> 'version' from cat1b), (select c ->> 'version' from cat2), 'cambia tras un cambio de precio');
select isnt((select c ->> 'version' from cat2), public.catalogo_pos(pg_temp.i('U1')) ->> 'version', 'cambia con un tipo de cambio nuevo');
select is((select p -> 'precios' ->> 'contado' from cat2, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'P1'), '11.00', 'refleja el precio nuevo');

-- Stock en otra ubicación del negocio y producto inactivo
reset role;
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values (pg_temp.i('U2'), pg_temp.i('T'), 'U2', 'deposito');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U2'), pg_temp.i('P1'), 'inicial', 5, 4);
update public.productos set activo = false where id = pg_temp.i('P2');
select pg_temp.como(pg_temp.i('v'));
create temp table cat3 as select public.catalogo_pos(pg_temp.i('U1')) c;
grant select on cat3 to authenticated;
select is((select (p -> 'stock_por_ubicacion' ->> pg_temp.i('U1')::text) || '/' || (p -> 'stock_por_ubicacion' ->> pg_temp.i('U2')::text) || '/' || (p ->> 'stock_total')
  from cat3, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'P1'), '99.000/5.000/104.000', 'stock por cada ubicación del negocio');
select is(jsonb_array_length((select c -> 'ubicaciones' from cat3)), 2, 'ubicaciones: las dos de T');
select is(jsonb_array_length((select c -> 'productos' from cat3)), 6, 'sin productos inactivos');
select is((select count(*) from cat3, jsonb_array_elements(c -> 'productos') p where p ->> 'codigo' = 'P2')::integer, 0, 'el inactivo no está');

select * from finish();
rollback;
