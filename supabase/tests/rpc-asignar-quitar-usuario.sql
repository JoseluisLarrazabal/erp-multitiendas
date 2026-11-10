-- RPC asignar_usuario y quitar_usuario: camino feliz, sin permiso, otro negocio, datos inválidos y reglas 1 y 2.
begin;
select plan(35);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
create function pg_temp.rol_de(p_usuario uuid, p_negocio uuid) returns text language sql as $$
  select rol from public.usuario_negocio where usuario_id = p_usuario and negocio_id = p_negocio
$$;

-- T tienda, L lavandería.
-- d: dueño de T y L · d2: dueño de L y vendedor de T · enc_l: encargado de L · emp_l: empleado de L
-- enc_t: encargado de T · v: vendedor de T · m: vendedor en T y empleado en L · y: perfil sin negocios
select pg_temp.crear_usuario(('66666666-0000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'd2'), ('3', 'enc_l'), ('4', 'emp_l'), ('5', 'enc_t'), ('6', 'v'), ('7', 'm'), ('8', 'y')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('77777777-0000-0000-0000-000000000001', 'T', 'tienda'),
  ('77777777-0000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'dueno'),
  ('66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000002', 'dueno'),
  ('66666666-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000002', 'dueno'),
  ('66666666-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001', 'vendedor'),
  ('66666666-0000-0000-0000-000000000003', '77777777-0000-0000-0000-000000000002', 'encargado'),
  ('66666666-0000-0000-0000-000000000004', '77777777-0000-0000-0000-000000000002', 'empleado'),
  ('66666666-0000-0000-0000-000000000005', '77777777-0000-0000-0000-000000000001', 'encargado'),
  ('66666666-0000-0000-0000-000000000006', '77777777-0000-0000-0000-000000000001', 'vendedor'),
  ('66666666-0000-0000-0000-000000000007', '77777777-0000-0000-0000-000000000001', 'vendedor'),
  ('66666666-0000-0000-0000-000000000007', '77777777-0000-0000-0000-000000000002', 'empleado');

-- asignar_usuario: camino feliz y upsert
select pg_temp.como('66666666-0000-0000-0000-000000000001');
select lives_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000008', 'vendedor')$$, 'asignar: el dueño asigna a y como vendedor de T');
select is(pg_temp.rol_de('66666666-0000-0000-0000-000000000008', '77777777-0000-0000-0000-000000000001'), 'vendedor', 'asignar: queda como vendedor');
select lives_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000008', 'contador')$$, 'asignar: reasignar es upsert');
select is(pg_temp.rol_de('66666666-0000-0000-0000-000000000008', '77777777-0000-0000-0000-000000000001'), 'contador', 'asignar: el rol cambió');
select is((select count(*) from public.usuario_negocio where usuario_id = '66666666-0000-0000-0000-000000000008'), 1::bigint, 'asignar: sin fila duplicada');
select lives_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000008', 'dueno')$$, 'asignar: un dueño puede asignar dueno');

-- asignar_usuario: sin permiso, otro negocio
select pg_temp.como('66666666-0000-0000-0000-000000000006');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000008', 'vendedor')$$, 'P0001', 'ERP_SIN_PERMISO', 'asignar: el vendedor no tiene usuarios');
select pg_temp.como('66666666-0000-0000-0000-000000000005');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000008', 'vendedor')$$, 'P0001', 'ERP_SIN_PERMISO', 'asignar: el encargado de tienda no tiene usuarios');
select pg_temp.como('66666666-0000-0000-0000-000000000003');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000008', 'vendedor')$$, 'P0001', 'ERP_SIN_PERMISO', 'asignar: usuario de otro negocio (enc_l en T)');
select throws_ok($$select public.asignar_usuario('99999999-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000008', 'vendedor')$$, 'P0001', 'ERP_SIN_PERMISO', 'asignar: negocio inexistente');

-- asignar_usuario: datos inválidos
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000008', 'jefe')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'asignar: rol inexistente');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000008', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'asignar: rol nulo');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', null, 'empleado')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'asignar: usuario nulo');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000001', 'empleado')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'asignar: usuario sin perfil');

-- asignar_usuario: regla 1 y regla 2
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000004', 'dueno')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'regla 1: el encargado de lavandería no asigna dueno');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000002', 'empleado')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'regla 1: el encargado no modifica a un dueño');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000003', 'dueno')$$, 'P0001', 'ERP_AUTOGESTION', 'regla 2: nadie se asigna dueno a sí mismo');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000003', 'empleado')$$, 'P0001', 'ERP_AUTOGESTION', 'regla 2: nadie cambia su propio rol');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000004', 'encargado')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'solo dueño: el encargado no asigna encargado');
select lives_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000004', 'contador')$$, 'el encargado de lavandería sí gestiona a un no dueño ni encargado');
select pg_temp.como('66666666-0000-0000-0000-000000000001');
select throws_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'vendedor')$$, 'P0001', 'ERP_AUTOGESTION', 'regla 2: el dueño no se degrada');
select lives_ok($$select public.asignar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000002', 'encargado')$$, 'regla 1: un dueño sí modifica a otro dueño');

-- quitar_usuario: camino feliz y alcance por negocio
select pg_temp.como('66666666-0000-0000-0000-000000000003');
select lives_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000007')$$, 'quitar: enc_l quita a m de L');
reset role;
select is(pg_temp.rol_de('66666666-0000-0000-0000-000000000007', '77777777-0000-0000-0000-000000000002'), null, 'quitar: m ya no está en L');
select is(pg_temp.rol_de('66666666-0000-0000-0000-000000000007', '77777777-0000-0000-0000-000000000001'), 'vendedor', 'quitar: m conserva su rol en T');

-- quitar_usuario: sin permiso, otro negocio, datos, reglas
select pg_temp.como('66666666-0000-0000-0000-000000000006');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000007')$$, 'P0001', 'ERP_SIN_PERMISO', 'quitar: el vendedor no tiene usuarios');
select pg_temp.como('66666666-0000-0000-0000-000000000003');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000006')$$, 'P0001', 'ERP_SIN_PERMISO', 'quitar: usuario de otro negocio (enc_l en T)');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'quitar: usuario nulo');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000006')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'quitar: usuario que no es miembro');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001')$$, 'P0001', 'ERP_DUENO_PROTEGIDO', 'regla 1: el encargado no quita a un dueño');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000003')$$, 'P0001', 'ERP_AUTOGESTION', 'regla 2: nadie se quita a sí mismo');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000004')$$, 'P0001', 'ERP_ULTIMO_NEGOCIO', 'último negocio: no se quita, la cuenta se desactiva');
select is(pg_temp.rol_de('66666666-0000-0000-0000-000000000004', '77777777-0000-0000-0000-000000000002'), 'contador', 'último negocio: emp_l conserva su rol');
select pg_temp.como('66666666-0000-0000-0000-000000000001');
select throws_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001')$$, 'P0001', 'ERP_AUTOGESTION', 'regla 2: el dueño no se quita');
select lives_ok($$select public.quitar_usuario('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000002')$$, 'regla 1: un dueño sí quita a otro dueño');

select * from finish();
rollback;
