-- Matriz de permisos (docs/srs.md, sección 4): contenido de rol_permisos y efecto real vía tiene_permiso.
begin;
select plan(23);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- Esperado, escrito aparte de la migración: roles que tienen cada permiso, por grilla.
create temp table esperado (permiso text, tienda_frial text[], lavanderia text[]);
insert into esperado values
  ('vender',               '{dueno,encargado,vendedor,empleado}',  '{dueno,encargado,vendedor,empleado}'),
  ('ver_costos',           '{dueno,encargado,contador}',           '{dueno,encargado,contador}'),
  ('descontar',            '{dueno,encargado}',                    '{dueno,encargado,vendedor,empleado}'),
  ('anular',               '{dueno,encargado}',                    '{dueno,encargado}'),
  ('devolver_fuera_plazo', '{dueno,encargado}',                    '{dueno,encargado}'),
  ('ajustar_inventario',   '{dueno,encargado}',                    '{dueno,encargado}'),
  ('editar_productos',     '{dueno,encargado}',                    '{dueno,encargado}'),
  ('ver_reportes',         '{dueno,encargado,contador}',           '{dueno,encargado,contador}'),
  ('caja',                 '{dueno,encargado,vendedor,empleado}',  '{dueno,encargado,vendedor,empleado}'),
  ('usuarios',             '{dueno}',                              '{dueno,encargado}'),
  ('cambiar_estado_orden', '{}',                                   '{dueno,encargado,vendedor,empleado}'),
  ('gestionar_credito',    '{dueno,encargado}',                    '{}'),
  ('gestionar_reservas',   '{dueno,encargado,vendedor,empleado}',  '{}'),
  ('gestionar_compras',    '{dueno,encargado}',                    '{dueno,encargado}');

select is((select count(*) from public.rol_permisos), 100::bigint, 'matriz: 100 filas en total');
select is((select count(*) from public.rol_permisos where tipo_negocio = 'lavanderia'), 34::bigint, 'matriz: 34 filas de lavandería');
select set_eq(
  $$select tipo_negocio, rol, permiso from public.rol_permisos where tipo_negocio = 'tienda'$$,
  $$select 'tienda', r, permiso from esperado, unnest(tienda_frial) r$$,
  'matriz: tienda coincide fila por fila con el SRS');
select set_eq(
  $$select tipo_negocio, rol, permiso from public.rol_permisos where tipo_negocio = 'frial'$$,
  $$select 'frial', r, permiso from esperado, unnest(tienda_frial) r$$,
  'matriz: frial usa la grilla de tienda');
select set_eq(
  $$select tipo_negocio, rol, permiso from public.rol_permisos where tipo_negocio = 'lavanderia'$$,
  $$select 'lavanderia', r, permiso from esperado, unnest(lavanderia) r$$,
  'matriz: lavandería coincide fila por fila con el SRS');

-- Un negocio de cada tipo y un usuario por rol en cada uno.
insert into public.negocios (id, nombre, tipo) values
  ('cccccccc-0000-0000-0000-000000000001', 'T', 'tienda'),
  ('cccccccc-0000-0000-0000-000000000002', 'L', 'lavanderia'),
  ('cccccccc-0000-0000-0000-000000000003', 'F', 'frial');
select pg_temp.crear_usuario(('dddddddd-' || t || '-0000-0000-00000000000' || r)::uuid, 'u' || t || r)
  from (values ('0001'), ('0002'), ('0003')) tt (t), (values ('1'), ('2'), ('3'), ('4'), ('5')) rr (r);
insert into public.usuario_negocio (usuario_id, negocio_id, rol)
select ('dddddddd-' || t || '-0000-0000-00000000000' || r)::uuid,
       ('cccccccc-0000-0000-0000-00000000' || t)::uuid,
       (array['dueno', 'encargado', 'contador', 'vendedor', 'empleado'])[r::int]
  from (values ('0001'), ('0002'), ('0003')) tt (t), (values ('1'), ('2'), ('3'), ('4'), ('5')) rr (r);

-- Funciones de ayuda: usuario por tipo (1 tienda, 2 lavandería, 3 frial) y rol (1 dueño ... 5 empleado).
create function pg_temp.puede(p_tipo int, p_rol int, p_permiso text) returns boolean language plpgsql as $$
begin
  perform pg_temp.como(('dddddddd-000' || p_tipo || '-0000-0000-00000000000' || p_rol)::uuid);
  return public.tiene_permiso(('cccccccc-0000-0000-0000-00000000000' || p_tipo)::uuid, p_permiso);
end;
$$;

select ok(pg_temp.puede(1, 1, 'usuarios'), 'tienda: el dueño tiene usuarios');
select ok(not pg_temp.puede(1, 2, 'usuarios'), 'tienda: el encargado NO tiene usuarios');
select ok(pg_temp.puede(2, 2, 'usuarios'), 'lavandería: el encargado SÍ tiene usuarios');
select ok(not pg_temp.puede(2, 4, 'usuarios'), 'lavandería: el vendedor no tiene usuarios');
select ok(not pg_temp.puede(3, 2, 'usuarios'), 'frial: el encargado NO tiene usuarios (grilla de tienda)');
select ok(not pg_temp.puede(1, 4, 'descontar'), 'tienda: el vendedor NO descuenta');
select ok(not pg_temp.puede(1, 5, 'descontar'), 'tienda: el empleado NO descuenta');
select ok(pg_temp.puede(2, 4, 'descontar'), 'lavandería: el vendedor SÍ descuenta');
select ok(pg_temp.puede(2, 5, 'descontar'), 'lavandería: el empleado SÍ descuenta');
select ok(not pg_temp.puede(2, 3, 'descontar'), 'lavandería: el contador no descuenta');
select ok(not pg_temp.puede(1, 1, 'cambiar_estado_orden'), 'tienda: ni el dueño cambia estado de orden');
select ok(not pg_temp.puede(3, 4, 'cambiar_estado_orden'), 'frial: nadie cambia estado de orden');
select ok(pg_temp.puede(2, 4, 'cambiar_estado_orden'), 'lavandería: el vendedor cambia estado de orden');
select ok(pg_temp.puede(2, 5, 'cambiar_estado_orden'), 'lavandería: el empleado cambia estado de orden');
select ok(not pg_temp.puede(2, 3, 'cambiar_estado_orden'), 'lavandería: el contador no cambia estado de orden');
select ok(not pg_temp.puede(2, 2, 'gestionar_credito'), 'lavandería: sin crédito ni para el encargado');
select ok(pg_temp.puede(1, 3, 'ver_costos') and not pg_temp.puede(1, 4, 'ver_costos'), 'tienda: el contador ve costos y el vendedor no');
select ok(not pg_temp.puede(1, 3, 'vender') and not pg_temp.puede(1, 3, 'caja'), 'tienda: el contador no vende ni usa caja');

select * from finish();
rollback;
