-- DB-04, DB-12 en reconciliación; costos_stock, kardex_producto, stock_inconsistente, productos_stock_bajo.
begin;
select plan(36);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería. U1 y U2 en T, UL en L.
-- d: dueño de T y L · v: vendedor de T · c: contador de T · x: encargado de L (ajeno a T)
select pg_temp.crear_usuario(('99999999-3000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-3000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'dueno'),
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000002', 'dueno'),
  ('99999999-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'vendedor'),
  ('99999999-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'contador'),
  ('99999999-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000002', 'encargado');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'U1', 'local'),
  ('bbbbbbbb-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'U2', 'deposito'),
  ('bbbbbbbb-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000002', 'UL', 'local');
-- P1 unidad · PK kg · PS unidad con serie · PL servicio (L) · PI insumo (L)
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie, stock_minimo) values
  ('eeeeeeee-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'P1', 'P1', 'producto', 'unidad', false, 20),
  ('eeeeeeee-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'PK', 'PK', 'producto', 'kg', false, null),
  ('eeeeeeee-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'PS', 'PS', 'producto', 'unidad', true, null),
  ('eeeeeeee-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000002', 'PL', 'PL', 'servicio', 'unidad', false, null),
  ('eeeeeeee-3000-0000-0000-000000000005', 'aaaaaaaa-3000-0000-0000-000000000002', 'PI', 'PI', 'insumo', 'unidad', false, null);
-- Atajo de ids: T, L (negocios) · U1, U2, UL (ubicaciones) · P1, PK, PS, PL, PI (productos) · d, v, c, x (usuarios) · O<n> operaciones · S<n> series
create function pg_temp.i(n text) returns uuid language sql as $$
  select (case
    when n = 'T' then 'aaaaaaaa-3000-0000-0000-000000000001'
    when n = 'L' then 'aaaaaaaa-3000-0000-0000-000000000002'
    when n = 'U1' then 'bbbbbbbb-3000-0000-0000-000000000001'
    when n = 'U2' then 'bbbbbbbb-3000-0000-0000-000000000002'
    when n = 'UL' then 'bbbbbbbb-3000-0000-0000-000000000003'
    when n = 'P1' then 'eeeeeeee-3000-0000-0000-000000000001'
    when n = 'PK' then 'eeeeeeee-3000-0000-0000-000000000002'
    when n = 'PS' then 'eeeeeeee-3000-0000-0000-000000000003'
    when n = 'PL' then 'eeeeeeee-3000-0000-0000-000000000004'
    when n = 'PI' then 'eeeeeeee-3000-0000-0000-000000000005'
    when n = 'd' then '99999999-3000-0000-0000-000000000001'
    when n = 'v' then '99999999-3000-0000-0000-000000000002'
    when n = 'c' then '99999999-3000-0000-0000-000000000003'
    when n = 'x' then '99999999-3000-0000-0000-000000000004'
    when n like 'O%' then 'cccccccc-3000-0000-0000-' || lpad(substr(n, 2), 12, '0')
    when n like 'S%' then 'dddddddd-3000-0000-0000-' || lpad(substr(n, 2), 12, '0')
  end)::uuid
$$;

-- Secuencia mixta
select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 5, 'compra');
select public.registrar_entrada(pg_temp.i('O2'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U2'), 4, 8, null);
select public.ajustar_inventario(pg_temp.i('O3'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -2, 'merma', null);
select public.trasladar_stock(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('U2'), 3, null, null);
select public.registrar_entrada(pg_temp.i('O5'), pg_temp.i('T'), pg_temp.i('PK'), pg_temp.i('U1'), 12.5, 2, null);
select public.registrar_conteo(pg_temp.i('O6'), pg_temp.i('T'), pg_temp.i('U1'), jsonb_build_array(
  jsonb_build_object('producto_id', pg_temp.i('P1'), 'cantidad_contada', 2), jsonb_build_object('producto_id', pg_temp.i('PK'), 'cantidad_contada', 10)), null);
select public.ajustar_inventario(pg_temp.i('O7'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U2'), 'danado', -1, 'roto', null);
select public.fijar_costos(pg_temp.i('T'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'costo', 9)), null);
reset role;
-- Ventas y anulaciones llegan en la fase 2: aquí se simulan directo, con una venta que deja negativo.
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'venta', -1, 9, 'venta'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'anulacion_venta', 1, 9, 'venta'),
  (pg_temp.i('T'), pg_temp.i('U2'), pg_temp.i('P1'), 'venta', -50, 9, 'venta');

select is((select count(*) from (
    select producto_id, ubicacion_id, cantidad from public.stock
    except select producto_id, ubicacion_id, sum(cantidad) from public.movimientos_inventario group by 1, 2
  ) s), 0::bigint, 'DB-04: stock = suma del kardex tras la secuencia mixta');
select is((select count(*) from public.stock), (select count(distinct (producto_id, ubicacion_id)) from public.movimientos_inventario), 'DB-04: una fila de stock por cada par con movimientos');
select pg_temp.como(pg_temp.i('d'));
select is((select count(*) from public.stock_inconsistente(pg_temp.i('T'))), 0::bigint, 'DB-04: stock_inconsistente vacío');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U2')), -44.000::numeric, 'DB-12: el negativo existe');
select results_eq($$select producto_id, cantidad from public.productos_stock_bajo(pg_temp.i('T'))$$, format($$values (%L::uuid, -42.000::numeric)$$, pg_temp.i('P1')), 'DB-12: el producto en negativo aparece como stock bajo');

-- stock_inconsistente detecta la deriva en ambos sentidos
reset role;
update public.stock set cantidad = cantidad + 1 where producto_id = pg_temp.i('PK');
delete from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1');
select pg_temp.como(pg_temp.i('d'));
select results_eq($$select producto_id, ubicacion_id, cantidad_stock, cantidad_kardex from public.stock_inconsistente(pg_temp.i('T')) order by cantidad_stock$$,
  format($$values (%L::uuid, %L::uuid, 0.000::numeric, 2.000::numeric), (%L::uuid, %L::uuid, 11.000::numeric, 10.000::numeric)$$, pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('PK'), pg_temp.i('U1')),
  'stock_inconsistente: stock de más y fila de stock faltante');
select pg_temp.como(pg_temp.i('c'));
select is((select count(*) from public.stock_inconsistente(pg_temp.i('T'))), 2::bigint, 'stock_inconsistente: el contador (ver_reportes) puede');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select * from public.stock_inconsistente(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'stock_inconsistente: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select * from public.stock_inconsistente(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'stock_inconsistente: usuario de otro negocio');
reset role;
update public.stock set cantidad = cantidad - 1 where producto_id = pg_temp.i('PK');
insert into public.stock (negocio_id, producto_id, ubicacion_id, cantidad, costo_promedio) values (pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 2, 9);

-- costos_stock
select pg_temp.como(pg_temp.i('d'));
select results_eq($$select producto_id, ubicacion_id, costo_promedio from public.costos_stock(pg_temp.i('T'), array[pg_temp.i('P1'), pg_temp.i('PK')]) order by producto_id, ubicacion_id$$,
  format($$values (%L::uuid, %L::uuid, 9.0000::numeric), (%L::uuid, %L::uuid, 9.0000::numeric), (%L::uuid, %L::uuid, 2.0000::numeric)$$,
    pg_temp.i('P1'), pg_temp.i('U1'), pg_temp.i('P1'), pg_temp.i('U2'), pg_temp.i('PK'), pg_temp.i('U1')), 'costos_stock: promedio por producto y ubicación');
select pg_temp.como(pg_temp.i('c'));
select is((select count(*) from public.costos_stock(pg_temp.i('T'), array[pg_temp.i('P1'), pg_temp.i('PK')])), 3::bigint, 'costos_stock: el contador (ver_costos) puede');
select is((select count(*) from public.costos_stock(pg_temp.i('T'), array[pg_temp.i('PK')])), 1::bigint, 'costos_stock: solo devuelve los productos pedidos');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select * from public.costos_stock(pg_temp.i('T'), array[pg_temp.i('P1'), pg_temp.i('PK')])$$, 'P0001', 'ERP_SIN_PERMISO', 'costos_stock: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select * from public.costos_stock(pg_temp.i('T'), array[pg_temp.i('P1'), pg_temp.i('PK')])$$, 'P0001', 'ERP_SIN_PERMISO', 'costos_stock: usuario de otro negocio');

-- kardex_producto
reset role;
select set_config('t.ncosto', (select count(*)::text from public.movimientos_inventario where producto_id = pg_temp.i('P1') and costo_unitario is not null), true);
select pg_temp.como(pg_temp.i('d'));
select cmp_ok((select count(*) from public.kardex_producto(pg_temp.i('P1'))), '>=', 9::bigint, 'kardex: devuelve los movimientos del producto');
select is((select count(*) from public.kardex_producto(pg_temp.i('P1')) where costo_unitario is not null), current_setting('t.ncosto')::bigint, 'kardex: con ver_costos trae el costo');
select is((select usuario_nombre from public.kardex_producto(pg_temp.i('P1')) where tipo = 'danado'), 'd', 'kardex: nombre del usuario');
select is((select count(*) from public.kardex_producto(pg_temp.i('P1'), pg_temp.i('U2'))), (select count(*) from public.movimientos_inventario where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U2')), 'kardex: filtra por ubicación');
select is((select tipo from public.kardex_producto(pg_temp.i('P1'), null, 1)), 'venta', 'kardex: lo más reciente primero');
-- referencia (M-13): conteo con su fecha, entrada sin documento, ajuste de costos; una venta simulada sin ref_id no rompe
select is((select referencia from public.kardex_producto(pg_temp.i('P1')) where ref_tipo = 'conteo'),
  'Conteo del ' || (select to_char(fecha at time zone 'America/La_Paz', 'DD/MM/YYYY') from public.conteos where id = pg_temp.i('O6')), 'kardex: referencia del conteo');
select ok((select count(*) > 0 and bool_and(referencia is null) from public.kardex_producto(pg_temp.i('P1')) where ref_tipo = 'operacion'), 'kardex: las operaciones (entrada, ajuste, traslado) no tienen referencia');
select is((select string_agg(distinct referencia, ',') from public.kardex_producto(pg_temp.i('P1')) where tipo = 'ajuste_costo'), 'Ajuste de costos', 'kardex: referencia del ajuste de costos');
-- Venta y anulación con su número: la fila de ventas se simula con las FK apagadas (solo el número importa aquí).
reset role;
set local session_replication_role = replica;
insert into public.ventas (id, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por, origen,
  creada_en_cliente, subtotal, total, huella) values
  ('cccccccc-3000-0000-0000-0000000000f1', pg_temp.i('T'), pg_temp.i('U1'), gen_random_uuid(), gen_random_uuid(), 'C1-000001',
   pg_temp.i('d'), pg_temp.i('d'), 'online', now(), 5, 5, 'h');
set local session_replication_role = origin;
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PK'), 'venta', -1, 2, 'venta', 'cccccccc-3000-0000-0000-0000000000f1'),
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('PK'), 'anulacion_venta', 1, 2, 'venta', 'cccccccc-3000-0000-0000-0000000000f1');
select pg_temp.como(pg_temp.i('d'));
select results_eq($$select tipo, referencia from public.kardex_producto(pg_temp.i('PK')) where ref_tipo = 'venta' order by tipo$$,
  $$values ('anulacion_venta', 'Anulación de la venta C1-000001'), ('venta', 'Venta C1-000001')$$, 'kardex: referencia de la venta y de su anulación');
-- paginación: tres páginas de 4 cubren todo sin repetir
select set_config('t.p1', (select string_agg(id::text, ',' order by n) from (select id, row_number() over () n from public.kardex_producto(pg_temp.i('P1'), null, 4)) a), true);
select set_config('t.c1', (select id::text from public.kardex_producto(pg_temp.i('P1'), null, 4) offset 3 limit 1), true);
select set_config('t.c2', (select id::text from public.kardex_producto(pg_temp.i('P1'), null, 4, current_setting('t.c1')::uuid) offset 3 limit 1), true);
select is((select count(distinct id) from (
    select id from public.kardex_producto(pg_temp.i('P1'), null, 4)
    union all select id from public.kardex_producto(pg_temp.i('P1'), null, 4, current_setting('t.c1')::uuid)
    union all select id from public.kardex_producto(pg_temp.i('P1'), null, 4, current_setting('t.c2')::uuid)) p),
  (select count(*) from public.movimientos_inventario where producto_id = pg_temp.i('P1')), 'kardex: la paginación cubre todo sin repetir');
select throws_ok($$select * from public.kardex_producto(pg_temp.i('P1'), null, 0)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'kardex: límite inválido');
select throws_ok($$select * from public.kardex_producto(pg_temp.i('P1'), null, 10, gen_random_uuid())$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'kardex: cursor inexistente');
select pg_temp.como(pg_temp.i('c'));
select cmp_ok((select count(*) from public.kardex_producto(pg_temp.i('P1'))), '>', 0::bigint, 'kardex: el contador (ver_reportes) lo lee');
select is((select count(*) from public.kardex_producto(pg_temp.i('P1')) where costo_unitario is not null), current_setting('t.ncosto')::bigint, 'kardex: el contador con ver_costos recibe costos');
-- Ningún rol de la matriz lee el kardex sin ver_costos: se quita el permiso al contador solo dentro de esta transacción.
reset role;
delete from public.rol_permisos where tipo_negocio = 'tienda' and rol = 'contador' and permiso = 'ver_costos';
select pg_temp.como(pg_temp.i('c'));
select cmp_ok((select count(*) from public.kardex_producto(pg_temp.i('P1'))), '>', 0::bigint, 'kardex: acceso por ver_reportes sin ver_costos');
select is((select count(*) from public.kardex_producto(pg_temp.i('P1')) where costo_unitario is not null), 0::bigint, 'kardex: sin ver_costos el costo sale null');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select * from public.kardex_producto(pg_temp.i('P1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'kardex: el vendedor no lo lee');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select * from public.kardex_producto(pg_temp.i('P1'))$$, 'P0001', 'ERP_SIN_PERMISO', 'kardex: usuario de otro negocio');
select throws_ok($$select * from public.kardex_producto(gen_random_uuid())$$, 'P0001', 'ERP_SIN_PERMISO', 'kardex: producto inexistente da el mismo error');

-- productos_stock_bajo
reset role;
insert into public.productos (id, negocio_id, codigo, nombre, tipo, stock_minimo) values
  ('eeeeeeee-3000-0000-0000-0000000000a1', pg_temp.i('T'), 'SIN', 'Sin stock', 'producto', 3);
insert into public.productos (id, negocio_id, codigo, nombre, tipo, stock_minimo, activo) values
  ('eeeeeeee-3000-0000-0000-0000000000a2', pg_temp.i('T'), 'INA', 'Inactivo', 'producto', 3, false);
update public.stock set cantidad = 15 where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U2');
update public.stock set cantidad = 3 where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1');
select pg_temp.como(pg_temp.i('v'));
select results_eq($$select codigo, cantidad from public.productos_stock_bajo(pg_temp.i('T')) order by codigo$$, $$values ('P1', 18.000::numeric), ('SIN', 0.000::numeric)$$, 'stock bajo: suma de ubicaciones; sin filas cuenta 0; null e inactivos no avisan');
reset role;
update public.stock set cantidad = 20 where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U2');
select pg_temp.como(pg_temp.i('v'));
select results_eq($$select codigo from public.productos_stock_bajo(pg_temp.i('T'))$$, $$values ('SIN')$$, 'stock bajo: con la suma igual al mínimo ya no avisa');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select * from public.productos_stock_bajo(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'stock bajo: usuario de otro negocio');

select * from finish();
rollback;
