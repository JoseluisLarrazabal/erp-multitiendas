-- Kardex: DB-02, DB-10, DB-12, costo promedio (trigger), permisos por columna.
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

-- Movimientos directos (como dueño de la tabla): el trigger arma stock.
insert into public.movimientos_inventario (id, negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_id) values
  ('11111111-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'entrada', 10, 10, 'cccccccc-3000-0000-0000-000000000001');

-- DB-02: append-only
select throws_ok($$update public.movimientos_inventario set motivo = 'x'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'DB-02: UPDATE rechazado');
select throws_ok($$delete from public.movimientos_inventario$$, 'P0001', 'ERP_SOLO_AGREGAR', 'DB-02: DELETE rechazado');
select throws_ok($$truncate public.movimientos_inventario$$, 'P0001', 'ERP_SOLO_AGREGAR', 'DB-02: TRUNCATE rechazado');
select throws_ok($$truncate public.conteo_items$$, 'P0001', 'ERP_SOLO_AGREGAR', 'conteo_items: TRUNCATE rechazado');
insert into public.operaciones_inventario (id, negocio_id, huella) values ('cccccccc-3000-0000-0000-0000000000f1', 'aaaaaaaa-3000-0000-0000-000000000001', 'h');
select throws_ok($$update public.operaciones_inventario set huella = 'x'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'operaciones_inventario: UPDATE rechazado');
select throws_ok($$delete from public.operaciones_inventario$$, 'P0001', 'ERP_SOLO_AGREGAR', 'operaciones_inventario: DELETE rechazado');
select throws_ok($$truncate public.operaciones_inventario$$, 'P0001', 'ERP_SOLO_AGREGAR', 'operaciones_inventario: TRUNCATE rechazado');

-- Checks de la tabla
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'entrada', 0)$$, '23514', null, 'cantidad 0 solo para ajuste_costo');
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'ajuste_costo', 1, 5)$$, '23514', null, 'ajuste_costo exige cantidad 0');
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'ajuste_costo', 0)$$, '23514', null, 'ajuste_costo exige costo');
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'regalo', 1)$$, '23514', null, 'tipo desconocido');
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'entrada', 'NaN')$$, '23514', null, 'cantidad NaN');
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'entrada', 1, -1)$$, '23514', null, 'costo negativo');

-- FK compuestas: producto o ubicación de otro negocio
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000003', 'eeeeeeee-3000-0000-0000-000000000001', 'entrada', 1)$$, '23503', null, 'ubicación de otro negocio');
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000005', 'entrada', 1)$$, '23503', null, 'producto de otro negocio');

-- Índices únicos parciales
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, ref_id) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'entrada', 1, 'cccccccc-3000-0000-0000-000000000001')$$, '23505', null, 'misma operación, producto, ubicación y tipo: único');
select lives_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, ref_id) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'ajuste', 0 + 1, 'cccccccc-3000-0000-0000-000000000001')$$, 'misma operación con otro tipo: permitido');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000001', 'inicial', 1);
select throws_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000001', 'inicial', 2)$$, '23505', null, 'un solo inicial por producto y ubicación');
select lives_ok($$insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'inicial', 2)$$, 'inicial en otra ubicación es válido');

-- DB-10: promedio ponderado. P1 en U1: 10 @10 + 1 ajuste + 2 inicial. Se mide en una ubicación limpia (PI/PK).
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000003', 'entrada', 10, 10),
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000003', 'entrada', 10, 20);
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000003'$$, $$values (20.000::numeric, 15.0000::numeric)$$, 'DB-10: dos entradas con costos distintos promedian 15');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000003', 'venta', -5, 15, 'venta');
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000003'$$, $$values (15.000::numeric, 15.0000::numeric)$$, 'una salida resta stock y no cambia el promedio');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000003', 'ajuste_costo', 0, 30);
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000003'$$, $$values (15.000::numeric, 30.0000::numeric)$$, 'ajuste_costo fija el promedio sin tocar la cantidad');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000003', 'entrada', 5, null);
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000003'$$, $$values (20.000::numeric, 30.0000::numeric)$$, 'entrada sin costo no cambia el promedio');

-- Costo previo null: la primera entrada con costo lo fija
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000002', 'entrada', 5, null),
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000002', 'eeeeeeee-3000-0000-0000-000000000002', 'entrada', 5, 8);
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000002'$$, $$values (10.000::numeric, 8.0000::numeric)$$, 'costo previo null: toma el costo nuevo');

-- Stock previo negativo cuenta 0 (DB-12: el negativo se permite)
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000003', 'entrada', 2, 5),
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000003', 'venta', -6, 5);
select is((select cantidad from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000003' and ubicacion_id = 'bbbbbbbb-3000-0000-0000-000000000001'), -4.000::numeric, 'DB-12: el stock negativo se permite');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000003', 'entrada', 6, 10);
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000003' and ubicacion_id = 'bbbbbbbb-3000-0000-0000-000000000001'$$, $$values (2.000::numeric, 10.0000::numeric)$$, 'stock previo negativo cuenta 0 en el promedio');

-- kg con 3 decimales
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000002', 'entrada', 1.500, 10),
  ('aaaaaaaa-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000002', 'entrada', 2.250, 12.3333);
select results_eq($$select cantidad, costo_promedio from public.stock where producto_id = 'eeeeeeee-3000-0000-0000-000000000002' and ubicacion_id = 'bbbbbbbb-3000-0000-0000-000000000001'$$,
  $$values (3.750::numeric, round((1.5 * 10 + 2.25 * 12.3333) / 3.75, 4))$$, 'kg: promedio ponderado con 3 decimales, a 4 decimales');

-- Permisos por columna: el vendedor lee cantidades, no costos
select pg_temp.como('99999999-3000-0000-0000-000000000002');
select cmp_ok((select count(*) from public.stock), '>', 0::bigint, 'vendedor lee filas de stock de su negocio');
select cmp_ok((select count(*) from public.movimientos_inventario), '>', 0::bigint, 'vendedor lee movimientos de su negocio');
select throws_ok($$select costo_promedio from public.stock$$, '42501', null, 'vendedor no lee stock.costo_promedio');
select throws_ok($$select * from public.stock$$, '42501', null, 'select * de stock falla para authenticated');
select throws_ok($$select costo_unitario from public.movimientos_inventario$$, '42501', null, 'vendedor no lee movimientos.costo_unitario');
select throws_ok($$insert into public.stock (negocio_id, producto_id, ubicacion_id, cantidad) values ('aaaaaaaa-3000-0000-0000-000000000001', 'eeeeeeee-3000-0000-0000-000000000001', 'bbbbbbbb-3000-0000-0000-000000000001', 1)$$, '42501', null, 'sin escritura directa en stock');
select isnt((select provolatile from pg_proc where proname = 'validar_inventario' and pronamespace = 'public'::regnamespace), 's', 'validar_inventario toma for share: no es stable');
select throws_ok($$select * from public.operaciones_inventario$$, '42501', null, 'authenticated no lee operaciones_inventario');
select pg_temp.como('99999999-3000-0000-0000-000000000004');
select is((select count(*) from public.stock), 0::bigint, 'usuario de otro negocio no ve stock ajeno');

select * from finish();
rollback;
