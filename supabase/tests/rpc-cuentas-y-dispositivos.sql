-- RPC registrar_dispositivo.
begin;
select plan(16);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería, con una ubicación cada una.
-- d: dueño de T y L · enc_l: encargado de L · emp_l: empleado de L · v: vendedor de T · m: vendedor en T y empleado en L
select pg_temp.crear_usuario(('99999999-1000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'enc_l'), ('3', 'emp_l'), ('4', 'v'), ('5', 'm')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-1000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-1000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-1000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001', 'local T', 'local'),
  ('bbbbbbbb-1000-0000-0000-000000000002', 'aaaaaaaa-1000-0000-0000-000000000002', 'local L', 'local');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-1000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001', 'dueno'),
  ('99999999-1000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000002', 'dueno'),
  ('99999999-1000-0000-0000-000000000002', 'aaaaaaaa-1000-0000-0000-000000000002', 'encargado'),
  ('99999999-1000-0000-0000-000000000003', 'aaaaaaaa-1000-0000-0000-000000000002', 'empleado'),
  ('99999999-1000-0000-0000-000000000004', 'aaaaaaaa-1000-0000-0000-000000000001', 'vendedor'),
  ('99999999-1000-0000-0000-000000000005', 'aaaaaaaa-1000-0000-0000-000000000001', 'vendedor'),
  ('99999999-1000-0000-0000-000000000005', 'aaaaaaaa-1000-0000-0000-000000000002', 'empleado');

-- registrar_dispositivo: camino feliz
select pg_temp.como('99999999-1000-0000-0000-000000000001');
select isnt(public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'Caja 1', 'C1'), null, 'dispositivo: devuelve el id');
select is((select count(*) from public.dispositivos where negocio_id = 'aaaaaaaa-1000-0000-0000-000000000001' and prefijo = 'C1'), 1::bigint, 'dispositivo: quedó registrado');
select lives_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000002', 'bbbbbbbb-1000-0000-0000-000000000002', 'Caja 1', 'C1')$$, 'dispositivo: el mismo prefijo en otro negocio es válido');
select lives_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'Caja 12', 'C12')$$, 'dispositivo: prefijo de letra y 2 dígitos');

-- registrar_dispositivo: prefijo repetido, sin permiso, otro negocio, datos inválidos
select throws_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'Otra', 'C1')$$, 'P0001', 'ERP_PREFIJO_DUPLICADO', 'dispositivo: prefijo repetido en el negocio');
select throws_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000002', 'Caja', 'C2')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'dispositivo: ubicación de otro negocio');
select throws_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', null, 'Caja', 'C2')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'dispositivo: ubicación nula');
select throws_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', '  ', 'C2')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'dispositivo: nombre vacío');
select throws_ok(format($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'Caja', %L)$$, p), 'P0001', 'ERP_DATOS_INVALIDOS', 'dispositivo: prefijo inválido ' || coalesce(p, 'nulo'))
  from unnest(array['c1', 'C', 'C123', '1C', null]) p;
select pg_temp.como('99999999-1000-0000-0000-000000000004');
select throws_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'Caja', 'C3')$$, 'P0001', 'ERP_SIN_PERMISO', 'dispositivo: el vendedor no tiene usuarios');
select pg_temp.como('99999999-1000-0000-0000-000000000002');
select throws_ok($$select public.registrar_dispositivo('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000001', 'Caja', 'C3')$$, 'P0001', 'ERP_SIN_PERMISO', 'dispositivo: usuario de otro negocio');

-- La FK compuesta cierra el hueco aun si alguien escribe sin pasar por la RPC.
reset role;
select throws_ok($$insert into public.dispositivos (negocio_id, ubicacion_id, nombre, prefijo) values ('aaaaaaaa-1000-0000-0000-000000000001', 'bbbbbbbb-1000-0000-0000-000000000002', 'x', 'C9')$$, '23503', null, 'FK compuesta: ubicación de otro negocio rechazada');

select * from finish();
rollback;
