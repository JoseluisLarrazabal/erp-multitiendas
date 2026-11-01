-- RPC guardar_categoria, guardar_producto, desactivar_producto.
begin;
select plan(52);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería.
-- d: dueño de T y L · v: vendedor de T · c: contador de T · x: encargado de L (ajeno a T)
select pg_temp.crear_usuario(('99999999-2000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-2000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-2000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-2000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000001', 'dueno'),
  ('99999999-2000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000002', 'dueno'),
  ('99999999-2000-0000-0000-000000000002', 'aaaaaaaa-2000-0000-0000-000000000001', 'vendedor'),
  ('99999999-2000-0000-0000-000000000003', 'aaaaaaaa-2000-0000-0000-000000000001', 'contador'),
  ('99999999-2000-0000-0000-000000000004', 'aaaaaaaa-2000-0000-0000-000000000002', 'encargado');

-- guardar_categoria: feliz
select pg_temp.como('99999999-2000-0000-0000-000000000001');
select set_config('t.cat', public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', null, '  Celulares ')::text, true);
select isnt(current_setting('t.cat'), '', 'categoría: crear devuelve el id');
select is((select nombre from public.categorias where id = current_setting('t.cat')::uuid), 'Celulares', 'categoría: nombre recortado');
select lives_ok(format($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', %L, 'Telefonía')$$, current_setting('t.cat')), 'categoría: renombrar');
select is((select nombre from public.categorias where id = current_setting('t.cat')::uuid), 'Telefonía', 'categoría: nombre actualizado');
select set_config('t.cat_l', public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000002', null, 'Telefonía')::text, true);
select isnt(current_setting('t.cat_l'), '', 'categoría: el mismo nombre en otro negocio es válido');
-- guardar_categoria: inválidos, duplicado, permisos
select throws_ok($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', null, 'TELEFONÍA')$$, 'P0001', 'ERP_CATEGORIA_DUPLICADA', 'categoría: nombre repetido sin importar mayúsculas');
select throws_ok($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', null, '  ')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'categoría: nombre vacío');
select throws_ok($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', null, null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'categoría: nombre nulo');
select throws_ok(format($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', %L, 'Robo')$$, current_setting('t.cat_l')), 'P0001', 'ERP_DATOS_INVALIDOS', 'categoría: renombrar la de otro negocio');
select pg_temp.como('99999999-2000-0000-0000-000000000002');
select throws_ok($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', null, 'Nueva')$$, 'P0001', 'ERP_SIN_PERMISO', 'categoría: el vendedor no edita productos');
select pg_temp.como('99999999-2000-0000-0000-000000000004');
select throws_ok($$select public.guardar_categoria('aaaaaaaa-2000-0000-0000-000000000001', null, 'Nueva')$$, 'P0001', 'ERP_SIN_PERMISO', 'categoría: usuario de otro negocio');

-- guardar_producto: feliz
select pg_temp.como('99999999-2000-0000-0000-000000000001');
select set_config('t.prod', public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', jsonb_build_object(
  'codigo', ' P-1 ', 'codigo_barras', '7770001', 'nombre', 'Celular', 'marca', 'M', 'categoria_id', current_setting('t.cat'),
  'tipo', 'producto', 'controla_serie', true, 'garantia_meses', 12, 'stock_minimo', 2.5))::text, true);
select isnt(current_setting('t.prod'), '', 'producto: crear devuelve el id');
select results_eq(
  format($$select codigo, codigo_barras, categoria_id::text, unidad, controla_serie, garantia_meses, stock_minimo, activo from public.productos where id = %L$$, current_setting('t.prod')),
  format($$values ('P-1', '7770001', %L, 'unidad', true, 12, 2.500::numeric, true)$$, current_setting('t.cat')),
  'producto: campos guardados con sus valores por defecto'
);
select lives_ok(format($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', jsonb_build_object('id', %L::text, 'codigo', 'P-1', 'nombre', 'Celular B', 'tipo', 'producto', 'foto_path', 'aaaaaaaa-2000-0000-0000-000000000001/x.jpg'))$$, current_setting('t.prod')), 'producto: editar');
select results_eq(
  format($$select nombre, codigo_barras, categoria_id::text, foto_path from public.productos where id = %L$$, current_setting('t.prod')),
  $$values ('Celular B', null, null, 'aaaaaaaa-2000-0000-0000-000000000001/x.jpg')$$,
  'producto: editar reemplaza los campos ausentes'
);
select lives_ok(format($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', jsonb_build_object('id', %L::text, 'codigo', 'P-1', 'nombre', 'Celular C', 'tipo', 'producto'))$$, current_setting('t.prod')), 'producto: editar sin foto_path');
select is((select foto_path from public.productos where id = current_setting('t.prod')::uuid), 'aaaaaaaa-2000-0000-0000-000000000001/x.jpg', 'producto: sin la clave foto_path se conserva la foto');
select is((select count(*) from public.productos where negocio_id = 'aaaaaaaa-2000-0000-0000-000000000001'), 1::bigint, 'producto: editar no crea otra fila');
select lives_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"P-2","codigo_barras":"7770002","nombre":"Con barras","tipo":"producto"}')$$, 'producto: crear con otro código de barras');
select lives_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"P-3","nombre":"Sin barras 1","tipo":"producto"}')$$, 'producto: sin código de barras');
select lives_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"P-4","nombre":"Sin barras 2","tipo":"producto"}')$$, 'producto: varios sin código de barras conviven');
select lives_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000002', '{"codigo":"P-1","codigo_barras":"7770001","nombre":"Planchado","tipo":"servicio"}')$$, 'producto: mismo código y barras en otro negocio, servicio en lavandería');
select lives_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000002', '{"codigo":"I-1","nombre":"Detergente","tipo":"insumo"}')$$, 'producto: insumo en lavandería');
-- guardar_producto: duplicados e inválidos
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"P-1","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_CODIGO_DUPLICADO', 'producto: código repetido');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"P-9","codigo_barras":"7770002","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_CODIGO_BARRAS_DUPLICADO', 'producto: código de barras repetido');
select throws_ok(format($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', jsonb_build_object('id', %L::text, 'codigo', 'P-2', 'nombre', 'X', 'tipo', 'producto'))$$, current_setting('t.prod')), 'P0001', 'ERP_CODIGO_DUPLICADO', 'producto: editar hacia un código ajeno');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"servicio"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: servicio no vale en tienda');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"insumo"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: insumo no vale en tienda');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000002', '{"codigo":"S-1","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: producto no vale en lavandería');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: tipo ausente');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: código obligatorio');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":" ","tipo":"producto"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: nombre vacío');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"producto","unidad":"lt"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: unidad inválida');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"producto","garantia_meses":"doce"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: garantía no numérica');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"producto","stock_minimo":-1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: stock mínimo negativo');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"producto","foto_path":"otro/x.jpg"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: foto fuera de la carpeta del negocio');
select throws_ok(format($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', jsonb_build_object('codigo', 'S-1', 'nombre', 'X', 'tipo', 'producto', 'categoria_id', %L::text))$$, current_setting('t.cat_l')), 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: categoría de otro negocio');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '[]')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: datos que no son un objeto');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"id":"no-uuid","codigo":"S-1","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: id mal formado');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"id":"ffffffff-0000-0000-0000-000000000000","codigo":"S-1","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: editar un id inexistente');
select pg_temp.como('99999999-2000-0000-0000-000000000002');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_SIN_PERMISO', 'producto: el vendedor no edita productos');
select pg_temp.como('99999999-2000-0000-0000-000000000004');
select throws_ok($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000001', '{"codigo":"S-1","nombre":"X","tipo":"producto"}')$$, 'P0001', 'ERP_SIN_PERMISO', 'producto: usuario de otro negocio');
select throws_ok(format($$select public.guardar_producto('aaaaaaaa-2000-0000-0000-000000000002', jsonb_build_object('id', %L::text, 'codigo', 'Z', 'nombre', 'X', 'tipo', 'servicio'))$$, current_setting('t.prod')), 'P0001', 'ERP_DATOS_INVALIDOS', 'producto: editar el producto de otro negocio dentro del propio');

-- desactivar_producto
select pg_temp.como('99999999-2000-0000-0000-000000000001');
select lives_ok(format($$select public.desactivar_producto(%L, false)$$, current_setting('t.prod')), 'desactivar: feliz');
select is((select activo from public.productos where id = current_setting('t.prod')::uuid), false, 'desactivar: queda inactivo y la fila sigue');
select lives_ok(format($$select public.desactivar_producto(%L, true)$$, current_setting('t.prod')), 'activar: feliz');
select is((select activo from public.productos where id = current_setting('t.prod')::uuid), true, 'activar: vuelve a activo');
select throws_ok(format($$select public.desactivar_producto(%L, null)$$, current_setting('t.prod')), 'P0001', 'ERP_DATOS_INVALIDOS', 'desactivar: estado nulo');
select throws_ok($$select public.desactivar_producto('ffffffff-0000-0000-0000-000000000000', false)$$, 'P0001', 'ERP_SIN_PERMISO', 'desactivar: producto inexistente');
select pg_temp.como('99999999-2000-0000-0000-000000000003');
select throws_ok(format($$select public.desactivar_producto(%L, false)$$, current_setting('t.prod')), 'P0001', 'ERP_SIN_PERMISO', 'desactivar: el contador no edita productos');
select pg_temp.como('99999999-2000-0000-0000-000000000004');
select throws_ok(format($$select public.desactivar_producto(%L, false)$$, current_setting('t.prod')), 'P0001', 'ERP_SIN_PERMISO', 'desactivar: producto de otro negocio');
reset role;
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname ~ '^(borrar|eliminar|delete)'), 0::bigint, 'no existe RPC de borrado');

select * from finish();
rollback;
