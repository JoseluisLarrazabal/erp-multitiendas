-- RPC registrar_entrada y ajustar_inventario.
begin;
select plan(65);
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

-- registrar_entrada
select pg_temp.como(pg_temp.i('d'));
select set_config('t.m1', public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 5, 'compra')::text, true);
select isnt(current_setting('t.m1'), '', 'entrada: devuelve el id del movimiento');
select results_eq($$select tipo, cantidad, ref_id, usuario_id, motivo from public.movimientos_inventario where id = current_setting('t.m1')::uuid$$,
  $$values ('entrada', 10.000::numeric, pg_temp.i('O1'), pg_temp.i('d'), 'compra')$$, 'entrada: movimiento con operación, usuario y motivo');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 10.000::numeric, 'entrada: suma al stock');
select is(public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 5, 'compra')::text, current_setting('t.m1'), 'entrada: repetir la operación devuelve el mismo movimiento');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O1')), 1::bigint, 'entrada: repetir no duplica el movimiento');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 10.000::numeric, 'entrada: repetir no duplica el stock');
select lives_ok($$select public.registrar_entrada(pg_temp.i('O2'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 5, null, null)$$, 'entrada: costo y motivo opcionales');
select lives_ok($$select public.registrar_entrada(pg_temp.i('O3'), pg_temp.i('T'), pg_temp.i('PK'), pg_temp.i('U1'), 2.125, 3.5, null)$$, 'entrada: decimales en kg');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 0, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: cantidad 0');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), -1, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: cantidad negativa');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'NaN', 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: cantidad NaN');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 'NaN', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: costo NaN');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1, -1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: costo negativo');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1.5, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: decimal en producto por unidad');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('PK'), pg_temp.i('U1'), 1.2345, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: más de 3 decimales');
select throws_ok($$select public.registrar_entrada(null, pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: operación nula');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('L'), pg_temp.i('PL'), pg_temp.i('UL'), 1, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: un servicio no mueve stock');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('PI'), pg_temp.i('U1'), 1, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: producto de otro negocio');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O4'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('UL'), 1, 1, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'entrada: ubicación de otro negocio');
select lives_ok($$select public.registrar_entrada(pg_temp.i('O5'), pg_temp.i('L'), pg_temp.i('PI'), pg_temp.i('UL'), 4, 1, null)$$, 'entrada: el insumo sí mueve stock');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_entrada(pg_temp.i('O6'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 1, null)$$, 'P0001', 'ERP_SIN_PERMISO', 'entrada: el vendedor no ajusta inventario');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.registrar_entrada(pg_temp.i('O6'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 1, null)$$, 'P0001', 'ERP_SIN_PERMISO', 'entrada: el contador no ajusta inventario');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.registrar_entrada(pg_temp.i('O6'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 1, 1, null)$$, 'P0001', 'ERP_SIN_PERMISO', 'entrada: usuario de otro negocio');

-- ajustar_inventario
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O10'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', 3, 'sobrante', null)$$, 'ajuste: positivo');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -2, 'faltante', null)$$, 'ajuste: negativo');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O12'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'danado', -1, 'roto', null)$$, 'danado');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O13'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'cambio_garantia', -1, 'garantía', null)$$, 'cambio_garantia');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O14'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'devolucion_proveedor', -1, 'devuelto', null)$$, 'devolucion_proveedor');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 13.000::numeric, 'ajustes: stock 15 + 3 - 2 - 1 - 1 - 1');
reset role;
select results_eq($$select tipo, costo_unitario from public.movimientos_inventario where ref_id in (pg_temp.i('O10'), pg_temp.i('O11')) order by tipo, cantidad$$,
  $$values ('ajuste', 5.0000::numeric), ('ajuste', null::numeric)$$, 'salida: costo_unitario es el promedio vigente; el ajuste positivo no lleva costo');
select pg_temp.como(pg_temp.i('d'));
select is(public.ajustar_inventario(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -2, 'faltante', null),
  (select id from public.movimientos_inventario where ref_id = pg_temp.i('O11')), 'ajuste: repetir devuelve el mismo movimiento');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O11')), 1::bigint, 'ajuste: repetir no duplica');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 13.000::numeric, 'ajuste: repetir no cambia el stock');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'danado', 1, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'danado positivo');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'devolucion_proveedor', 1, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'devolucion_proveedor positiva');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', 0, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ajuste en 0');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'venta', -1, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'tipo no permitido');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -1, '  ', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo vacío');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -1, null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo nulo');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -1.5, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'decimal en unidad');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', 'NaN', 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad NaN');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('UL'), 'ajuste', -1, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ubicación de otro negocio');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O15'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -1, 'x', array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie_ids en un producto sin serie');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O16'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', -100, 'x', null)$$, 'RN-04: salida sin stock suficiente se permite');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O17'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', 1, 'x', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'ajuste: el vendedor no puede');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O17'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', 1, 'x', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'ajuste: usuario de otro negocio');

-- Series en salidas
select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('O20'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 3, 100, null);
reset role;
insert into public.series (id, negocio_id, producto_id, serie, ubicacion_id) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('PS'), 'A1', pg_temp.i('U1')),
  (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('PS'), 'A2', pg_temp.i('U1')),
  (pg_temp.i('S3'), pg_temp.i('T'), pg_temp.i('PS'), 'A3', pg_temp.i('U2'));
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O21'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -2, 'x', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: la salida exige serie_ids');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O21'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -2, 'x', array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: cantidad distinta de serie_ids');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O21'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -2, 'x', array[pg_temp.i('S1'), pg_temp.i('S3')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: una está en otra ubicación');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O21'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -2, 'x', array[pg_temp.i('S1'), pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: repetida');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O21'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'ajuste', 1, 'x', array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: una entrada no lleva serie_ids');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O22'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -2, 'x', array[pg_temp.i('S1'), pg_temp.i('S2')])$$, 'serie: salida con sus series');
select is((select count(*) from public.series where estado = 'baja' and id in (pg_temp.i('S1'), pg_temp.i('S2'))), 2::bigint, 'serie: pasan a baja');
select lives_ok($$select public.ajustar_inventario(pg_temp.i('O22'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -2, 'x', array[pg_temp.i('S1'), pg_temp.i('S2')])$$, 'serie: repetir la operación no falla');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O23'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 'danado', -1, 'x', array[pg_temp.i('S1')])$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'serie: una en baja ya no está disponible');

-- Idempotencia por operación: el mismo id con otros datos, otra ubicación, otro producto u otro negocio no pasa.
select pg_temp.como(pg_temp.i('d'));
select set_config('t.antes', (select sum(cantidad)::text from public.stock), true);
select set_config('t.antes_n', (select count(*)::text from public.movimientos_inventario), true);
select throws_ok($$select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U2'), 10, 5, 'compra')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: entrada con otra ubicación');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('PK'), pg_temp.i('U1'), 10, 5, 'compra')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: entrada con otro producto');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 11, 5, 'compra')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: entrada con otra cantidad');
select throws_ok($$select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('L'), pg_temp.i('PI'), pg_temp.i('UL'), 10, 5, 'compra')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: entrada en otro negocio');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 'ajuste', 10, 'compra', null)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: el id de una entrada no sirve para un ajuste');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U2'), 'ajuste', -2, 'faltante', null)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: ajuste con otra ubicación');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O11'), pg_temp.i('T'), pg_temp.i('PK'), pg_temp.i('U1'), 'ajuste', -2, 'faltante', null)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: ajuste con otro producto');
select throws_ok($$select public.ajustar_inventario(pg_temp.i('O11'), pg_temp.i('L'), pg_temp.i('PI'), pg_temp.i('UL'), 'ajuste', -2, 'faltante', null)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: ajuste en otro negocio');
select is((select sum(cantidad)::text from public.stock), current_setting('t.antes'), 'idempotencia: el stock no cambia');
select is((select count(*)::text from public.movimientos_inventario), current_setting('t.antes_n'), 'idempotencia: no hay movimientos nuevos');

select * from finish();
rollback;
