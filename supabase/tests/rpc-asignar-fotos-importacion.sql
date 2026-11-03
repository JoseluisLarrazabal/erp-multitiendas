-- asignar_fotos_importacion: solo service_role; asigna si no hay foto; ruta del negocio; todo o nada.
begin;
select plan(11);

insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-9100-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-9100-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, foto_path) values
  ('eeeeeeee-9100-0000-0000-000000000001', 'aaaaaaaa-9100-0000-0000-000000000001', 'P1', 'P1', 'producto', null),
  ('eeeeeeee-9100-0000-0000-000000000002', 'aaaaaaaa-9100-0000-0000-000000000001', 'P2', 'P2', 'producto',
    'aaaaaaaa-9100-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.png');

select ok(not has_function_privilege('authenticated', 'public.asignar_fotos_importacion(uuid, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.asignar_fotos_importacion(uuid, jsonb)', 'EXECUTE'),
  'authenticated y anon no la ejecutan');
select ok(has_function_privilege('service_role', 'public.asignar_fotos_importacion(uuid, jsonb)', 'EXECUTE'),
  'service_role la ejecuta');

select is(public.asignar_fotos_importacion('aaaaaaaa-9100-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000001',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000001/eeeeeeee-9100-0000-0000-000000000001.jpg'),
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000002',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000001/eeeeeeee-9100-0000-0000-000000000002.jpg'))),
  '{"asignadas": 1, "ya_existian": 1}'::jsonb, 'asigna la que no tenía y cuenta la que ya tenía');
select is((select foto_path from public.productos where id = 'eeeeeeee-9100-0000-0000-000000000001'),
  'aaaaaaaa-9100-0000-0000-000000000001/eeeeeeee-9100-0000-0000-000000000001.jpg', 'foto_path quedó asignada');
select is((select foto_path from public.productos where id = 'eeeeeeee-9100-0000-0000-000000000002'),
  'aaaaaaaa-9100-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.png', 'no pisa la foto existente');
select is(public.asignar_fotos_importacion('aaaaaaaa-9100-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000001',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000001/eeeeeeee-9100-0000-0000-000000000001.jpg'))),
  '{"asignadas": 0, "ya_existian": 1}'::jsonb, 'segunda llamada: 0 asignadas');

select throws_ok($$select public.asignar_fotos_importacion('aaaaaaaa-9100-0000-0000-000000000002', jsonb_build_array(
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000001',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000002/eeeeeeee-9100-0000-0000-000000000001.jpg')))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'producto de otro negocio');
select throws_ok($$select public.asignar_fotos_importacion('aaaaaaaa-9100-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000001',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000002/eeeeeeee-9100-0000-0000-000000000001.jpg')))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'ruta de otro negocio');
select throws_ok($$select public.asignar_fotos_importacion('aaaaaaaa-9100-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000001',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000001/a/eeeeeeee-9100-0000-0000-000000000001.gif')))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'subcarpeta y extensión no permitida');
select throws_ok($$select public.asignar_fotos_importacion('aaaaaaaa-9100-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('producto_id', 'eeeeeeee-9100-0000-0000-000000000001',
    'foto_path', 'aaaaaaaa-9100-0000-0000-000000000001/eeeeeeee-9100-0000-0000-000000000002.jpg')))$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'ruta con el uuid de otro producto');

select * from finish();
rollback;
