-- RPC registrar_stock_inicial: solo service_role, validaciones, idempotencia por producto, cantidad 0.
begin;
select plan(19);

insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-5000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-5000-0000-0000-000000000002', 'O', 'tienda');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'Tienda', 'local'),
  ('bbbbbbbb-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000001', 'Depósito', 'deposito'),
  ('bbbbbbbb-5000-0000-0000-000000000003', 'aaaaaaaa-5000-0000-0000-000000000002', 'Otra', 'local');
-- A unidad · B unidad · K kg · S servicio · X producto del otro negocio
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad) values
  ('eeeeeeee-5000-0000-0000-00000000000a', 'aaaaaaaa-5000-0000-0000-000000000001', 'A', 'A', 'producto', 'unidad'),
  ('eeeeeeee-5000-0000-0000-00000000000b', 'aaaaaaaa-5000-0000-0000-000000000001', 'B', 'B', 'producto', 'unidad'),
  ('eeeeeeee-5000-0000-0000-00000000000c', 'aaaaaaaa-5000-0000-0000-000000000001', 'K', 'K', 'producto', 'kg'),
  ('eeeeeeee-5000-0000-0000-00000000000d', 'aaaaaaaa-5000-0000-0000-000000000001', 'S', 'S', 'servicio', 'unidad'),
  ('eeeeeeee-5000-0000-0000-00000000000e', 'aaaaaaaa-5000-0000-0000-000000000002', 'X', 'X', 'producto', 'unidad');

create function pg_temp.item(p text, u text, c text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'producto_id', 'eeeeeeee-5000-0000-0000-00000000000' || p,
    'ubicacion_id', 'bbbbbbbb-5000-0000-0000-00000000000' || u,
    'cantidad', c::jsonb))
$$;
create function pg_temp.reg(p_items jsonb) returns jsonb language sql as $$
  select public.registrar_stock_inicial('aaaaaaaa-5000-0000-0000-000000000001', p_items)
$$;

-- Permisos
select ok(has_function_privilege('service_role', 'public.registrar_stock_inicial(uuid, jsonb)', 'EXECUTE'),
  'service_role ejecuta la RPC');
select ok(not has_function_privilege('authenticated', 'public.registrar_stock_inicial(uuid, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.registrar_stock_inicial(uuid, jsonb)', 'EXECUTE'),
  'authenticated y anon no tienen EXECUTE');
select set_config('role', 'authenticated', true);
select throws_ok($$select pg_temp.reg('[]')$$, '42501', null, 'authenticated rechazado');
select set_config('role', 'anon', true);
select throws_ok($$select pg_temp.reg('[]')$$, '42501', null, 'anon rechazado');
select set_config('role', 'service_role', true);

-- Validaciones (todo o nada)
select throws_ok($$select pg_temp.reg('{}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'items no es arreglo');
select throws_ok($$select public.registrar_stock_inicial('aaaaaaaa-5000-0000-0000-000000000001',
  (select jsonb_agg(i) from generate_series(1, 501) g, lateral jsonb_array_elements(pg_temp.item('a', '1', '1')) i))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'más de 500 items');
select throws_ok($$select pg_temp.reg(pg_temp.item('e', '1', '1'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto de otro negocio');
select throws_ok($$select pg_temp.reg(pg_temp.item('a', '3', '1'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'ubicación de otro negocio');
select throws_ok($$select pg_temp.reg(pg_temp.item('d', '1', '1'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'servicio rechazado');
select throws_ok($$select pg_temp.reg(pg_temp.item('a', '1', '-1'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad negativa');
select throws_ok($$select pg_temp.reg(pg_temp.item('a', '1', '"NaN"'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cantidad NaN como texto');
select throws_ok($$select pg_temp.reg(pg_temp.item('a', '1', '1.5'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'unidad con decimal');
select throws_ok($$select pg_temp.reg(pg_temp.item('c', '1', '1.2345'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'más de 3 decimales');
select throws_ok($$select pg_temp.reg(pg_temp.item('a', '1', '1') || pg_temp.item('e', '1', '1'))$$, 'P0001', 'ERP_DATOS_INVALIDOS',
  'un item inválido revierte el lote');
select is((select count(*) from public.movimientos_inventario where negocio_id = 'aaaaaaaa-5000-0000-0000-000000000001')::integer, 0, 'nada escrito tras los rechazos');

-- Camino feliz, kg con decimal, cantidad 0
select is(pg_temp.reg(pg_temp.item('a', '1', '4') || pg_temp.item('c', '2', '2.5') || pg_temp.item('b', '1', '0')),
  '{"creados": 2, "ya_existian": 0}'::jsonb, 'crea 2, la cantidad 0 no cuenta');
select is((select count(*) from public.movimientos_inventario where negocio_id = 'aaaaaaaa-5000-0000-0000-000000000001' and tipo = 'inicial' and ref_tipo = 'importacion')::integer, 2,
  'movimientos inicial/importacion, ninguno para cantidad 0');

-- Idempotencia por producto aun con otra ubicación
select is(pg_temp.reg(pg_temp.item('a', '2', '9')), '{"creados": 0, "ya_existian": 1}'::jsonb,
  'producto con inicial en otra ubicación: se omite completo');
select is((select sum(cantidad) from public.stock where producto_id = 'eeeeeeee-5000-0000-0000-00000000000a'), 4.000,
  'stock del producto sin duplicar');

select * from finish();
rollback;
