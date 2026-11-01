-- Auditoría (RF-TR-09): DB-27, triggers genéricos, append-only, lectura con ver_reportes y auditar_cuenta.
begin;
select plan(31);
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
-- d: dueño de T y L · e: encargado de T · c: contador de T · v: vendedor de T · x: dueño de L
-- m: vendedor en T y empleado en L (objetivo de auditar_cuenta) · u: vendedor solo en T
select pg_temp.crear_usuario(('99999999-6000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'e'), ('3', 'c'), ('4', 'v'), ('5', 'x'), ('6', 'm'), ('7', 'u')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-6000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-6000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-6000-0000-0000-000000000001', 'aaaaaaaa-6000-0000-0000-000000000001', 'dueno'),
  ('99999999-6000-0000-0000-000000000001', 'aaaaaaaa-6000-0000-0000-000000000002', 'dueno'),
  ('99999999-6000-0000-0000-000000000002', 'aaaaaaaa-6000-0000-0000-000000000001', 'encargado'),
  ('99999999-6000-0000-0000-000000000003', 'aaaaaaaa-6000-0000-0000-000000000001', 'contador'),
  ('99999999-6000-0000-0000-000000000004', 'aaaaaaaa-6000-0000-0000-000000000001', 'vendedor'),
  ('99999999-6000-0000-0000-000000000005', 'aaaaaaaa-6000-0000-0000-000000000002', 'dueno'),
  ('99999999-6000-0000-0000-000000000006', 'aaaaaaaa-6000-0000-0000-000000000001', 'vendedor'),
  ('99999999-6000-0000-0000-000000000006', 'aaaaaaaa-6000-0000-0000-000000000002', 'empleado'),
  ('99999999-6000-0000-0000-000000000007', 'aaaaaaaa-6000-0000-0000-000000000001', 'vendedor');

-- Trigger sobre usuario_negocio: clave compuesta y usuario nulo (sin sesión).
select is((select count(*) from public.auditoria where tabla = 'usuario_negocio' and registro_id = '99999999-6000-0000-0000-000000000006:aaaaaaaa-6000-0000-0000-000000000002' and accion = 'insert' and usuario_id is null and negocio_id = 'aaaaaaaa-6000-0000-0000-000000000002'), 1::bigint, 'trigger: usuario_negocio audita con clave compuesta y usuario nulo');

-- DB-27: cambios de precio quedan en auditoria, con quién y qué cambió.
select pg_temp.como('99999999-6000-0000-0000-000000000002');
select set_config('t.prod', public.guardar_producto('aaaaaaaa-6000-0000-0000-000000000001', '{"codigo":"P1","nombre":"Uno","tipo":"producto"}')::text, true);
select public.guardar_precios('aaaaaaaa-6000-0000-0000-000000000001', jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.prod'), 'moneda', 'BOB', 'precios', '{"contado":10}'::jsonb)));
select public.guardar_precios('aaaaaaaa-6000-0000-0000-000000000001', jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.prod'), 'moneda', 'BOB', 'precios', '{"contado":12}'::jsonb)));
select public.guardar_precios('aaaaaaaa-6000-0000-0000-000000000001', jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.prod'), 'moneda', 'BOB', 'precios', '{"contado":12}'::jsonb)));
select public.guardar_precios('aaaaaaaa-6000-0000-0000-000000000001', jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.prod'), 'moneda', 'BOB', 'precios', '{"contado":null}'::jsonb)));
select public.registrar_tipo_cambio('aaaaaaaa-6000-0000-0000-000000000001', 6.96);
reset role;
select results_eq(
  format($$select accion, (antes ->> 'monto')::numeric, (despues ->> 'monto')::numeric, usuario_id::text, negocio_id::text from public.auditoria where tabla = 'producto_precios' and registro_id = %L order by id$$, current_setting('t.prod') || ':contado'),
  $$values ('insert', null::numeric, 10::numeric, '99999999-6000-0000-0000-000000000002', 'aaaaaaaa-6000-0000-0000-000000000001'),
           ('update', 10::numeric, 12::numeric, '99999999-6000-0000-0000-000000000002', 'aaaaaaaa-6000-0000-0000-000000000001'),
           ('delete', 12::numeric, null::numeric, '99999999-6000-0000-0000-000000000002', 'aaaaaaaa-6000-0000-0000-000000000001')$$,
  'DB-27: alta, cambio y baja de un precio, con valor anterior, nuevo y autor');
select is((select count(*) from public.auditoria where tabla = 'producto_precios' and accion = 'update'), 1::bigint, 'trigger: un update sin cambios no deja fila');
select is((select count(*) from public.auditoria where tabla = 'productos' and registro_id = current_setting('t.prod') and accion = 'insert' and despues ->> 'codigo' = 'P1'), 1::bigint, 'trigger: productos audita el alta');
select is((select count(*) from public.auditoria where tabla = 'tipos_cambio' and accion = 'insert' and (despues ->> 'valor')::numeric = 6.96 and usuario_id = '99999999-6000-0000-0000-000000000002'), 1::bigint, 'trigger: tipos_cambio audita el registro');
update public.rol_permisos set permiso = 'vender' where false;
delete from public.rol_permisos where tipo_negocio = 'tienda' and rol = 'contador' and permiso = 'ver_costos';
select is((select count(*) from public.auditoria where tabla = 'rol_permisos' and registro_id = 'tienda:contador:ver_costos' and accion = 'delete' and negocio_id is null), 1::bigint, 'trigger: rol_permisos audita sin negocio y con clave de 3 columnas');
-- Restablecer la matriz: la transacción se revierte igual, pero el test no debe depender de ello.
insert into public.rol_permisos values ('tienda', 'contador', 'ver_costos');

-- Lectura: ver_reportes. d dueño, c contador sí; v vendedor no; x de otro negocio no.
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select cmp_ok((select count(*) from public.auditoria where tabla = 'producto_precios'), '>', 0::bigint, 'lectura: el dueño ve la auditoría del negocio');
select pg_temp.como('99999999-6000-0000-0000-000000000003');
select cmp_ok((select count(*) from public.auditoria where tabla = 'producto_precios'), '>', 0::bigint, 'lectura: el contador tiene ver_reportes');
select is((select count(*) from public.auditoria where negocio_id is null), 0::bigint, 'lectura: las filas sin negocio no se ven por la API');
select pg_temp.como('99999999-6000-0000-0000-000000000004');
select is((select count(*) from public.auditoria), 0::bigint, 'lectura: el vendedor no ve auditoría');
select pg_temp.como('99999999-6000-0000-0000-000000000005');
select is((select count(*) from public.auditoria where tabla = 'producto_precios'), 0::bigint, 'lectura: otro negocio no ve auditoría de T');

-- Sin escritura para authenticated, ni al dueño.
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select throws_ok($$insert into public.auditoria (tabla, registro_id, accion) values ('x', 'x', 'insert')$$, '42501', null, 'escritura: insert directo en auditoria');
select throws_ok($$update public.auditoria set tabla = 'x'$$, '42501', null, 'escritura: update directo en auditoria');
select throws_ok($$delete from public.auditoria$$, '42501', null, 'escritura: delete directo en auditoria');
reset role;
set local role anon;
select throws_ok($$select * from public.auditoria$$, '42501', null, 'anon: sin acceso a auditoria');
reset role;
-- Append-only también para el dueño de la tabla.
select throws_ok($$update public.auditoria set tabla = 'x'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'append-only: update rechazado');
select throws_ok($$delete from public.auditoria$$, 'P0001', 'ERP_SOLO_AGREGAR', 'append-only: delete rechazado');
select throws_ok($$truncate public.auditoria$$, 'P0001', 'ERP_SOLO_AGREGAR', 'append-only: truncate rechazado');

-- auditar_cuenta: d administra a m (vendedor en T, empleado en L; d es dueño de ambos).
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select lives_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000006', false)$$, 'cuenta: desactivar se registra');
reset role;
select results_eq(
  $$select negocio_id::text, accion, antes ->> 'activo', despues ->> 'activo', usuario_id::text, tabla, registro_id from public.auditoria where tabla = 'perfiles' order by negocio_id$$,
  $$values ('aaaaaaaa-6000-0000-0000-000000000001', 'desactivar', 'true', 'false', '99999999-6000-0000-0000-000000000001', 'perfiles', '99999999-6000-0000-0000-000000000006'),
           ('aaaaaaaa-6000-0000-0000-000000000002', 'desactivar', 'true', 'false', '99999999-6000-0000-0000-000000000001', 'perfiles', '99999999-6000-0000-0000-000000000006')$$,
  'cuenta: una fila por negocio de la cuenta, con el autor');
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select lives_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000006', true)$$, 'cuenta: reactivar se registra');
reset role;
select is((select count(*) from public.auditoria where tabla = 'perfiles' and accion = 'reactivar' and despues ->> 'activo' = 'true'), 2::bigint, 'cuenta: reactivar deja una fila por negocio');
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000006', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cuenta: estado nulo');
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000001', false)$$, 'P0001', 'ERP_SIN_PERMISO', 'cuenta: nadie audita a sí mismo');
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-0000000000ff', false)$$, 'P0001', 'ERP_SIN_PERMISO', 'cuenta: cuenta inexistente');
select throws_ok($$select public.auditar_cuenta(null, false)$$, 'P0001', 'ERP_SIN_PERMISO', 'cuenta: usuario nulo');
select pg_temp.como('99999999-6000-0000-0000-000000000002');
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000007', false)$$, 'P0001', 'ERP_SIN_PERMISO', 'cuenta: el encargado de T no tiene usuarios');
select pg_temp.como('99999999-6000-0000-0000-000000000005');
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000007', false)$$, 'P0001', 'ERP_SIN_PERMISO', 'cuenta: dueño de otro negocio');
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000006', false)$$, 'P0001', 'ERP_SIN_PERMISO', 'cuenta: no basta administrar uno de sus negocios');
reset role;
set local role anon;
select throws_ok($$select public.auditar_cuenta('99999999-6000-0000-0000-000000000006', false)$$, '42501', null, 'cuenta: anon no ejecuta auditar_cuenta');
reset role;
select is((select count(*) from public.auditoria where tabla = 'perfiles'), 4::bigint, 'cuenta: los rechazos no dejaron filas');

select * from finish();
rollback;
