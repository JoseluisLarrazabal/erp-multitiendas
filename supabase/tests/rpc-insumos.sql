-- DB-26: registrar_consumo y reporte_insumos (RF-INS-02). Consumo baja stock y suma al gasto con costo foto.
begin;
select plan(37);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t2600' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de L · e encargado · v vendedor · m empleado · c contador · x dueño de L2
select pg_temp.crear_usuario(n) from (values ('d'), ('e'), ('v'), ('m'), ('c'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo) values (pg_temp.i('L'), 'L', 'lavanderia'), (pg_temp.i('L2'), 'L2', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('L'), 'dueno'), (pg_temp.i('e'), pg_temp.i('L'), 'encargado'),
  (pg_temp.i('v'), pg_temp.i('L'), 'vendedor'), (pg_temp.i('m'), pg_temp.i('L'), 'empleado'),
  (pg_temp.i('c'), pg_temp.i('L'), 'contador'), (pg_temp.i('x'), pg_temp.i('L2'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('UL'), pg_temp.i('L'), 'UL', 'local'), (pg_temp.i('UX'), pg_temp.i('L2'), 'UX', 'local');
-- I1 insumo por unidad · I2 insumo por kg · PS servicio · PP producto · PN insumo inactivo · IX insumo de L2
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, activo) values
  (pg_temp.i('I1'), pg_temp.i('L'), 'I1', 'Insumo1', 'insumo', 'unidad', true),
  (pg_temp.i('I2'), pg_temp.i('L'), 'I2', 'Insumo2', 'insumo', 'kg', true),
  (pg_temp.i('PS'), pg_temp.i('L'), 'PS', 'Servicio', 'servicio', 'unidad', true),
  (pg_temp.i('PP'), pg_temp.i('L'), 'PP', 'Producto', 'producto', 'unidad', true),
  (pg_temp.i('PN'), pg_temp.i('L'), 'PN', 'Inactivo', 'insumo', 'unidad', false),
  (pg_temp.i('IX'), pg_temp.i('L2'), 'IX', 'Ajeno', 'insumo', 'unidad', true);
-- Stock inicial: I1 10 a 5 · I2 20 a 4 · PP 5 a 1 · PN 5 a 1. Consumos pasados (La Paz): I1 -2 a 5 el 10-mar 23:30, I2 -1 a 4 el 11-mar.
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, created_at) values
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('I1'), 'inicial', 10, 5, now() - interval '400 days'),
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('I2'), 'inicial', 20, 4, now() - interval '400 days'),
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('PP'), 'inicial', 5, 1, now() - interval '400 days'),
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('PN'), 'inicial', 5, 1, now() - interval '400 days'),
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('I1'), 'consumo', -2, 5, '2026-03-10 23:30:00-04'),
  (pg_temp.i('L'), pg_temp.i('UL'), pg_temp.i('I2'), 'consumo', -1, 4, '2026-03-11 10:00:00-04');
create function pg_temp.stock(p text) returns numeric language sql as $$
  select cantidad from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i('UL') $$;
create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/La_Paz')::date $$;
create function pg_temp.consumo(p_op text, p_prod text, p_cant numeric, p_motivo text default 'lavado') returns uuid language sql as $$
  select public.registrar_consumo(pg_temp.i(p_op), pg_temp.i('L'), pg_temp.i(p_prod), pg_temp.i('UL'), p_cant, p_motivo) $$;

-- Encargado: consumo baja el stock y deja un movimiento con costo foto
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select pg_temp.consumo('O1', 'I1', 3)$$, 'el encargado registra un consumo');
reset role;
select is(pg_temp.stock('I1'), 5::numeric, 'I1: 10 - 2 - 3 = 5');
select is((select cantidad from public.movimientos_inventario where ref_id = pg_temp.i('O1')), -3::numeric, 'movimiento con cantidad negativa');
select is((select costo_unitario from public.movimientos_inventario where ref_id = pg_temp.i('O1')), 5::numeric, 'costo foto = costo promedio vigente');
select is((select tipo || '/' || ref_tipo from public.movimientos_inventario where ref_id = pg_temp.i('O1')), 'consumo/consumo', 'tipo y ref_tipo consumo');
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select pg_temp.consumo('O2', 'I2', 1.5)$$, 'consumo con decimales en un insumo por kg');
reset role;
select is(pg_temp.stock('I2'), 17.5::numeric, 'I2: 20 - 1 - 1,5 = 17,5');

-- Idempotencia
select pg_temp.como(pg_temp.i('e'));
select is(pg_temp.consumo('O1', 'I1', 3), (select id from public.movimientos_inventario where ref_id = pg_temp.i('O1')), 'repetir la operación devuelve el mismo movimiento');
reset role;
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O1')), 1::bigint, 'una sola fila de kardex');
select is(pg_temp.stock('I1'), 5::numeric, 'repetir no baja el stock otra vez');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select pg_temp.consumo('O1', 'I1', 4)$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id con otra cantidad');
select throws_ok($$select pg_temp.consumo('O1', 'I1', 3, 'otro motivo')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'mismo id con otro motivo');

-- Solo insumos del negocio, activos, con cantidad válida
select throws_ok($$select pg_temp.consumo('O3', 'PS', 1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'un servicio no se consume');
select throws_ok($$select pg_temp.consumo('O3', 'PP', 1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'un producto no se consume');
select throws_ok($$select pg_temp.consumo('O3', 'PN', 1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'un insumo inactivo no se consume');
select throws_ok($$select pg_temp.consumo('O3', 'IX', 1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'el insumo de otro negocio se rechaza');
select throws_ok($$select public.registrar_consumo(pg_temp.i('O3'), pg_temp.i('L'), pg_temp.i('I1'), pg_temp.i('UX'), 1, 'x')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'la ubicación de otro negocio se rechaza');
select throws_ok($$select pg_temp.consumo('O3', 'I1', 0)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad 0');
select throws_ok($$select pg_temp.consumo('O3', 'I1', -1)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad negativa');
select throws_ok($$select pg_temp.consumo('O3', 'I1', 1.5)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad fraccionaria en un insumo por unidad');
select throws_ok($$select pg_temp.consumo('O3', 'I1', 1, '  ')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo vacío');

-- Permisos
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.consumo('O4', 'I1', 1)$$, 'P0001', 'ERP_SIN_PERMISO', 'el vendedor no registra consumos');
select pg_temp.como(pg_temp.i('m'));
select throws_ok($$select pg_temp.consumo('O4', 'I1', 1)$$, 'P0001', 'ERP_SIN_PERMISO', 'el empleado no registra consumos');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select pg_temp.consumo('O4', 'I1', 1)$$, 'P0001', 'ERP_SIN_PERMISO', 'el contador no registra consumos');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.consumo('O4', 'I1', 1)$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio no registra consumos');

-- Reporte: gasto = cantidad * costo foto
select pg_temp.como(pg_temp.i('d'));
select is((select jsonb_agg(f - 'consumos' - 'sin_costo' order by f ->> 'clave') from jsonb_array_elements(
  public.reporte_insumos(pg_temp.i('L'), '2026-03-09', '2026-03-12', 'dia') -> 'filas') f),
  '[{"clave":"2026-03-10","etiqueta":"2026-03-10","cantidad":2.000,"gasto":10.0000},{"clave":"2026-03-11","etiqueta":"2026-03-11","cantidad":1.000,"gasto":4.0000}]'::jsonb,
  'por día: el consumo de las 23:30 cuenta el día de La Paz');
select is(public.reporte_insumos(pg_temp.i('L'), pg_temp.hoy(), pg_temp.hoy(), 'insumo') -> 'totales',
  '{"consumos":2,"cantidad":4.500,"gasto":21,"sin_costo":0}'::jsonb, 'totales de hoy: 3 x 5 + 1,5 x 4 = 21');
select is((select f ->> 'etiqueta' || '=' || round((f ->> 'gasto')::numeric, 2) from jsonb_array_elements(
  public.reporte_insumos(pg_temp.i('L'), pg_temp.hoy(), pg_temp.hoy(), 'insumo') -> 'filas') f order by (f ->> 'gasto')::numeric desc limit 1),
  'I1 Insumo1=15.00', 'por insumo: I1 es el mayor gasto');
select throws_ok($$select public.reporte_insumos(pg_temp.i('L'), '2026-03-12', '2026-03-09', 'dia')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'desde > hasta');
select throws_ok($$select public.reporte_insumos(pg_temp.i('L'), '2025-01-01', '2026-03-09', 'dia')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'más de 366 días');
select throws_ok($$select public.reporte_insumos(pg_temp.i('L'), '2026-03-09', '2026-03-12', 'marca')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'agrupación inválida');

-- ver_reportes y ver_costos
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.reporte_insumos(pg_temp.i('L'), '2026-03-09', '2026-03-12', 'dia')$$, 'P0001', 'ERP_SIN_PERMISO', 'el vendedor (sin ver_reportes) no lee el reporte');
select pg_temp.como(pg_temp.i('c'));
select lives_ok($$select public.reporte_insumos(pg_temp.i('L'), '2026-03-09', '2026-03-12', 'dia')$$, 'el contador (ver_reportes y ver_costos) lee el reporte');
reset role;
delete from public.rol_permisos where tipo_negocio = 'lavanderia' and rol = 'contador' and permiso = 'ver_costos';
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.reporte_insumos(pg_temp.i('L'), '2026-03-09', '2026-03-12', 'dia')$$, 'P0001', 'ERP_SIN_PERMISO', 'sin ver_costos no hay reporte');

-- Stock negativo permitido y stock = kardex
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select pg_temp.consumo('O5', 'I1', 20)$$, 'consumir más que el stock se permite (RN-04)');
reset role;
select is(pg_temp.stock('I1'), -15::numeric, 'I1 queda en -15');
select pg_temp.como(pg_temp.i('d'));
select is((select count(*) from public.stock_inconsistente(pg_temp.i('L'))), 0::bigint, 'stock = suma del kardex');

select * from finish();
rollback;
